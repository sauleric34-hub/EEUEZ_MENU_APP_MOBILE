"""Changement de mot de passe par code e-mail (OTP) et e-mail de bienvenue."""
import re
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import CodeVerification, User
from .tests import NO_THROTTLE


@override_settings(REST_FRAMEWORK=NO_THROTTLE, EMAIL_ASYNC=False,
                   EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class ChangementMotDePasseTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='c@mdp.cm', email='c@mdp.cm', password='ancien123', role='client', first_name='Awa',
        )
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def _code_envoye(self):
        corps = mail.outbox[-1].body
        return re.search(r'\b(\d{6})\b', corps).group(1)

    def test_parcours_complet(self):
        r = self.api.post('/api/client/compte/mot-de-passe/code')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['email'], 'c•••@mdp.cm')
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertIn('code de vérification', message.subject)
        self.assertTrue(any(ct == 'text/html' for _, ct in message.alternatives))
        code = self._code_envoye()
        # Le code n'est jamais stocké en clair
        self.assertNotIn(code, CodeVerification.objects.get().code_hache)

        self.assertEqual(self.api.post('/api/client/compte/mot-de-passe/verifier', {'code': code}).status_code, 200)
        r = self.api.post('/api/client/compte/mot-de-passe', {'code': code, 'nouveau': 'nouveau456'})
        self.assertEqual(r.status_code, 200)
        self.assertIn('token', r.json())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('nouveau456'))
        # E-mail de confirmation (alerte de sécurité)
        self.assertIn('modifié', mail.outbox[-1].subject)
        # Le code ne resert pas
        r = self.api.post('/api/client/compte/mot-de-passe', {'code': code, 'nouveau': 'autre7890'})
        self.assertEqual(r.status_code, 400)

    def test_renvoi_trop_rapide_refuse(self):
        self.api.post('/api/client/compte/mot-de-passe/code')
        r = self.api.post('/api/client/compte/mot-de-passe/code')
        self.assertEqual(r.status_code, 400)
        self.assertIn('attente', r.json())
        self.assertEqual(len(mail.outbox), 1)

    def test_essais_limites(self):
        self.api.post('/api/client/compte/mot-de-passe/code')
        bon = self._code_envoye()
        faux = '000000' if bon != '000000' else '111111'
        for _ in range(5):
            r = self.api.post('/api/client/compte/mot-de-passe/verifier', {'code': faux})
            self.assertEqual(r.status_code, 400)
        # Même le bon code est refusé une fois les essais épuisés
        r = self.api.post('/api/client/compte/mot-de-passe/verifier', {'code': bon})
        self.assertEqual(r.status_code, 400)
        self.assertIn('Trop', r.json()['error'])

    def test_code_expire(self):
        self.api.post('/api/client/compte/mot-de-passe/code')
        code = self._code_envoye()
        CodeVerification.objects.update(expire_le=timezone.now() - timedelta(seconds=1))
        r = self.api.post('/api/client/compte/mot-de-passe/verifier', {'code': code})
        self.assertEqual(r.status_code, 400)
        self.assertIn('expiré', r.json()['error'])

    def test_nouveau_mot_de_passe_valide(self):
        self.api.post('/api/client/compte/mot-de-passe/code')
        code = self._code_envoye()
        self.assertEqual(self.api.post('/api/client/compte/mot-de-passe', {'code': code, 'nouveau': '123'}).status_code, 400)
        r = self.api.post('/api/client/compte/mot-de-passe', {'code': code, 'nouveau': 'ancien123'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('différent', r.json()['error'])

    def test_non_connecte_refuse(self):
        self.assertIn(APIClient().post('/api/client/compte/mot-de-passe/code').status_code, (401, 403))


@override_settings(REST_FRAMEWORK=NO_THROTTLE, EMAIL_ASYNC=False,
                   EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class EmailBienvenueTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_inscription_envoie_un_email_de_bienvenue(self):
        r = APIClient().post('/api/auth/register/client', {
            'email': 'nouveau@client.cm', 'password': 'secret123', 'first_name': 'Kofi', 'ville': 'Douala',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['nouveau@client.cm'])
        self.assertIn('Bienvenue', message.subject)
        html = message.alternatives[0][0]
        self.assertIn('Kofi', html)

    def test_page_de_rebond_plat(self):
        self.assertEqual(self.client.get('/plat/999999/').status_code, 404)


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class ProfilCompletTests(TestCase):
    def test_localisation_et_retrait_photo(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        user = User.objects.create_user(username='p@p.cm', email='p@p.cm', password='x123456', role='client')
        user.avatar = SimpleUploadedFile('a.jpg', b'\xff\xd8\xff\xe0' + b'0' * 100, content_type='image/jpeg')
        user.save()
        api = APIClient()
        api.force_authenticate(user)
        r = api.patch('/api/client/profile', {'pays': 'Cameroun', 'pays_code': 'CM', 'ville': 'Douala', 'avatar_supprimer': '1'}, format='multipart')
        self.assertEqual(r.status_code, 200)
        user.refresh_from_db()
        self.assertEqual((user.pays_code, user.ville), ('CM', 'Douala'))
        self.assertFalse(user.avatar)
