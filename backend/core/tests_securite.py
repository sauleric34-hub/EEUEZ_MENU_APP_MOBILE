"""Tests de sécurité : contrôles d'accès sur les actions sensibles."""

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.test import TestCase

from core.models import RestaurantProfile, Commande, Livraison

User = get_user_model()


class MissionsLivreurTests(TestCase):
    """Les actions de livraison déplacent de l'argent : elles doivent être
    réservées au livreur RÉELLEMENT assigné à la mission."""

    def setUp(self):
        patron = User.objects.create_user(username='resto', password='x', role='restaurant')
        self.restaurant = RestaurantProfile.objects.create(
            user=patron, nom='Test', ville='Douala', adresse='Akwa',
            frais_livraison=1000,
        )
        self.client_final = User.objects.create_user(
            username='client', password='x', role='client',
        )
        self.livreur = User.objects.create_user(
            username='livreur', password='x', role='livreur',
        )
        self.autre_livreur = User.objects.create_user(
            username='livreur2', password='x', role='livreur',
        )
        self.commande = Commande.objects.create(
            client=self.client_final, restaurant=self.restaurant,
            montant_total=5000, frais_livraison=1000, part_livreur=700,
            statut='en_livraison',
        )
        self.livraison = Livraison.objects.create(
            commande=self.commande, livreur=self.livreur, statut='en_collecte',
        )

    def _api(self, utilisateur):
        api = APIClient()
        api.force_authenticate(user=utilisateur)
        return api

    def _url(self, action):
        return f'/api/livreur/missions/{self.commande.pk}/{action}/'

    # ── Le cœur du problème : le livreur ne finalise jamais seul ──
    def test_le_livreur_ne_peut_pas_finaliser_sans_le_client(self):
        """La finalisation (crédit + déblocage argent resto) passe uniquement
        par le client (code/QR) ou un admin. Aucune route livreur ne crédite."""
        self.livraison.statut = 'en_livraison'
        self.livraison.save(update_fields=['statut'])
        # Il n'existe plus aucune action livreur « delivered ».
        rep = self._api(self.livreur).post(self._url('delivered'))
        self.assertIn(rep.status_code, (404, 405))
        self.livreur.refresh_from_db()
        self.assertEqual(float(self.livreur.gain_total), 0.0)

    def test_un_livreur_ne_peut_pas_piloter_la_mission_d_un_autre(self):
        rep = self._api(self.autre_livreur).post(self._url('recuperer'))
        self.assertEqual(rep.status_code, 404)
        self.autre_livreur.refresh_from_db()
        self.assertEqual(float(self.autre_livreur.gain_total), 0.0)

    def test_un_client_ne_peut_pas_collecter(self):
        rep = self._api(self.client_final).post(self._url('depart'))
        self.assertIn(rep.status_code, (403, 404))

    def test_un_client_ne_peut_pas_s_attribuer_une_mission(self):
        libre = Commande.objects.create(
            client=self.client_final, restaurant=self.restaurant,
            montant_total=3000, statut='prete',
        )
        rep = self._api(self.client_final).post(
            f'/api/livreur/missions/{libre.pk}/accept/'
        )
        self.assertEqual(rep.status_code, 403)
        self.assertFalse(Livraison.objects.filter(commande=libre).exists())

    def test_un_anonyme_est_refuse(self):
        self.assertIn(APIClient().post(self._url('recuperer')).status_code, (401, 403))

    def test_un_livreur_desactive_est_refuse(self):
        self.livreur.is_active = False
        self.livreur.save(update_fields=['is_active'])
        rep = self._api(self.livreur).post(self._url('depart'))
        self.assertIn(rep.status_code, (401, 403))

    # ── Le parcours légitime ────────────────────────────────
    def test_parcours_complet_avec_confirmation_client(self):
        api = self._api(self.livreur)
        self.livraison.statut = 'assignee'
        self.livraison.save(update_fields=['statut'])

        self.assertEqual(api.post(self._url('depart')).status_code, 200)
        rep = api.post(self._url('recuperer'))
        self.assertEqual(rep.status_code, 200)
        code = rep.json()['code_confirmation']
        self.assertTrue(code)

        # Toujours rien crédité tant que le client n'a pas confirmé.
        self.livreur.refresh_from_db()
        self.assertEqual(float(self.livreur.gain_total), 0.0)

        rep = self._api(self.client_final).post(
            f'/api/client/commandes/{self.commande.pk}/confirmer_reception/', {'code': code},
        )
        self.assertEqual(rep.status_code, 200)
        self.livraison.refresh_from_db()
        self.livreur.refresh_from_db()
        self.assertEqual(self.livraison.statut, 'livree')
        self.assertAlmostEqual(float(self.livreur.gain_total), 700.0, places=2)

    def test_livree_sans_code_ne_credite_pas(self):
        self.livraison.statut = 'en_livraison'
        self.livraison.save(update_fields=['statut'])
        rep = self._api(self.livreur).post(
            self._url('livrer_sans_code'), {'motif': 'Client injoignable'},
        )
        self.assertEqual(rep.status_code, 200)
        self.livraison.refresh_from_db()
        self.livreur.refresh_from_db()
        self.assertEqual(self.livraison.statut, 'livree_sans_code')
        self.assertEqual(float(self.livreur.gain_total), 0.0)
        # L'argent du restaurant reste gelé : la commande n'est pas « livree ».
        self.commande.refresh_from_db()
        self.assertNotEqual(self.commande.statut, 'livree')


class UploadMediasTests(TestCase):
    """Les fichiers envoyés sont servis depuis le domaine du site : un format
    interprétable par le navigateur y deviendrait un XSS stocké."""

    def _fichier(self, nom, contenu=b'x', ctype=None):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return SimpleUploadedFile(nom, contenu, content_type=ctype)

    def _valider(self, *fichiers):
        from core.publications_utils import valider_medias
        return valider_medias(list(fichiers))

    def test_refuse_le_html(self):
        erreur = self._valider(
            self._fichier('page.html', b'<script>alert(1)</script>', 'text/html'),
        )
        self.assertIsNotNone(erreur, 'un .html ne doit jamais être accepté')

    def test_refuse_le_svg(self):
        """Un SVG peut embarquer du JavaScript."""
        contenu = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        self.assertIsNotNone(
            self._valider(self._fichier('image.svg', contenu, 'image/svg+xml')),
        )

    def test_refuse_une_extension_deguisee(self):
        """Nom d'image mais type déclaré exécutable : on refuse quand même."""
        self.assertIsNotNone(
            self._valider(self._fichier('photo.jpg', b'x', 'text/html')),
        )

    def test_refuse_un_script(self):
        self.assertIsNotNone(self._valider(self._fichier('x.js', b'alert(1)', 'text/javascript')))

    def test_refuse_une_image_trop_lourde(self):
        from core.publications_utils import MAX_TAILLE_IMAGE_MO
        gros = self._fichier(
            'photo.jpg', b'x' * (MAX_TAILLE_IMAGE_MO * 1024 * 1024 + 1), 'image/jpeg',
        )
        self.assertIsNotNone(self._valider(gros))

    def test_accepte_les_formats_legitimes(self):
        self.assertIsNone(self._valider(self._fichier('photo.jpg', b'x', 'image/jpeg')))
        self.assertIsNone(self._valider(self._fichier('photo.png', b'x', 'image/png')))
        self.assertIsNone(self._valider(self._fichier('clip.mp4', b'x', 'video/mp4')))
