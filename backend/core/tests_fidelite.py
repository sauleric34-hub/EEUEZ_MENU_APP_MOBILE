"""Tests de la fidélité et de la modération administrateur (lot 3).

Le cœur du fichier est l'ANTI-ABUS : sans idempotence, la boucle
like / retrait / like serait une machine à points.
"""

from django.test import TestCase, override_settings, Client
from rest_framework.test import APIClient

from . import fidelite
from .models import (
    AuditLog, MouvementPoints, ParametrageFidelite, Publication,
    PublicationCommentaire, RestaurantProfile, User,
)
from .tests import NO_THROTTLE


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class FideliteTests(TestCase):
    """Points, niveaux et garde-fous."""

    def setUp(self):
        self.auteur = User.objects.create_user(
            username='a@fid.cm', email='a@fid.cm', password='pass1234', role='client',
        )
        self.liker = User.objects.create_user(
            username='l@fid.cm', email='l@fid.cm', password='pass1234', role='client',
        )
        self.resto_user = User.objects.create_user(
            username='r@fid.cm', email='r@fid.cm', password='pass1234', role='restaurant',
        )
        self.resto = RestaurantProfile.objects.create(
            user=self.resto_user, nom='Resto Fid', adresse='Douala', ville='Douala',
            is_open=True, is_verified=True,
        )
        self.api = APIClient()
        self.config = ParametrageFidelite.get_solo()

    def _auth(self, email):
        tok = self.api.post(
            '/api/auth/login', {'email': email, 'password': 'pass1234'}, format='json',
        ).json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")

    def _contribution(self, statut='publiee'):
        return Publication.objects.create(
            restaurant=self.resto, auteur=self.auteur, texte='Ma contribution', statut=statut,
        )

    def _solde(self):
        self.auteur.refresh_from_db()
        return self.auteur.points_solde

    # ── Validation ──────────────────────────────────────────
    def test_validation_credite_l_auteur(self):
        pub = self._contribution(statut='en_attente')
        web = Client()
        web.force_login(self.resto_user)
        web.post('/admin-panel/resto/publications/', {
            'publication_id': pub.pk, 'action': 'valider',
        })
        self.assertEqual(self._solde(), self.config.points_publication_validee)
        pub.refresh_from_db()
        self.assertTrue(pub.points_attribues)

    def test_publication_du_restaurant_ne_credite_personne(self):
        """Sans auteur client, il n'y a personne à récompenser."""
        pub = Publication.objects.create(
            restaurant=self.resto, auteur=None, texte='Du resto', statut='publiee',
        )
        self.assertIsNone(fidelite.crediter_publication_validee(pub))
        self.assertEqual(MouvementPoints.objects.count(), 0)

    def test_revalidation_ne_credite_pas_deux_fois(self):
        pub = self._contribution(statut='en_attente')
        fidelite.crediter_publication_validee(pub)
        # On force le contournement du drapeau : c'est la contrainte d'unicité
        # du grand livre qui doit tenir, pas le booléen applicatif.
        pub.points_attribues = False
        pub.save(update_fields=['points_attribues'])
        fidelite.crediter_publication_validee(pub)
        self.assertEqual(
            MouvementPoints.objects.filter(motif='publication_validee').count(), 1,
        )
        self.assertEqual(self._solde(), self.config.points_publication_validee)

    # ── Likes : le garde-fou anti-abus ──────────────────────
    def test_like_puis_retrait_puis_like_ne_credite_qu_une_fois(self):
        pub = self._contribution()
        self._auth('l@fid.cm')
        url = f'/api/client/publications/{pub.pk}/like'
        for _ in range(3):
            self.api.post(url)   # like
            self.api.post(url)   # retrait
        self.assertEqual(MouvementPoints.objects.filter(motif='like_recu').count(), 1)
        self.assertEqual(self._solde(), self.config.points_par_like)

    def test_retrait_de_like_ne_debite_jamais(self):
        """Sinon un tiers viderait le solde d'autrui à volonté."""
        pub = self._contribution()
        self._auth('l@fid.cm')
        url = f'/api/client/publications/{pub.pk}/like'
        self.api.post(url)
        solde_apres_like = self._solde()
        self.api.post(url)   # retrait
        self.assertEqual(self._solde(), solde_apres_like)

    def test_aimer_sa_propre_publication_ne_rapporte_rien(self):
        pub = self._contribution()
        self._auth('a@fid.cm')
        self.api.post(f'/api/client/publications/{pub.pk}/like')
        self.assertEqual(self._solde(), 0)
        self.assertEqual(MouvementPoints.objects.count(), 0)

    def test_deux_personnes_creditent_deux_fois(self):
        pub = self._contribution()
        for email in ('l@fid.cm', 'r@fid.cm'):
            self._auth(email)
            self.api.post(f'/api/client/publications/{pub.pk}/like')
        self.assertEqual(self._solde(), self.config.points_par_like * 2)

    # ── Commentaires ────────────────────────────────────────
    def test_commentaire_credite_l_auteur(self):
        pub = self._contribution()
        self._auth('l@fid.cm')
        self.api.post(
            f'/api/client/publications/{pub.pk}/commentaires',
            {'texte': 'Superbe !'}, format='json',
        )
        self.assertEqual(self._solde(), self.config.points_par_commentaire)

    def test_commenter_sa_propre_publication_ne_rapporte_rien(self):
        pub = self._contribution()
        self._auth('a@fid.cm')
        self.api.post(
            f'/api/client/publications/{pub.pk}/commentaires',
            {'texte': 'Moi-même'}, format='json',
        )
        self.assertEqual(self._solde(), 0)

    def test_deux_commentaires_creditent_deux_fois(self):
        pub = self._contribution()
        self._auth('l@fid.cm')
        for texte in ('Un', 'Deux'):
            self.api.post(
                f'/api/client/publications/{pub.pk}/commentaires',
                {'texte': texte}, format='json',
            )
        self.assertEqual(self._solde(), self.config.points_par_commentaire * 2)

    # ── Suppression douce vs définitive ─────────────────────
    def test_suppression_douce_conserve_les_points(self):
        """Le restaurant masque la publication : le contributeur garde son dû."""
        pub = self._contribution(statut='en_attente')
        fidelite.crediter_publication_validee(pub)
        acquis = self._solde()

        web = Client()
        web.force_login(self.resto_user)
        web.post(f'/admin-panel/resto/publications/{pub.pk}/supprimer/')
        self.assertEqual(self._solde(), acquis)

    def test_suppression_definitive_reprend_les_points(self):
        pub = self._contribution(statut='en_attente')
        fidelite.crediter_publication_validee(pub)
        self._auth('l@fid.cm')
        self.api.post(f'/api/client/publications/{pub.pk}/like')
        self.assertGreater(self._solde(), 0)

        admin = User.objects.create_user(
            username='adm@fid.cm', email='adm@fid.cm', password='pass1234', role='admin',
        )
        web = Client()
        web.force_login(admin)
        web.post('/admin-panel/publications/', {
            'publication_id': pub.pk, 'action': 'supprimer_definitivement',
        })
        self.assertEqual(self._solde(), 0)
        self.assertFalse(Publication.objects.filter(pk=pub.pk).exists())

    # ── Niveaux ─────────────────────────────────────────────
    def test_seuils_de_niveau(self):
        self.assertEqual(fidelite.niveau(0), 'bronze')
        self.assertEqual(fidelite.niveau(self.config.seuil_argent - 1), 'bronze')
        self.assertEqual(fidelite.niveau(self.config.seuil_argent), 'argent')
        self.assertEqual(fidelite.niveau(self.config.seuil_or), 'or')

    def test_modifier_un_seuil_reclasse_sans_migration(self):
        self.assertEqual(fidelite.niveau(100), 'bronze')
        self.config.seuil_argent = 50
        self.config.save(update_fields=['seuil_argent'])
        self.assertEqual(fidelite.niveau(100), 'argent')

    def test_programme_inactif_ne_credite_plus(self):
        self.config.actif = False
        self.config.save(update_fields=['actif'])
        pub = self._contribution()
        self._auth('l@fid.cm')
        self.api.post(f'/api/client/publications/{pub.pk}/like')
        self.assertEqual(self._solde(), 0)

    # ── Cohérence du cache ──────────────────────────────────
    def test_le_solde_reste_aligne_sur_le_grand_livre(self):
        pub = self._contribution(statut='en_attente')
        fidelite.crediter_publication_validee(pub)
        self._auth('l@fid.cm')
        self.api.post(f'/api/client/publications/{pub.pk}/like')
        self.assertEqual(self._solde(), fidelite.solde_reel(self.auteur))

    def test_graines_de_fil_distinctes_par_utilisateur(self):
        """Deux utilisateurs ne doivent pas partager le même ordre de fil."""
        self.assertNotEqual(self.auteur.feed_seed, self.liker.feed_seed)

    def test_conversion_points_vers_fcfa(self):
        self.assertEqual(self.config.points_vers_fcfa(99), 0)
        self.assertEqual(
            self.config.points_vers_fcfa(self.config.points_par_unite),
            self.config.valeur_unite,
        )


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class ModerationAdminTests(TestCase):
    """L'admin voit tout et détruit ; personne d'autre."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='adm@mod.cm', email='adm@mod.cm', password='pass1234', role='admin',
        )
        self.client_user = User.objects.create_user(
            username='c@mod.cm', email='c@mod.cm', password='pass1234', role='client',
        )
        self.resto_user = User.objects.create_user(
            username='r@mod.cm', email='r@mod.cm', password='pass1234', role='restaurant',
        )
        self.resto = RestaurantProfile.objects.create(
            user=self.resto_user, nom='Resto Mod', adresse='Douala', ville='Douala',
            is_open=True, is_verified=True,
        )
        self.pub = Publication.objects.create(
            restaurant=self.resto, auteur=self.client_user, texte='Contenu', statut='publiee',
        )
        self.web = Client()

    def test_admin_voit_les_publications_supprimees(self):
        """Invisibles partout ailleurs, elles restent listées ici."""
        self.pub.supprime_par = 'client'
        self.pub.save(update_fields=['supprime_par'])
        self.web.force_login(self.admin)
        page = self.web.get('/admin-panel/publications/?etat=supprimees')
        self.assertEqual(page.status_code, 200)
        self.assertIn(self.pub.pk, [p.pk for p in page.context['page_obj']])

    def test_suppression_definitive_journalisee(self):
        self.web.force_login(self.admin)
        self.web.post('/admin-panel/publications/', {
            'publication_id': self.pub.pk, 'action': 'supprimer_definitivement',
        })
        self.assertFalse(Publication.objects.filter(pk=self.pub.pk).exists())
        # La trace doit survivre à l'objet détruit.
        trace = AuditLog.objects.filter(action='PUBLICATION_SUPPRESSION_DEFINITIVE').first()
        self.assertIsNotNone(trace)
        self.assertEqual(trace.object_id, str(self.pub.pk))
        self.assertEqual(trace.description['texte'], 'Contenu')

    def test_restauration_reaffiche_la_publication(self):
        self.pub.supprime_par = 'restaurant'
        self.pub.save(update_fields=['supprime_par'])
        self.web.force_login(self.admin)
        self.web.post('/admin-panel/publications/', {
            'publication_id': self.pub.pk, 'action': 'restaurer',
        })
        self.pub.refresh_from_db()
        self.assertEqual(self.pub.supprime_par, '')

    def test_admin_supprime_un_commentaire(self):
        """Suppression douce : masquée partout, mais la ligne survit — sinon
        les points gagnés grâce à ce commentaire deviendraient irrécupérables."""
        com = PublicationCommentaire.objects.create(
            publication=self.pub, auteur=self.client_user, texte='À modérer',
        )
        self.web.force_login(self.admin)
        self.web.post('/admin-panel/publications/', {
            'commentaire_id': com.pk, 'action': 'supprimer_commentaire',
        })
        com.refresh_from_db()
        self.assertEqual(com.supprime_par, 'admin')
        self.assertIsNotNone(com.supprime_le)
        self.assertTrue(
            AuditLog.objects.filter(action='COMMENTAIRE_SUPPRESSION_ADMIN').exists(),
        )

    def test_commentaire_masque_par_l_admin_disparait_de_l_api(self):
        com = PublicationCommentaire.objects.create(
            publication=self.pub, auteur=self.client_user, texte='À modérer',
        )
        self.web.force_login(self.admin)
        self.web.post('/admin-panel/publications/', {
            'commentaire_id': com.pk, 'action': 'supprimer_commentaire',
        })
        api = APIClient()
        data = api.get(f'/api/client/publications/{self.pub.pk}').json()
        self.assertEqual(data['commentaires'], [])

    def test_un_client_ne_peut_pas_acceder_a_la_moderation(self):
        self.web.force_login(self.client_user)
        self.assertEqual(self.web.get('/admin-panel/publications/').status_code, 302)

    def test_un_restaurant_ne_peut_pas_detruire(self):
        self.web.force_login(self.resto_user)
        self.web.post('/admin-panel/publications/', {
            'publication_id': self.pub.pk, 'action': 'supprimer_definitivement',
        })
        self.assertTrue(Publication.objects.filter(pk=self.pub.pk).exists())

    def test_parametrage_fidelite_modifiable(self):
        self.web.force_login(self.admin)
        res = self.web.post('/admin-panel/fidelite/', {
            'points_publication_validee': 10, 'points_par_like': 2,
            'points_par_commentaire': 3, 'points_par_unite': 200, 'valeur_unite': 1000,
            'seuil_minimum_conversion': 200, 'reduction_max_pourcentage': 25,
            'seuil_bronze': 0, 'seuil_argent': 300, 'seuil_or': 1500, 'actif': 'on',
        })
        self.assertEqual(res.status_code, 302)
        config = ParametrageFidelite.get_solo()
        self.assertEqual(config.points_publication_validee, 10)
        self.assertEqual(config.seuil_argent, 300)
        self.assertTrue(AuditLog.objects.filter(action='FIDELITE_PARAMETRAGE').exists())

    def test_parametrage_refuse_des_valeurs_invalides(self):
        self.web.force_login(self.admin)
        self.web.post('/admin-panel/fidelite/', {
            'points_publication_validee': -5, 'points_par_like': 1,
            'points_par_commentaire': 2, 'points_par_unite': 100, 'valeur_unite': 500,
            'seuil_minimum_conversion': 100, 'reduction_max_pourcentage': 30,
            'seuil_bronze': 0, 'seuil_argent': 500, 'seuil_or': 2000,
        })
        self.assertEqual(ParametrageFidelite.get_solo().points_publication_validee, 5)
