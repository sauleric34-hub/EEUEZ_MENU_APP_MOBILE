"""Tests des dérivés d'image : aperçu allégé et placeholder flou."""

from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, Client
from PIL import Image as PILImage

from core.models import RestaurantProfile, Plat
from core.models_publications import Publication, PublicationMedia
from core.medias_utils import LARGEUR_APERCU

User = get_user_model()


def image_factice(largeur=3000, hauteur=2000, format='JPEG', mode='RGB'):
    """Fabrique une image en mémoire, façon photo de téléphone."""
    image = PILImage.new(mode, (largeur, hauteur), (200, 120, 60))
    tampon = BytesIO()
    image.save(tampon, format=format)
    return tampon.getvalue()


class DerivesMediaTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(username='resto', password='x')
        self.restaurant = RestaurantProfile.objects.create(
            user=user, nom='Test', ville='Douala', adresse='Akwa',
        )
        self.publication = Publication.objects.create(
            restaurant=self.restaurant, auteur=user, texte='Bonjour',
        )

    def _media(self, contenu, nom='photo.jpg', type='image'):
        return PublicationMedia.objects.create(
            publication=self.publication, type=type,
            fichier=SimpleUploadedFile(nom, contenu, content_type='image/jpeg'),
        )

    def test_apercu_genere_et_redimensionne(self):
        media = self._media(image_factice())
        self.assertTrue(media.apercu, "l'aperçu doit être généré")
        media.apercu.open()
        image = PILImage.open(media.apercu)
        self.assertEqual(image.width, LARGEUR_APERCU)
        self.assertEqual(image.height, round(2000 * LARGEUR_APERCU / 3000))

    def test_apercu_beaucoup_plus_leger_que_l_original(self):
        """Le point de tout l'exercice : moins d'octets à télécharger."""
        media = self._media(image_factice())
        self.assertLess(
            media.apercu.size, media.fichier.size / 2,
            "l'aperçu doit peser nettement moins que l'original",
        )

    def test_petite_image_non_agrandie(self):
        """Une image déjà petite ne doit pas être étirée."""
        media = self._media(image_factice(largeur=400, hauteur=300))
        media.apercu.open()
        self.assertEqual(PILImage.open(media.apercu).width, 400)

    def test_flou_genere_et_minuscule(self):
        media = self._media(image_factice())
        self.assertTrue(media.flou.startswith('data:image/jpeg;base64,'))
        # Il voyage dans chaque réponse du fil : il doit rester sous le Ko.
        self.assertLess(len(media.flou), 1024)

    def test_png_transparent_ne_devient_pas_noir(self):
        """Sans aplatissement sur fond blanc, la transparence vire au noir."""
        contenu = image_factice(largeur=100, hauteur=100, format='PNG', mode='RGBA')
        media = self._media(contenu, nom='logo.png')
        media.apercu.open()
        image = PILImage.open(media.apercu)
        self.assertEqual(image.mode, 'RGB')

    def test_fichier_illisible_ne_casse_pas_la_publication(self):
        """Un fichier corrompu doit passer en silence, pas faire échouer l'envoi."""
        media = self._media(b'ceci nest pas une image')
        self.assertFalse(media.apercu)
        self.assertEqual(media.flou, '')
        # Le repli sert alors l'original.
        self.assertEqual(media.url_affichage, media.fichier.url)

    def test_video_ignoree(self):
        media = self._media(b'donnees video', nom='clip.mp4', type='video')
        self.assertFalse(media.apercu)
        self.assertEqual(media.url_affichage, media.fichier.url)

    def test_url_affichage_privilegie_l_apercu(self):
        media = self._media(image_factice())
        self.assertEqual(media.url_affichage, media.apercu.url)
        self.assertNotEqual(media.url_affichage, media.fichier.url)

    def test_plat_recoit_aussi_un_apercu(self):
        """Le mixin sert les trois modèles porteurs d'image."""
        plat = Plat.objects.create(
            restaurant=self.restaurant, nom='Ndole', prix=2000,
            image=SimpleUploadedFile('p.jpg', image_factice(), content_type='image/jpeg'),
        )
        self.assertTrue(plat.apercu)
        self.assertTrue(plat.flou.startswith('data:image/jpeg;base64,'))
        self.assertEqual(plat.url_affichage, plat.apercu.url)

    def test_apercus_ranges_par_modele(self):
        """Un plat et un média de même identifiant ne doivent pas se marcher
        dessus dans le stockage."""
        plat = Plat.objects.create(
            restaurant=self.restaurant, nom='Ndole', prix=2000,
            image=SimpleUploadedFile('p.jpg', image_factice(), content_type='image/jpeg'),
        )
        media = self._media(image_factice())
        self.assertIn('apercus/plat/', plat.apercu.name)
        self.assertIn('apercus/publicationmedia/', media.apercu.name)

    def test_commande_de_rattrapage(self):
        """Les images publiées avant l'optimisation doivent pouvoir être
        rattrapées sans réenvoi."""
        from django.core.management import call_command
        from io import StringIO

        media = self._media(image_factice())
        # Simule un média d'avant l'optimisation.
        PublicationMedia.objects.filter(pk=media.pk).update(apercu='', flou='')

        call_command('generer_apercus', '--modele', 'publicationmedia', stdout=StringIO())

        media.refresh_from_db()
        self.assertTrue(media.apercu, "le rattrapage doit générer l'aperçu")

    def test_pas_de_regeneration_a_chaque_sauvegarde(self):
        """save() ne doit pas refabriquer l'aperçu indéfiniment."""
        media = self._media(image_factice())
        premier = media.apercu.name
        media.save()
        media.refresh_from_db()
        self.assertEqual(media.apercu.name, premier)


class WorkspaceAdminMediasTests(TestCase):
    """Le workspace admin doit permettre de VOIR les médias pour modérer."""

    def setUp(self):
        from core.models import RestaurantProfile
        admin = User.objects.create_user(username='adm', password='x', role='admin')
        patron = User.objects.create_user(username='r', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Test', ville='Douala', adresse='Akwa',
        )
        self.pub = Publication.objects.create(
            restaurant=self.resto, texte='Bonjour', statut='publiee',
        )
        self.photo = PublicationMedia.objects.create(
            publication=self.pub, type='image',
            fichier=SimpleUploadedFile('p.jpg', image_factice(), content_type='image/jpeg'),
        )
        self.video = PublicationMedia.objects.create(
            publication=self.pub, type='video',
            fichier=SimpleUploadedFile('v.mp4', b'donnees', content_type='video/mp4'),
        )
        self.navigateur = Client()
        self.navigateur.force_login(admin)

    def test_le_detail_montre_photo_et_video(self):
        page = self.navigateur.get(f'/admin-panel/publications/{self.pub.pk}/')
        self.assertEqual(page.status_code, 200)
        contenu = page.content.decode()
        self.assertIn(self.video.fichier.url, contenu)
        self.assertIn(self.photo.url_affichage, contenu)

    def test_la_video_est_lisible(self):
        """Sans l'attribut controls, la modération ne peut pas visionner."""
        contenu = self.navigateur.get(
            f'/admin-panel/publications/{self.pub.pk}/'
        ).content.decode()
        balise = contenu[contenu.index('<video'):contenu.index('</video>')]
        self.assertIn('controls', balise)

    def test_la_liste_montre_un_apercu(self):
        contenu = self.navigateur.get('/admin-panel/publications/').content.decode()
        self.assertIn(self.photo.url_affichage, contenu)
