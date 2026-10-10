"""Connexion Google / Apple : vérification des idTokens et comptes associés."""
import time
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import User
from .tests import NO_THROTTLE

GOOGLE_WEB = 'web-123.apps.googleusercontent.com'
GOOGLE_IOS = 'ios-456.apps.googleusercontent.com'
BUNDLE = 'cm.cambus.menu'

_cle = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_autre_cle = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def jeton(cle=_cle, **claims):
    maintenant = int(time.time())
    contenu = {
        'iss': 'https://accounts.google.com', 'aud': GOOGLE_WEB, 'sub': '1098765',
        'email': 'awa@gmail.com', 'email_verified': True,
        'given_name': 'Awa', 'family_name': 'Mbarga',
        'iat': maintenant, 'exp': maintenant + 3600,
    }
    contenu.update(claims)
    return jwt.encode(contenu, cle, algorithm='RS256')


@override_settings(
    REST_FRAMEWORK=NO_THROTTLE, EMAIL_ASYNC=False,
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    GOOGLE_CLIENT_IDS=[GOOGLE_WEB, GOOGLE_IOS], APPLE_CLIENT_IDS=[BUNDLE],
)
@patch('core.social_auth._cle_publique', lambda fournisseur, j: _cle.public_key())
class ConnexionSocialeTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def _google(self, token, **extra):
        return self.api.post('/api/auth/google', {'id_token': token, **extra}, format='json')

    def test_premiere_connexion_cree_un_compte_client_sans_mot_de_passe(self):
        r = self._google(jeton())
        self.assertEqual(r.status_code, 201)
        corps = r.json()
        self.assertIn('token', corps)
        self.assertIn('refresh', corps)
        self.assertEqual(corps['user']['role'], 'client')
        self.assertFalse(corps['user']['a_mot_de_passe'])
        user = User.objects.get(email='awa@gmail.com')
        self.assertEqual((user.first_name, user.last_name), ('Awa', 'Mbarga'))
        self.assertFalse(user.has_usable_password())

    def test_reconnexion_retrouve_le_meme_compte(self):
        self._google(jeton())
        r = self._google(jeton())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(User.objects.filter(email='awa@gmail.com').count(), 1)

    def test_compte_existant_avec_mot_de_passe_est_relie_par_email(self):
        user = User.objects.create_user(
            username='awa@gmail.com', email='Awa@Gmail.com', password='secret123', role='client',
        )
        r = self._google(jeton())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['user']['id'], user.id)
        self.assertTrue(r.json()['user']['a_mot_de_passe'])

    def test_jeton_ios_accepte(self):
        self.assertEqual(self._google(jeton(aud=GOOGLE_IOS)).status_code, 201)

    def test_jeton_dune_autre_app_refuse(self):
        self.assertEqual(self._google(jeton(aud='autre-app.apps.googleusercontent.com')).status_code, 401)

    def test_signature_falsifiee_refusee(self):
        self.assertEqual(self._google(jeton(cle=_autre_cle)).status_code, 401)

    def test_jeton_expire_refuse(self):
        passe = int(time.time()) - 7200
        self.assertEqual(self._google(jeton(iat=passe, exp=passe + 3600)).status_code, 401)

    def test_mauvais_emetteur_refuse(self):
        self.assertEqual(self._google(jeton(iss='https://evil.example.com')).status_code, 401)

    def test_email_non_verifie_refuse(self):
        self.assertEqual(self._google(jeton(email_verified=False)).status_code, 401)
        self.assertFalse(User.objects.exists())

    def test_jeton_absent_refuse(self):
        self.assertEqual(self.api.post('/api/auth/google', {}, format='json').status_code, 401)

    @override_settings(GOOGLE_CLIENT_IDS=[])
    def test_serveur_non_configure_refuse(self):
        self.assertEqual(self._google(jeton()).status_code, 401)

    def test_compte_livreur_doit_utiliser_son_mot_de_passe(self):
        User.objects.create_user(username='awa@gmail.com', email='awa@gmail.com', password='x', role='livreur')
        self.assertEqual(self._google(jeton()).status_code, 403)

    def test_compte_desactive_refuse(self):
        User.objects.create_user(
            username='awa@gmail.com', email='awa@gmail.com', password='x', role='client', is_active=False,
        )
        self.assertEqual(self._google(jeton()).status_code, 403)

    def test_apple_premiere_connexion_avec_nom_transmis_par_lapp(self):
        token = jeton(
            iss='https://appleid.apple.com', aud=BUNDLE, email='x1y2@privaterelay.appleid.com',
            email_verified='true', given_name=None, family_name=None,
        )
        r = self.api.post(
            '/api/auth/apple', {'id_token': token, 'first_name': 'Jean', 'last_name': 'Ekani'}, format='json',
        )
        self.assertEqual(r.status_code, 201)
        user = User.objects.get(email='x1y2@privaterelay.appleid.com')
        self.assertEqual((user.first_name, user.last_name), ('Jean', 'Ekani'))

    def test_jeton_google_refuse_sur_la_route_apple(self):
        r = self.api.post('/api/auth/apple', {'id_token': jeton()}, format='json')
        self.assertEqual(r.status_code, 401)

    def test_ping_toujours_joignable(self):
        self.assertEqual(self.api.get('/api/auth/ping').status_code, 200)

    # ─── Suppression d'un compte sans mot de passe ──────────────
    def test_suppression_compte_google_reconfirmee_par_google(self):
        self._google(jeton())
        user = User.objects.get(email='awa@gmail.com')
        api = APIClient()
        api.force_authenticate(user)
        r = api.post('/api/client/compte/supprimer', {'password': ''}, format='json')
        self.assertEqual(r.status_code, 400)
        # Jeton d'un autre compte Google : refusé
        r = api.post(
            '/api/client/compte/supprimer',
            {'fournisseur': 'google', 'id_token': jeton(email='autre@gmail.com')}, format='json',
        )
        self.assertEqual(r.status_code, 400)
        r = api.post(
            '/api/client/compte/supprimer', {'fournisseur': 'google', 'id_token': jeton()}, format='json',
        )
        self.assertEqual(r.status_code, 204)
