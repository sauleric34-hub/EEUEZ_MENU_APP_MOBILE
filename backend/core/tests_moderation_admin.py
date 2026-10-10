"""Modération des publications dans l'espace admin (masquer / restaurer / pages)."""
from django.test import Client, TestCase

from .models import AuditLog, Publication, PublicationCommentaire, RestaurantProfile, User


class ModerationAdminTests(TestCase):
    def setUp(self):
        ur = User.objects.create_user(username='r@md.cm', email='r@md.cm', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(user=ur, nom='Resto MD', adresse='-', ville='Douala',
                                                      is_open=True, is_verified=True, commission_rate=10)
        self.client_user = User.objects.create_user(username='c@md.cm', email='c@md.cm', password='x', role='client', first_name='Awa')
        self.pub = Publication.objects.create(restaurant=self.resto, texte='Bon ndolé', statut='publiee')
        self.com = PublicationCommentaire.objects.create(publication=self.pub, auteur=self.client_user, texte='Miam')
        admin = User.objects.create_user(username='a@md.cm', email='a@md.cm', password='x', role='admin')
        self.web = Client(); self.web.force_login(admin)

    def test_pages(self):
        r = self.web.get('/admin-panel/publications/?etat=visibles&tri=engagement')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.context['compteurs']['visibles'], 1)
        self.assertEqual(self.web.get(f'/admin-panel/publications/{self.pub.pk}/').status_code, 200)

    def test_masquer_est_reversible_et_journalise(self):
        detail = f'/admin-panel/publications/{self.pub.pk}/'
        r = self.web.post('/admin-panel/publications/', {'publication_id': self.pub.pk, 'action': 'masquer', 'next': detail})
        self.assertRedirects(r, detail, fetch_redirect_response=False)
        self.pub.refresh_from_db()
        self.assertEqual(self.pub.supprime_par, 'admin')
        self.assertNotIn(self.pub, Publication.objects.visibles())
        self.assertTrue(AuditLog.objects.filter(action='PUBLICATION_MASQUEE_ADMIN').exists())
        self.web.post('/admin-panel/publications/', {'publication_id': self.pub.pk, 'action': 'restaurer'})
        self.pub.refresh_from_db()
        self.assertEqual(self.pub.supprime_par, '')

    def test_masquer_un_commentaire_revient_sur_la_fiche(self):
        detail = f'/admin-panel/publications/{self.pub.pk}/'
        r = self.web.post('/admin-panel/publications/', {'commentaire_id': self.com.pk, 'action': 'supprimer_commentaire', 'next': detail})
        self.assertRedirects(r, detail, fetch_redirect_response=False)
        self.com.refresh_from_db()
        self.assertEqual(self.com.supprime_par, 'admin')
        page = self.web.get(detail)
        self.assertContains(page, "Supprimé par l&#x27;administrateur")

    def test_next_externe_ignore(self):
        r = self.web.post('/admin-panel/publications/', {'publication_id': self.pub.pk, 'action': 'masquer', 'next': 'https://evil.example/'})
        self.assertRedirects(r, '/admin-panel/publications/', fetch_redirect_response=False)
