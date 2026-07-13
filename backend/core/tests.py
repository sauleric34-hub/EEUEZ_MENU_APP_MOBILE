from unittest.mock import patch
from django.test import TestCase, override_settings, Client
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

    def test_mobile_money_order_is_unconfirmed_until_paid(self):
        """Une commande mobile money est créée non confirmée et devient visible
        du restaurant seulement après notification de paiement réussie."""
        self._auth()
        payload = {
            'restaurant': self.resto.id, 'adresse_livraison': 'Akwa',
            'mode_paiement': 'mtn_money', 'items': [{'plat_id': self.plat.id, 'quantite': 1}],
        }
        res = self.api.post('/api/client/commandes/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        order = Commande.objects.get(id=res.json()['id'])
        self.assertFalse(order.paiement_confirme)

        # Paiement confirmé via le webhook → la commande devient confirmée.
        tx = Transaction.objects.get(commande=order)
        tx.reference = 'EEUEZ-CONFIRM-1'; tx.save(update_fields=['reference'])
        web = Client()
        ok = web.post('/api/monetbil/notify/', {
            'payment_ref': 'EEUEZ-CONFIRM-1', 'status': 'success',
            'amount': str(int(order.montant_total)),
        })
        self.assertEqual(ok.status_code, 200)
        order.refresh_from_db()
        self.assertTrue(order.paiement_confirme)

    def test_annuler_supprime_commande_non_payee(self):
        """Le client peut annuler (supprimer) une commande mobile money non payée."""
        self._auth()
        commande = Commande.objects.create(
            client=self.client_user, restaurant=self.resto, statut='en_attente',
            montant_total=3300, paiement_confirme=False,
        )
        res = self.api.post(f'/api/client/commandes/{commande.id}/annuler/')
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Commande.objects.filter(id=commande.id).exists())

    def test_annuler_refuse_commande_payee(self):
        """Impossible d'annuler une commande déjà confirmée."""
        self._auth()
        commande = Commande.objects.create(
            client=self.client_user, restaurant=self.resto, statut='acceptee',
            montant_total=3300, paiement_confirme=True,
        )
        res = self.api.post(f'/api/client/commandes/{commande.id}/annuler/')
        self.assertEqual(res.status_code, 400)
        self.assertTrue(Commande.objects.filter(id=commande.id).exists())

    def test_delivery_fee_is_per_dish(self):
        self._auth()
        # Plat avec frais de livraison propre de 1000 F
        cat = Categorie.objects.first() or Categorie.objects.create(nom='X')
        plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='Plat Livraison', prix=2000,
            frais_livraison=1000, is_available=True, is_visible=True,
        )
        payload = {
            'restaurant': self.resto.id, 'adresse_livraison': 'Akwa',
            'mode_paiement': 'especes', 'items': [{'plat_id': plat.id, 'quantite': 1}],
        }
        res = self.api.post('/api/client/commandes/', payload, format='json')
        self.assertEqual(res.status_code, 201)
        # prix_client 2000 + 10% = 2200 ; + frais du plat 1000 = 3200
        self.assertEqual(int(float(res.json()['montant_total'])), 3200)

    def test_monetbil_notify_marks_transaction_paid(self):
        commande = Commande.objects.create(
            client=self.client_user, restaurant=self.resto, statut='en_attente', montant_total=7100,
        )
        txn = Transaction.objects.create(
            commande=commande, type='paiement_client', montant=7100,
            mode_paiement='mtn_money', statut='en_attente', reference='EEUEZ-TEST-1',
        )
        web = Client()
        url = '/api/monetbil/notify/'
        # Montant incohérent → rejet, transaction inchangée
        bad = web.post(url, {'payment_ref': 'EEUEZ-TEST-1', 'status': 'success', 'amount': '5000'})
        self.assertEqual(bad.status_code, 400)
        txn.refresh_from_db(); self.assertEqual(txn.statut, 'en_attente')
        # Bon montant + succès → transaction complète
        ok = web.post(url, {'payment_ref': 'EEUEZ-TEST-1', 'status': 'success', 'amount': '7100'})
        self.assertEqual(ok.status_code, 200)
        txn.refresh_from_db(); self.assertEqual(txn.statut, 'complete')
        # Idempotence : une seconde notification ne casse rien
        again = web.post(url, {'payment_ref': 'EEUEZ-TEST-1', 'status': 'success', 'amount': '7100'})
        self.assertEqual(again.status_code, 200)

    def test_monetbil_initiation_returns_payment_url(self):
        self._auth()
        commande = Commande.objects.create(
            client=self.client_user, restaurant=self.resto, statut='en_attente', montant_total=7100,
        )
        Transaction.objects.create(
            commande=commande, type='paiement_client', montant=7100,
            mode_paiement='mtn_money', statut='en_attente',
        )
        fake = {'success': True, 'payment_url': 'https://api.monetbil.com/pay/v2.1/ABC123'}

        class FakeResp:
            def raise_for_status(self): pass
            def json(self): return fake

        with patch('core.api_views.http_requests.post', return_value=FakeResp()):
            res = self.api.post(f'/api/client/commandes/{commande.id}/initier_paiement/',
                                {'phone': '699000000'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['payment_url'], fake['payment_url'])

    def test_retrait_decaissement_mode_manuel(self):
        from core.models import RetraitFonds
        from core.payout import executer_retrait
        r = RetraitFonds.objects.create(
            restaurant=self.resto, montant=5000, mode_paiement='mtn_money', numero_compte='699000000',
        )
        res = executer_retrait(r)  # MONETBIL_PAYOUT_ENABLED = False par défaut
        self.assertEqual(res.status, 'en_attente')
        r.refresh_from_db()
        self.assertEqual(r.statut, 'approuve')  # approuvé, à verser manuellement
        self.assertTrue(r.payout_reference)

    def test_retrait_decaissement_monetbil_mocke(self):
        from core.models import RetraitFonds
        from core.payout import executer_retrait, MonetbilPayoutProvider
        r = RetraitFonds.objects.create(
            restaurant=self.resto, montant=5000, mode_paiement='orange_money', numero_compte='699111111',
        )
        with override_settings(MONETBIL_PAYOUT_ENABLED=True):
            with patch.object(MonetbilPayoutProvider, '_call_api',
                              return_value={'status': 'SUCCESS', 'payoutId': 'PX-1'}):
                res = executer_retrait(r)
        self.assertEqual(res.status, 'paye')
        r.refresh_from_db()
        self.assertEqual(r.statut, 'paye')
        self.assertEqual(r.payout_reference, 'PX-1')
        self.assertIsNotNone(r.processed_at)

    def test_reservation_flow_complet(self):
        from core.models import Reservation
        from core.api_views import _monetbil_notify_reservation
        self._auth()
        # 1. Création → en_attente, nom par défaut, prix du resto
        res = self.api.post('/api/client/reservations', {
            'restaurant': self.resto.id, 'date_reservation': '2026-08-01T19:30', 'nombre_personnes': 2,
        }, format='json')
        self.assertEqual(res.status_code, 201)
        rid = res.json()['id']
        self.assertEqual(res.json()['statut'], 'en_attente')
        # 2. Payer avant acceptation → refusé
        self.assertEqual(self.api.post(f'/api/client/reservations/{rid}/payer', {}, format='json').status_code, 400)
        # 3. Restaurant accepte (avec prix)
        resa = Reservation.objects.get(pk=rid); resa.statut = 'acceptee'; resa.prix = 7000; resa.save()
        # 4. Notification Monetbil succès → payee + code
        _monetbil_notify_reservation(f'RESA-{rid}', 'success', '7000')
        resa.refresh_from_db()
        self.assertEqual(resa.statut, 'payee')
        self.assertTrue(resa.code)
        # 5. Ticket PDF
        t = self.api.get(f'/api/client/reservations/{rid}/ticket')
        self.assertEqual(t.status_code, 200)
        self.assertEqual(t['Content-Type'], 'application/pdf')

    def test_reservation_gratuite_confirmee_sans_paiement(self):
        from core.models import Reservation
        self._auth()
        res = self.api.post('/api/client/reservations', {
            'restaurant': self.resto.id, 'date_reservation': '2026-08-01T19:30', 'nombre_personnes': 2,
        }, format='json')
        rid = res.json()['id']
        # Réservation gratuite acceptée par le resto
        resa = Reservation.objects.get(pk=rid); resa.statut = 'acceptee'; resa.prix = 0; resa.save()
        p = self.api.post(f'/api/client/reservations/{rid}/payer', {}, format='json')
        self.assertEqual(p.status_code, 200)
        self.assertTrue(p.json().get('free'))
        resa.refresh_from_db()
        self.assertEqual(resa.statut, 'payee')   # confirmée directement, sans paiement
        self.assertTrue(resa.code)

    def test_galerie_endpoint(self):
        g = self.api.get(f'/api/client/restaurants/{self.resto.id}/galerie')
        self.assertEqual(g.status_code, 200)
        self.assertIn('medias', g.json())
        self.assertIn('plats_photos', g.json())

    def test_plat_expose_est_favori(self):
        self._auth()
        plats = self.api.get('/api/client/plats').json()
        p = next(x for x in plats if x['id'] == self.plat.id)
        self.assertFalse(p['est_favori'])
        self.api.post('/api/client/favoris', {'plat': self.plat.id}, format='json')
        plats = self.api.get('/api/client/plats').json()
        p = next(x for x in plats if x['id'] == self.plat.id)
        self.assertTrue(p['est_favori'])

    def test_resto_expose_is_following(self):
        self._auth()
        d = self.api.get(f'/api/client/restaurants/{self.resto.id}').json()
        self.assertFalse(d['is_following'])
        self.api.post('/api/client/abonnements', {'restaurant': self.resto.id}, format='json')
        d = self.api.get(f'/api/client/restaurants/{self.resto.id}').json()
        self.assertTrue(d['is_following'])

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
