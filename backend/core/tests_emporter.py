"""Réservation conditionnelle + service « plats à emporter ».

- La réservation de table n'est proposée que si `reservations_actives` est vrai.
- Un plat peut être commandé « à emporter » : commande scindée (une commande
  livrée + une commande à emporter pour un même restaurant), aucun frais de
  livraison, pas de livreur. L'argent du restaurant reste gelé jusqu'à ce qu'il
  saisisse le code de retrait présenté par le client (statut « récupérée »).
"""
import hashlib
import hmac

from django.test import TestCase, Client, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import (
    RestaurantProfile, Categorie, Plat, Commande, CommandeGroupe, PaiementGroupe,
    Livraison, User,
)
from core.models_livraison import ParametrageLivraison
from core.views.resto_ws import _solde_disponible

CAMERPAY_TEST_SECRET = 'test_secret_key_123'
NO_THROTTLE = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_THROTTLE_CLASSES': (), 'DEFAULT_THROTTLE_RATES': {},
}

RESTO = (4.0, 9.0)
CLIENT_PROCHE = (4.0, 9.01)  # ~1 km


def _signature(secret, uuid, invoice_id, status, amount):
    data = f'{uuid}|{invoice_id}|{status}|{amount}'
    return hmac.new(secret.encode('utf-8'), data.encode('utf-8'), hashlib.sha256).hexdigest()


@override_settings(REST_FRAMEWORK=NO_THROTTLE, CAMERPAY_CALLBACK_SECRET=CAMERPAY_TEST_SECRET, CAMERPAY_TOKEN='t')
class EmporterBaseTest(TestCase):
    def setUp(self):
        ParametrageLivraison.get_solo()
        cat = Categorie.objects.create(nom='Plats')
        patron = User.objects.create_user(username='resto', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Chez Test', ville='Douala', adresse='Rue A',
            is_verified=True, is_open=True, frais_livraison=700,
            latitude=RESTO[0], longitude=RESTO[1],
            plats_a_emporter_actifs=True,
        )
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='Ndolé', prix=2000,
            frais_livraison=500, is_available=True, is_visible=True,
        )
        self.client_user = User.objects.create_user(
            username='c@b.cm', email='c@b.cm', password='pass1234', role='client',
        )
        self.api = APIClient()

    def _auth(self):
        tok = self.api.post(
            '/api/auth/login', {'email': 'c@b.cm', 'password': 'pass1234'}, format='json',
        ).json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")

    def _checkout(self, *, mode='especes', items):
        payload = {
            'adresse_livraison': 'Quelque part', 'latitude': CLIENT_PROCHE[0], 'longitude': CLIENT_PROCHE[1],
            'mode_paiement': mode, 'items': items,
        }
        return self.api.post('/api/client/commandes/groupees/', payload, format='json')


class ReservationConditionnelleTest(EmporterBaseTest):
    def _reserver(self):
        return self.api.post('/api/client/reservations', {
            'restaurant': self.resto.id,
            'date_reservation': (timezone.now() + timezone.timedelta(days=1)).strftime('%Y-%m-%dT%H:%M'),
            'nombre_personnes': 2,
        }, format='json')

    def test_reservation_refusee_si_service_inactif(self):
        self._auth()
        self.assertFalse(self.resto.reservations_actives)
        res = self._reserver()
        self.assertEqual(res.status_code, 400, res.content)

    def test_reservation_acceptee_apres_activation(self):
        self.resto.reservations_actives = True
        self.resto.save(update_fields=['reservations_actives'])
        self._auth()
        res = self._reserver()
        self.assertEqual(res.status_code, 201, res.content)


