"""Tests du fil de publications (lot 1).

Couvre les garanties structurantes : visibilité, immutabilité, suppression
douce, stabilité de la pagination et autorisations.
"""

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings, Client
from rest_framework.test import APIClient

from .models import (
    User, RestaurantProfile, Plat, Categorie,
    Publication, PublicationLike, PublicationCommentaire,
)
from .tests import NO_THROTTLE


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class PublicationsApiTests(TestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(
            username='c@pub.cm', email='c@pub.cm', password='pass1234', role='client',
        )
        self.autre_client = User.objects.create_user(
            username='c2@pub.cm', email='c2@pub.cm', password='pass1234', role='client',
        )
        self.resto_user = User.objects.create_user(
            username='r@pub.cm', email='r@pub.cm', password='pass1234', role='restaurant',
        )
        self.resto = RestaurantProfile.objects.create(
            user=self.resto_user, nom='Resto Pub', adresse='Douala', ville='Douala',
            is_open=True, is_verified=True, commission_rate=10,
        )
        cat = Categorie.objects.create(nom='Grillades')
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='Poulet Pub', prix=3000,
            is_available=True, is_visible=True,
        )
        self.api = APIClient()

    def _auth(self, email='c@pub.cm'):
        tok = self.api.post(
            '/api/auth/login', {'email': email, 'password': 'pass1234'}, format='json',
        ).json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")
        return tok

    def _publication(self, **kw):
        params = {'restaurant': self.resto, 'texte': 'Bonjour', 'statut': 'publiee'}
        params.update(kw)
        return Publication.objects.create(**params)

    # ── Visibilité ──────────────────────────────────────────
    def test_feed_public_sans_compte(self):
        self._publication()
        res = self.api.get('/api/client/publications/feed')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()['resultats']), 1)

    def test_feed_masque_les_non_publiees(self):
        self._publication(statut='en_attente', auteur=self.client_user)
        self._publication(statut='refusee', auteur=self.client_user)
        visible = self._publication()
        res = self.api.get('/api/client/publications/feed')
        self.assertEqual([p['id'] for p in res.json()['resultats']], [visible.pk])

    def test_suppression_douce_masque_mais_conserve(self):
        """Supprimé par le client OU le restaurant : invisible dans l'app,
        mais la ligne survit en base pour l'administrateur."""
        for par in ('client', 'restaurant'):
            pub = self._publication(supprime_par=par)
            res = self.api.get('/api/client/publications/feed')
            self.assertNotIn(pub.pk, [p['id'] for p in res.json()['resultats']])
            self.assertEqual(
                self.api.get(f'/api/client/publications/{pub.pk}').status_code, 404,
            )
            self.assertTrue(Publication.objects.filter(pk=pub.pk).exists())

    # ── Immutabilité ────────────────────────────────────────
    def test_aucune_route_de_modification(self):
        pub = self._publication()
        self._auth()
        for verbe in (self.api.put, self.api.patch):
            res = verbe(
                f'/api/client/publications/{pub.pk}', {'texte': 'pirate'}, format='json',
            )
            self.assertIn(res.status_code, (404, 405))

    def test_garde_fou_modele_refuse_edition(self):
        pub = self._publication()
        pub.texte = 'modifié'
        with self.assertRaises(ValidationError):
            pub.save(update_fields=['texte'])

    def test_garde_fou_refuse_un_save_complet(self):
        """Un save() sans « update_fields » réécrit TOUTES les colonnes, texte
        compris : c'est le chemin de modification le plus courant, il doit être
        refusé au même titre qu'une édition explicite."""
        pub = self._publication()
        pub.texte = 'modifié en douce'
        with self.assertRaises(ValidationError):
            pub.save()
        pub.refresh_from_db()
        self.assertEqual(pub.texte, 'Bonjour')

    # ── Lien de partage ─────────────────────────────────────
    def test_page_de_rebond_pointe_vers_l_app(self):
        pub = self._publication()
        page = Client().get(f'/publication/{pub.pk}/')
        self.assertEqual(page.status_code, 200)
        contenu = page.content.decode()
        self.assertIn(f'menu://publication/{pub.pk}', contenu)
        # Métadonnées d'aperçu pour les messageries.
        self.assertIn('og:title', contenu)

    def test_page_de_rebond_404_si_supprimee(self):
        """Un lien partagé ne doit plus rien révéler d'une publication retirée."""
        pub = self._publication()
        pub.supprime_par = 'client'
        pub.save(update_fields=['supprime_par'])
        page = Client().get(f'/publication/{pub.pk}/')
        self.assertEqual(page.status_code, 404)
        self.assertNotIn(pub.texte, page.content.decode())

    def test_champs_de_moderation_restent_modifiables(self):
        pub = self._publication()
        pub.statut = 'refusee'
        pub.save(update_fields=['statut'])   # ne doit pas lever
        pub.refresh_from_db()
        self.assertEqual(pub.statut, 'refusee')

    # ── Likes ───────────────────────────────────────────────
    def test_like_toggle_et_liste(self):
        pub = self._publication()
        self._auth()
        res = self.api.post(f'/api/client/publications/{pub.pk}/like')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['liked'])
        self.assertEqual(res.json()['publications_likees'], [pub.pk])
        self.assertEqual(PublicationLike.objects.filter(publication=pub).count(), 1)

        res = self.api.post(f'/api/client/publications/{pub.pk}/like')
        self.assertFalse(res.json()['liked'])
        self.assertEqual(PublicationLike.objects.filter(publication=pub).count(), 0)

    def test_publications_likees_alimente_la_page_likes(self):
        pub = self._publication()
        self._auth()
        self.api.post(f'/api/client/publications/{pub.pk}/like')
        res = self.api.get('/api/client/publications/likees')
        self.assertEqual([p['id'] for p in res.json()], [pub.pk])

    def test_like_exige_authentification(self):
        pub = self._publication()
        self.assertEqual(
            self.api.post(f'/api/client/publications/{pub.pk}/like').status_code, 401,
        )

    # ── Commentaires ────────────────────────────────────────
    def test_commentaire_creation_puis_suppression_par_auteur(self):
        pub = self._publication()
        self._auth()
        res = self.api.post(
            f'/api/client/publications/{pub.pk}/commentaires',
            {'texte': 'Superbe !'}, format='json',
        )
        self.assertEqual(res.status_code, 201)
        cid = res.json()['id']

        self.assertEqual(self.api.delete(f'/api/client/commentaires/{cid}').status_code, 204)
        commentaire = PublicationCommentaire.objects.get(pk=cid)
        self.assertEqual(commentaire.supprime_par, 'auteur')
        self.assertEqual(
            self.api.get(f'/api/client/publications/{pub.pk}/commentaires').json(), [],
        )

    def test_restaurant_peut_supprimer_un_commentaire(self):
        pub = self._publication()
        commentaire = PublicationCommentaire.objects.create(
            publication=pub, auteur=self.client_user, texte='Coucou',
        )
        self._auth('r@pub.cm')
        self.assertEqual(
            self.api.delete(f'/api/client/commentaires/{commentaire.pk}').status_code, 204,
        )
        commentaire.refresh_from_db()
        self.assertEqual(commentaire.supprime_par, 'restaurant')

    def test_tiers_ne_peut_pas_supprimer_un_commentaire(self):
        pub = self._publication()
        commentaire = PublicationCommentaire.objects.create(
            publication=pub, auteur=self.client_user, texte='Coucou',
        )
        self._auth('c2@pub.cm')
        self.assertEqual(
            self.api.delete(f'/api/client/commentaires/{commentaire.pk}').status_code, 403,
        )
        commentaire.refresh_from_db()
        self.assertEqual(commentaire.supprime_par, '')

    # ── Classement / pagination ─────────────────────────────
    def test_pagination_sans_doublon_ni_trou(self):
        for i in range(25):
            self._publication(texte=f'Publication {i}')

        vus, curseur, page = [], None, 1
        while page <= 5:
            url = f'/api/client/publications/feed?page={page}&taille=10'
            if curseur:
                url += f'&curseur={curseur}'
            data = self.api.get(url).json()
            vus.extend(p['id'] for p in data['resultats'])
            curseur = data['curseur']
            if not data['a_suivant']:
                break
            page += 1

        self.assertEqual(len(vus), len(set(vus)), 'doublons entre les pages')
        self.assertEqual(len(vus), 25, 'publications manquantes')

    def test_nouvelle_publication_ne_decale_pas_les_pages(self):
        """Le curseur fige la borne de date : une publication créée pendant le
        défilement ne doit pas s'insérer dans le parcours en cours."""
        for i in range(15):
            self._publication(texte=f'P{i}')

        p1 = self.api.get('/api/client/publications/feed?page=1&taille=10').json()
        curseur = p1['curseur']
        self._publication(texte='Intruse')

        p2 = self.api.get(
            f'/api/client/publications/feed?page=2&taille=10&curseur={curseur}'
        ).json()
        tous = [p['id'] for p in p1['resultats']] + [p['id'] for p in p2['resultats']]
        self.assertEqual(len(tous), len(set(tous)))
        self.assertEqual(len(tous), 15)

    def test_ordre_reproductible_et_different_par_utilisateur(self):
        for i in range(20):
            self._publication(texte=f'P{i}')

        self._auth('c@pub.cm')
        a1 = [p['id'] for p in self.api.get(
            '/api/client/publications/feed?taille=20').json()['resultats']]
        a2 = [p['id'] for p in self.api.get(
            '/api/client/publications/feed?taille=20').json()['resultats']]
        self._auth('c2@pub.cm')
        b1 = [p['id'] for p in self.api.get(
            '/api/client/publications/feed?taille=20').json()['resultats']]

        self.assertEqual(a1, a2, 'le classement doit être reproductible')
        self.assertNotEqual(a1, b1, 'deux utilisateurs doivent voir un ordre différent')

    # ── Contenu exposé ──────────────────────────────────────
    def test_plat_associe_expose_dans_le_fil(self):
        self._publication(plat=self.plat)
        data = self.api.get('/api/client/publications/feed').json()['resultats'][0]
        self.assertIsNotNone(data['plat_details'])
        self.assertEqual(data['plat_details']['id'], self.plat.pk)
        self.assertGreaterEqual(data['plat_details']['prix'], int(self.plat.prix))

    def test_auteur_expose_sans_email(self):
        """La pastille auteur ne doit jamais divulguer l'adresse e-mail."""
        self._publication(auteur=self.client_user)
        data = self.api.get('/api/client/publications/feed').json()['resultats'][0]
        auteur = data['auteur_details']
        self.assertIsNotNone(auteur)
        self.assertNotIn('email', auteur)
        self.assertIn('pseudo', auteur)

    # ── Workspace restaurant ────────────────────────────────
    def test_upload_detecte_image_et_video(self):
        web = Client()
        web.force_login(self.resto_user)
        image = SimpleUploadedFile('photo.jpg', b'\xff\xd8\xff\xe0zzz', content_type='image/jpeg')
        video = SimpleUploadedFile('clip.mp4', b'\x00\x00\x00\x18ftypmp42', content_type='video/mp4')
        res = web.post('/admin-panel/resto/publications/nouvelle/', {
            'texte': 'Avec medias', 'medias': [image, video],
        })
        self.assertEqual(res.status_code, 302)
        pub = Publication.objects.filter(restaurant=self.resto).latest('created_at')
        self.assertEqual(sorted(pub.medias.values_list('type', flat=True)), ['image', 'video'])

    def test_restaurant_valide_une_contribution(self):
        pub = self._publication(statut='en_attente', auteur=self.client_user)
        web = Client()
        web.force_login(self.resto_user)
        res = web.post('/admin-panel/resto/publications/', {
            'publication_id': pub.pk, 'action': 'valider',
        })
        self.assertEqual(res.status_code, 302)
        pub.refresh_from_db()
        self.assertEqual(pub.statut, 'publiee')
        ids = [p['id'] for p in self.api.get(
            '/api/client/publications/feed').json()['resultats']]
        self.assertIn(pub.pk, ids)

    def test_restaurant_ne_touche_pas_aux_publications_d_un_autre(self):
        autre_user = User.objects.create_user(
            username='r2@pub.cm', email='r2@pub.cm', password='pass1234', role='restaurant',
        )
        autre_resto = RestaurantProfile.objects.create(
            user=autre_user, nom='Autre', adresse='X', ville='Douala',
            is_open=True, is_verified=True,
        )
        pub = Publication.objects.create(restaurant=autre_resto, texte='Pas touche')
        web = Client()
        web.force_login(self.resto_user)
        self.assertEqual(
            web.post(f'/admin-panel/resto/publications/{pub.pk}/supprimer/').status_code, 404,
        )
        pub.refresh_from_db()
        self.assertEqual(pub.supprime_par, '')

    def test_suppression_par_restaurant_est_douce(self):
        pub = self._publication()
        web = Client()
        web.force_login(self.resto_user)
        res = web.post(f'/admin-panel/resto/publications/{pub.pk}/supprimer/')
        self.assertEqual(res.status_code, 302)
        pub.refresh_from_db()
        self.assertEqual(pub.supprime_par, 'restaurant')
        self.assertIsNotNone(pub.supprime_le)
        self.assertTrue(Publication.objects.filter(pk=pub.pk).exists())


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class ContributionsClientTests(TestCase):
    """Lot 2 : un client propose une publication, le restaurant valide."""

    def setUp(self):
        self.client_user = User.objects.create_user(
            username='c@ctb.cm', email='c@ctb.cm', password='pass1234', role='client',
        )
        self.autre_client = User.objects.create_user(
            username='c2@ctb.cm', email='c2@ctb.cm', password='pass1234', role='client',
        )
        self.resto_user = User.objects.create_user(
            username='r@ctb.cm', email='r@ctb.cm', password='pass1234', role='restaurant',
        )
        self.resto = RestaurantProfile.objects.create(
            user=self.resto_user, nom='Resto Ctb', adresse='Douala', ville='Douala',
            is_open=True, is_verified=True, commission_rate=10,
        )
        cat = Categorie.objects.create(nom='Grillades')
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='Poulet Ctb', prix=3000,
            is_available=True, is_visible=True,
        )
        self.api = APIClient()

    def _auth(self, email='c@ctb.cm'):
        tok = self.api.post(
            '/api/auth/login', {'email': email, 'password': 'pass1234'}, format='json',
        ).json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")

    def _url(self):
        return f'/api/client/restaurants/{self.resto.pk}/publications'

    # ── Création ────────────────────────────────────────────
    def test_contribution_part_en_attente_et_reste_hors_du_fil(self):
        self._auth()
        res = self.api.post(self._url(), {'texte': 'Excellent accueil !'}, format='multipart')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['statut'], 'en_attente')

        pub = Publication.objects.get(pk=res.json()['id'])
        self.assertEqual(pub.auteur, self.client_user)
        self.assertEqual(pub.restaurant, self.resto)

        # Invisible du fil tant qu'elle n'est pas validée.
        ids = [p['id'] for p in self.api.get(
            '/api/client/publications/feed').json()['resultats']]
        self.assertNotIn(pub.pk, ids)

    def test_contribution_avec_medias_et_plat(self):
        self._auth()
        image = SimpleUploadedFile('p.jpg', b'\xff\xd8\xff\xe0zz', content_type='image/jpeg')
        video = SimpleUploadedFile('v.mp4', b'\x00\x00\x00\x18ftyp', content_type='video/mp4')
        res = self.api.post(self._url(), {
            'texte': 'Regardez ça', 'plat_id': self.plat.pk, 'medias': [image, video],
        }, format='multipart')
        self.assertEqual(res.status_code, 201)

        pub = Publication.objects.get(pk=res.json()['id'])
        self.assertEqual(pub.plat, self.plat)
        self.assertEqual(sorted(pub.medias.values_list('type', flat=True)), ['image', 'video'])

    def test_contribution_vide_refusee(self):
        self._auth()
        res = self.api.post(self._url(), {}, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_contribution_exige_authentification(self):
        res = self.api.post(self._url(), {'texte': 'Coucou'}, format='multipart')
        self.assertEqual(res.status_code, 401)

    def test_restaurant_ne_peut_pas_contribuer(self):
        """Le rôle restaurant publie via son workspace, pas via cette route."""
        self._auth('r@ctb.cm')
        res = self.api.post(self._url(), {'texte': 'Moi aussi'}, format='multipart')
        self.assertEqual(res.status_code, 403)

    def test_plat_d_un_autre_restaurant_ignore(self):
        """Un plat qui n'appartient pas au restaurant ciblé n'est pas associé."""
        autre_user = User.objects.create_user(
            username='r3@ctb.cm', email='r3@ctb.cm', password='pass1234', role='restaurant',
        )
        autre_resto = RestaurantProfile.objects.create(
            user=autre_user, nom='Autre', adresse='X', ville='Douala',
            is_open=True, is_verified=True,
        )
        plat_etranger = Plat.objects.create(
            restaurant=autre_resto, nom='Etranger', prix=1000,
            is_available=True, is_visible=True,
        )
        self._auth()
        res = self.api.post(self._url(), {
            'texte': 'Test', 'plat_id': plat_etranger.pk,
        }, format='multipart')
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(Publication.objects.get(pk=res.json()['id']).plat)

    def test_trop_de_medias_refuse(self):
        self._auth()
        fichiers = [
            SimpleUploadedFile(f'p{i}.jpg', b'\xff\xd8\xff', content_type='image/jpeg')
            for i in range(11)
        ]
        res = self.api.post(self._url(), {'texte': 'Trop', 'medias': fichiers}, format='multipart')
        self.assertEqual(res.status_code, 400)
        self.assertIn('10', res.json()['error'])

    # ── Cycle de validation ─────────────────────────────────
    def test_validation_rend_visible_dans_le_fil(self):
        self._auth()
        pid = self.api.post(self._url(), {'texte': 'À valider'}, format='multipart').json()['id']

        web = Client()
        web.force_login(self.resto_user)
        web.post('/admin-panel/resto/publications/', {'publication_id': pid, 'action': 'valider'})

        ids = [p['id'] for p in self.api.get(
            '/api/client/publications/feed').json()['resultats']]
        self.assertIn(pid, ids)

    def test_refus_garde_la_publication_hors_du_fil(self):
        self._auth()
        pid = self.api.post(self._url(), {'texte': 'À refuser'}, format='multipart').json()['id']

        web = Client()
        web.force_login(self.resto_user)
        web.post('/admin-panel/resto/publications/', {'publication_id': pid, 'action': 'refuser'})

        self.assertEqual(Publication.objects.get(pk=pid).statut, 'refusee')
        ids = [p['id'] for p in self.api.get(
            '/api/client/publications/feed').json()['resultats']]
        self.assertNotIn(pid, ids)

    # ── Mes publications ────────────────────────────────────
    def test_mes_publications_montre_tous_les_statuts(self):
        self._auth()
        self.api.post(self._url(), {'texte': 'A'}, format='multipart')
        self.api.post(self._url(), {'texte': 'B'}, format='multipart')
        res = self.api.get('/api/client/publications/mes-publications')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 2)
        self.assertTrue(all(p['statut'] == 'en_attente' for p in res.json()))

    def test_mes_publications_ne_montre_que_les_miennes(self):
        self._auth()
        self.api.post(self._url(), {'texte': 'À moi'}, format='multipart')
        self._auth('c2@ctb.cm')
        self.assertEqual(self.api.get('/api/client/publications/mes-publications').json(), [])

    # ── Suppression par l'auteur ────────────────────────────
    def test_auteur_supprime_sa_publication_partout(self):
        """Suppression douce : disparaît du fil, du profil et du workspace,
        mais la ligne survit pour l'administrateur."""
        self._auth()
        pid = self.api.post(self._url(), {'texte': 'À supprimer'}, format='multipart').json()['id']

        # On la valide pour qu'elle soit dans le fil avant suppression.
        web = Client()
        web.force_login(self.resto_user)
        web.post('/admin-panel/resto/publications/', {'publication_id': pid, 'action': 'valider'})

        self.assertEqual(
            self.api.delete(f'/api/client/publications/{pid}/supprimer').status_code, 204,
        )
        pub = Publication.objects.get(pk=pid)
        self.assertEqual(pub.supprime_par, 'client')
        self.assertIsNotNone(pub.supprime_le)

        # Absente du fil…
        ids = [p['id'] for p in self.api.get(
            '/api/client/publications/feed').json()['resultats']]
        self.assertNotIn(pid, ids)
        # …de mon profil…
        self.assertEqual(self.api.get('/api/client/publications/mes-publications').json(), [])
        # …et du workspace du restaurant.
        page = web.get('/admin-panel/resto/publications/')
        self.assertNotIn(pid, [p.pk for p in page.context['publications']])

    def test_autre_client_ne_peut_pas_supprimer(self):
        self._auth()
        pid = self.api.post(self._url(), {'texte': 'Privée'}, format='multipart').json()['id']
        self._auth('c2@ctb.cm')
        self.assertEqual(
            self.api.delete(f'/api/client/publications/{pid}/supprimer').status_code, 403,
        )
        self.assertEqual(Publication.objects.get(pk=pid).supprime_par, '')
