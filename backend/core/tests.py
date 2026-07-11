from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import User, RestaurantProfile, Plat, Categorie, Commande, Transaction, Favori, Livraison

# Désactive le throttling pendant les tests (sinon 429 après quelques appels auth).
NO_THROTTLE = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_THROTTLE_CLASSES': (),
    'DEFAULT_THROTTLE_RATES': {},
}


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class ClientApiTests(TestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(
            username='c@test.cm', email='c@test.cm', password='pass1234', role='client',
        )
        self.resto_user = User.objects.create_user(
            username='r@test.cm', email='r@test.cm', password='x', role='restaurant',
        )
        self.resto = RestaurantProfile.objects.create(
            user=self.resto_user, nom='Resto Test', adresse='Douala', ville='Douala',
            is_open=True, is_verified=True, frais_livraison=500, temps_livraison_moyen=25,
            commission_rate=10,  # pourcentage de revenu plateforme (majoration client)
        )
        cat = Categorie.objects.create(nom='Grillades')
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='Poulet Test', prix=3000,
            is_available=True, is_visible=True, is_popular=True,
            description='Poulet braise servi avec epices maison.',
            ingredients='Poulet, Epices, Oignons',
        )
        self.api = APIClient()

    def _auth(self):
        tok = self.api.post('/api/auth/login', {'email': 'c@test.cm', 'password': 'pass1234'}, format='json').json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")
        return tok

    def test_login_returns_token_and_refresh(self):
        tok = self.api.post('/api/auth/login', {'email': 'c@test.cm', 'password': 'pass1234'}, format='json').json()
        self.assertIn('token', tok)
        self.assertIn('refresh', tok)
        self.assertEqual(tok['user']['role'], 'client')

    def test_public_catalogue(self):
        self.assertEqual(self.api.get('/api/client/restaurants').status_code, 200)
        plats = self.api.get('/api/client/plats').json()
        plat = next((p for p in plats if p['nom'] == 'Poulet Test'), None)
        self.assertIsNotNone(plat)
        self.assertEqual(plat['description'], 'Poulet braise servi avec epices maison.')
        self.assertEqual(plat['composition'], ['Poulet', 'Epices', 'Oignons'])
        # Prix de base 3000 ; prix client majoré de 10 % = 3300
        self.assertEqual(int(float(plat['prix'])), 3000)
        self.assertEqual(int(plat['prix_client']), 3300)

    def test_restaurant_can_create_plat_with_composition(self):
        tok = self.api.post('/api/auth/login', {'email': 'r@test.cm', 'password': 'x'}, format='json').json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")
        payload = {
            'nom': 'Poisson Special',
            'prix': 4200,
            'description': 'Poisson marine puis grille.',
            'composition': ['Poisson', 'Citron', 'Ail'],
            'is_available': True,
        }
        res = self.api.post('/api/restaurant/menu/plats/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        created = Plat.objects.get(id=res.json()['id'])
        self.assertEqual(created.ingredients, 'Poisson, Citron, Ail')
        self.assertEqual(res.json()['composition'], ['Poisson', 'Citron', 'Ail'])

    def test_commandes_require_auth(self):
        self.assertEqual(self.api.get('/api/client/commandes/').status_code, 401)

    def test_favori_toggle_persists(self):
        self._auth()
        r = self.api.post('/api/client/favoris', {'plat': self.plat.id}, format='json').json()
        self.assertTrue(r['liked'])
        self.assertEqual(Favori.objects.filter(client=self.client_user).count(), 1)
        r2 = self.api.post('/api/client/favoris', {'plat': self.plat.id}, format='json').json()
        self.assertFalse(r2['liked'])
        self.assertEqual(Favori.objects.filter(client=self.client_user).count(), 0)

    def test_create_order_with_cash_payment(self):
        self._auth()
        payload = {
            'restaurant': self.resto.id, 'adresse_livraison': 'Akwa',
            'mode_paiement': 'especes', 'items': [{'plat_id': self.plat.id, 'quantite': 2}],
        }
        res = self.api.post('/api/client/commandes/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        # Prix de base 3000 + 10 % = 3300 payé par le client
        # 2 x 3300 + 500 livraison = 7100
        self.assertEqual(int(float(res.json()['montant_total'])), 7100)
        order = Commande.objects.get(id=res.json()['id'])
        self.assertEqual(order.client, self.client_user)
        # Le restaurant ne perçoit que ses prix de base : 2 x 3000 = 6000
        self.assertEqual(int(order.montant_restaurant), 6000)
        # La plateforme encaisse la majoration : 2 x 300 = 600
        self.assertEqual(int(order.commission_eeuez), 600)
        tx = Transaction.objects.get(commande=order)
        self.assertEqual(tx.mode_paiement, 'especes')
        self.assertEqual(tx.statut, 'complete')

    def test_client_confirme_reception_par_code(self):
        self._auth()
        livreur = User.objects.create_user(username='liv@test.cm', email='liv@test.cm', password='x', role='livreur')
        commande = Commande.objects.create(
            client=self.client_user, restaurant=self.resto, statut='en_livraison', montant_total=7100,
        )
        livraison = Livraison.objects.create(
            commande=commande, livreur=livreur, statut='en_livraison', code_confirmation='ABC234',
        )
        url = f'/api/client/commandes/{commande.id}/confirmer_reception/'
        # Mauvais code → refus, rien ne change
        bad = self.api.post(url, {'code': 'ZZZZZZ'}, format='json')
        self.assertEqual(bad.status_code, 400)
        livraison.refresh_from_db()
        self.assertEqual(livraison.statut, 'en_livraison')
        # Bon code (accepte le format QR « EEUEZ:id:code ») → livraison terminée
        ok = self.api.post(url, {'code': f'EEUEZ:{commande.id}:ABC234'}, format='json')
        self.assertEqual(ok.status_code, 200)
        commande.refresh_from_db(); livraison.refresh_from_db(); livreur.refresh_from_db()
        self.assertEqual(commande.statut, 'livree')
        self.assertEqual(livraison.statut, 'livree')
        self.assertIsNotNone(livraison.delivered_at)
        self.assertEqual(livreur.nombre_livraisons, 1)

    def test_recommandations_proximity_first(self):
        # Deux restos identiques en qualité : le plus proche doit passer devant.
        far_user = User.objects.create_user(username='far@test.cm', email='far@test.cm', password='x', role='restaurant')
        far = RestaurantProfile.objects.create(
            user=far_user, nom='Resto Lointain', adresse='Yaoundé', ville='Yaoundé',
            is_open=True, is_verified=True, latitude=3.848, longitude=11.502,
        )
        Plat.objects.create(restaurant=far, nom='Plat Lointain', prix=3000, is_available=True, is_visible=True)
        # Resto proche (coordonnées du client simulé)
        self.resto.latitude = 4.05
        self.resto.longitude = 9.70
        self.resto.save()

        res = self.api.get('/api/client/recommandations?lat=4.05&lon=9.70')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data['position_utilisee'])
        noms = [p['nom'] for p in data['plats']]
        self.assertLess(noms.index('Poulet Test'), noms.index('Plat Lointain'))
        # La distance et le score sont exposés
        top = data['plats'][0]
        self.assertIn('score', top)
        self.assertIn('distance_km', top)

    def test_recommandations_without_position(self):
        res = self.api.get('/api/client/recommandations')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()['position_utilisee'])
        self.assertTrue(len(res.json()['plats']) >= 1)

    def test_order_isolated_per_user(self):
        self._auth()
        self.api.post('/api/client/commandes/', {
            'restaurant': self.resto.id, 'adresse_livraison': 'x',
            'items': [{'plat_id': self.plat.id, 'quantite': 1}],
        }, format='json')
        other = User.objects.create_user(username='o@test.cm', email='o@test.cm', password='pass1234', role='client')
        api2 = APIClient()
        t = api2.post('/api/auth/login', {'email': 'o@test.cm', 'password': 'pass1234'}, format='json').json()
        api2.credentials(HTTP_AUTHORIZATION=f"Bearer {t['token']}")
        self.assertEqual(len(api2.get('/api/client/commandes/').json()), 0)