class CheckoutEmporterTest(EmporterBaseTest):
    def test_panier_mixte_scinde_en_deux_commandes(self):
        self._auth()
        res = self._checkout(items=[
            {'plat_id': self.plat.id, 'quantite': 1, 'emporter': False},
            {'plat_id': self.plat.id, 'quantite': 2, 'emporter': True},
        ])
        self.assertEqual(res.status_code, 201, res.content)
        groupe = CommandeGroupe.objects.get(pk=res.json()['id'])
        self.assertEqual(groupe.commandes.count(), 2)

        livree = groupe.commandes.get(emporter=False)
        emportee = groupe.commandes.get(emporter=True)
        # La commande livrée garde des frais ; celle à emporter n'en a pas.
        self.assertGreater(int(livree.frais_livraison), 0)
        self.assertEqual(int(emportee.frais_livraison), 0)
        self.assertEqual(int(emportee.part_livreur), 0)
        self.assertEqual(emportee.adresse_livraison, '')
        # Aucune livraison n'est créée pour une commande à emporter.
        self.assertFalse(Livraison.objects.filter(commande=emportee).exists())

    def test_emporter_seul_pas_besoin_adresse(self):
        self._auth()
        payload = {
            'adresse_livraison': '', 'latitude': None, 'longitude': None,
            'mode_paiement': 'especes',
            'items': [{'plat_id': self.plat.id, 'quantite': 1, 'emporter': True}],
        }
        res = self.api.post('/api/client/commandes/groupees/', payload, format='json')
        self.assertEqual(res.status_code, 201, res.content)

    def test_emporter_refuse_si_service_inactif(self):
        self.resto.plats_a_emporter_actifs = False
        self.resto.save(update_fields=['plats_a_emporter_actifs'])
        self._auth()
        res = self._checkout(items=[{'plat_id': self.plat.id, 'quantite': 1, 'emporter': True}])
        # Seul restaurant du panier écarté → 400 avec le détail.
        self.assertEqual(res.status_code, 400, res.content)

    def test_code_retrait_genere_a_la_confirmation_du_paiement(self):
        self._auth()
        res = self._checkout(mode='mtn_money', items=[
            {'plat_id': self.plat.id, 'quantite': 1, 'emporter': True},
        ])
        groupe = CommandeGroupe.objects.get(pk=res.json()['id'])
        cmd = groupe.commandes.get()
        self.assertEqual(cmd.code_retrait, '')  # pas encore payée

        paiement = PaiementGroupe.objects.get(groupe=groupe)
        paiement.reference = f'EEUEZG-{groupe.id}-TEST'
        paiement.save(update_fields=['reference'])
        amount = str(paiement.montant)
        sig = _signature(CAMERPAY_TEST_SECRET, 'u', paiement.reference, 'completed', amount)
        Client().post('/api/camerpay/notify/', {
            'uuid': 'u', 'invoice_id': paiement.reference, 'status': 'completed',
            'amount': amount, 'signature': sig,
        })
        cmd.refresh_from_db()
        self.assertTrue(cmd.paiement_confirme)
        self.assertEqual(len(cmd.code_retrait), 6)


class ValidationRetraitTest(EmporterBaseTest):
    def _commande_emporter_payee(self):
        cmd = Commande.objects.create(
            client=self.client_user, restaurant=self.resto, emporter=True,
            statut='prete', paiement_confirme=True, montant_total=2200,
            montant_restaurant=2000, code_retrait='ABC123',
        )
        return cmd

    def test_mauvais_code_rejete(self):
        cmd = self._commande_emporter_payee()
        web = Client(); web.force_login(self.resto.user)
        web.post(reverse('core:resto_commande_action', args=[cmd.pk]), {'action': 'valider_retrait', 'code': 'WRONG'})
        cmd.refresh_from_db()
        self.assertEqual(cmd.statut, 'prete')

    def test_bon_code_passe_recuperee_et_debloque_le_solde(self):
        cmd = self._commande_emporter_payee()
        self.assertEqual(_solde_disponible(self.resto), 0)  # gelée tant que « prête »

        web = Client(); web.force_login(self.resto.user)
        web.post(reverse('core:resto_commande_action', args=[cmd.pk]), {'action': 'valider_retrait', 'code': 'abc123'})
        cmd.refresh_from_db()
        self.assertEqual(cmd.statut, 'recuperee')
        self.assertEqual(_solde_disponible(self.resto), 2000)  # fonds débloqués
