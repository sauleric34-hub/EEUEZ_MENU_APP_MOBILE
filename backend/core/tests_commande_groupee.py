"""Panier multi-restaurant (checkout groupé).

Le panier peut mélanger des plats de plusieurs restaurants : une Commande
par restaurant, reliées par un CommandeGroupe. Un restaurant hors zone /
fermé est écarté SANS bloquer les autres (paiement partiel assumé). Le
paiement Mobile Money est unique pour tout le groupe.
"""
import hashlib
import hmac

from django.test import TestCase, Client, override_settings
from rest_framework.test import APIClient

from core.models import (
    RestaurantProfile, Categorie, Plat, Commande, CommandeGroupe, PaiementGroupe,
    Transaction, User,
)
from core.models_livraison import ParametrageLivraison, PalierLivraison

CAMERPAY_TEST_SECRET = 'test_secret_key_123'
NO_THROTTLE = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_THROTTLE_CLASSES': (), 'DEFAULT_THROTTLE_RATES': {},
}


def _signature(secret, uuid, invoice_id, status, amount):
    data = f'{uuid}|{invoice_id}|{status}|{amount}'
    return hmac.new(secret.encode('utf-8'), data.encode('utf-8'), hashlib.sha256).hexdigest()


# Deux restaurants proches l'un de l'autre, tous deux à portée du client.
RESTO_A = (4.0, 9.0)
RESTO_B = (4.0, 9.01)   # ~1.1 km de A, sans importance : chacun a SA propre distance au client
CLIENT_PROCHE = (4.0, 9.018)   # ~2 km des deux restos
CLIENT_LOIN = (4.0, 9.3)       # ~33 km : hors zone pour un barème borné à 15 km


@override_settings(REST_FRAMEWORK=NO_THROTTLE, CAMERPAY_CALLBACK_SECRET=CAMERPAY_TEST_SECRET, CAMERPAY_TOKEN='t')
class CommandeGroupeeBaseTest(TestCase):
    def setUp(self):
        param = ParametrageLivraison.get_solo()
        param.coefficient_distance_routiere = 1
        param.save()

        cat = Categorie.objects.create(nom='Plats')

        patron_a = User.objects.create_user(username='resto_a', password='x', role='restaurant')
        self.resto_a = RestaurantProfile.objects.create(
            user=patron_a, nom='Resto A', ville='Douala', adresse='A',
            is_verified=True, is_open=True, frais_livraison=700,
            latitude=RESTO_A[0], longitude=RESTO_A[1],
        )
        self.plat_a = Plat.objects.create(
            restaurant=self.resto_a, categorie=cat, nom='Plat A', prix=2000,
            frais_livraison=500, is_available=True, is_visible=True,
        )
        PalierLivraison.objects.create(restaurant=self.resto_a, jusqu_a_km=5, prix=500)
        PalierLivraison.objects.create(restaurant=self.resto_a, jusqu_a_km=15, prix=1000)

        patron_b = User.objects.create_user(username='resto_b', password='x', role='restaurant')
        self.resto_b = RestaurantProfile.objects.create(
            user=patron_b, nom='Resto B', ville='Douala', adresse='B',
            is_verified=True, is_open=True, frais_livraison=700,
            latitude=RESTO_B[0], longitude=RESTO_B[1],
        )
        self.plat_b = Plat.objects.create(
            restaurant=self.resto_b, categorie=cat, nom='Plat B', prix=3000,
            frais_livraison=500, is_available=True, is_visible=True,
        )
        PalierLivraison.objects.create(restaurant=self.resto_b, jusqu_a_km=5, prix=600)
        PalierLivraison.objects.create(restaurant=self.resto_b, jusqu_a_km=15, prix=1200)

        self.client_user = User.objects.create_user(
            username='c@b.cm', email='c@b.cm', password='pass1234', role='client',
        )
        self.api = APIClient()

    def _auth(self):
        tok = self.api.post(
            '/api/auth/login', {'email': 'c@b.cm', 'password': 'pass1234'}, format='json',
        ).json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")

    def _checkout(self, lat, lon, *, mode='especes', items=None, utiliser_points=False):
        payload = {
            'adresse_livraison': 'Quelque part', 'latitude': lat, 'longitude': lon,
            'mode_paiement': mode, 'utiliser_points': utiliser_points,
            'items': items if items is not None else [
                {'plat_id': self.plat_a.id, 'quantite': 1},
                {'plat_id': self.plat_b.id, 'quantite': 2},
            ],
        }
        return self.api.post('/api/client/commandes/groupees/', payload, format='json')


class CheckoutGroupeTest(CommandeGroupeeBaseTest):
    def test_deux_restaurants_deux_commandes_frais_independants(self):
        self._auth()
        res = self._checkout(*CLIENT_PROCHE)
        self.assertEqual(res.status_code, 201, res.content)
        data = res.json()
        self.assertEqual(len(data['commandes']), 2)
        self.assertEqual(data['exclusions'], [])

        frais_par_resto = {c['restaurant']: int(float(c['frais_livraison'])) for c in data['commandes']}
        self.assertEqual(frais_par_resto[self.resto_a.id], 500)  # tranche 0-5km de A
        self.assertEqual(frais_par_resto[self.resto_b.id], 600)  # tranche 0-5km de B (barème différent)

        groupe = CommandeGroupe.objects.get(pk=data['id'])
        self.assertEqual(groupe.commandes.count(), 2)
        # Montant du groupe = somme des deux commandes (les frais ne se
        # cumulent PAS à l'intérieur d'une même commande, mais bien ENTRE
        # commandes de restaurants différents).
        total_attendu = sum(int(c.montant_total) for c in groupe.commandes.all())
        self.assertEqual(int(groupe.montant_total), total_attendu)

    def test_plusieurs_plats_meme_restaurant_un_seul_frais(self):
        """2 plats du même restaurant → un seul frais de livraison, pas deux."""
        self._auth()
        res = self._checkout(*CLIENT_PROCHE, items=[
            {'plat_id': self.plat_a.id, 'quantite': 1},
            {'plat_id': self.plat_a.id, 'quantite': 3},
        ])
        self.assertEqual(res.status_code, 201, res.content)
        data = res.json()
        self.assertEqual(len(data['commandes']), 1)
        self.assertEqual(int(float(data['commandes'][0]['frais_livraison'])), 500)

    def test_un_restaurant_hors_zone_nexclut_que_lui(self):
        """Resto A a une tranche jusqu'à 15km. On resserre le barème de B pour
        qu'il devienne hors zone à cette même adresse, sans toucher à A."""
        # RESTO_B = (4.0, 9.01) ; CLIENT_PROCHE = (4.0, 9.018) → ~0.89 km de B.
        # Reconfigure B avec un barème plus restrictif pour ce test précis.
        self.resto_b.paliers_livraison.all().delete()
        PalierLivraison.objects.create(restaurant=self.resto_b, jusqu_a_km=0.5, prix=500)

        self._auth()
        res = self._checkout(*CLIENT_PROCHE)  # ~2km de A (OK, jusqu'à 15) ; ~0.89km de B (hors zone, jusqu'à 0.5)
        self.assertEqual(res.status_code, 201, res.content)
        data = res.json()
        self.assertEqual(len(data['commandes']), 1)
        self.assertEqual(data['commandes'][0]['restaurant'], self.resto_a.id)
        self.assertEqual(len(data['exclusions']), 1)
        self.assertEqual(data['exclusions'][0]['restaurant_id'], self.resto_b.id)
        self.assertEqual(data['exclusions'][0]['motif'], 'hors_zone')

        # Le restaurant B n'a bien AUCUNE commande créée.
        self.assertFalse(Commande.objects.filter(restaurant=self.resto_b).exists())

    def test_tous_hors_zone_400_rien_en_base(self):
        self._auth()
        res = self._checkout(*CLIENT_LOIN)
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertEqual(len(data['exclusions']), 2)
        self.assertEqual(Commande.objects.count(), 0)
        self.assertEqual(CommandeGroupe.objects.count(), 0)

    def test_restaurant_ferme_exclu(self):
        self.resto_b.is_open = False
        self.resto_b.save(update_fields=['is_open'])
        self._auth()
        res = self._checkout(*CLIENT_PROCHE)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(len(data['commandes']), 1)
        self.assertEqual(data['exclusions'][0]['motif'], 'ferme')

    def test_especes_confirme_immediatement_sans_paiement_groupe(self):
        self._auth()
        res = self._checkout(*CLIENT_PROCHE, mode='especes')
        self.assertEqual(res.status_code, 201)
        groupe = CommandeGroupe.objects.get(pk=res.json()['id'])
        self.assertTrue(all(c.paiement_confirme for c in groupe.commandes.all()))
        self.assertFalse(PaiementGroupe.objects.filter(groupe=groupe).exists())

    def test_mobile_money_cree_un_paiement_groupe_en_attente(self):
        self._auth()
        res = self._checkout(*CLIENT_PROCHE, mode='mtn_money')
        self.assertEqual(res.status_code, 201)
        groupe = CommandeGroupe.objects.get(pk=res.json()['id'])
        self.assertFalse(any(c.paiement_confirme for c in groupe.commandes.all()))
        paiement = PaiementGroupe.objects.get(groupe=groupe)
        self.assertEqual(paiement.statut, 'en_attente')
        self.assertEqual(int(paiement.montant), int(groupe.montant_total))
        # Chaque commande garde SA PROPRE transaction en attente (compta inchangée).
        for c in groupe.commandes.all():
            txn = Transaction.objects.get(commande=c, type='paiement_client')
            self.assertEqual(txn.statut, 'en_attente')
            self.assertEqual(int(txn.montant), int(c.montant_total))

    def test_reduction_fidelite_une_seule_fois_sur_le_groupe(self):
        self.client_user.points_solde = 100000
        self.client_user.save(update_fields=['points_solde'])
        self._auth()
        res_sans = self._checkout(*CLIENT_PROCHE, mode='especes', utiliser_points=False)
        total_sans_reduction = int(float(res_sans.json()['montant_total']))

        res = self._checkout(*CLIENT_PROCHE, mode='especes', utiliser_points=True)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        total_avec_reduction = int(float(data['montant_total']))
        self.assertLess(total_avec_reduction, total_sans_reduction)

        # La réduction est imputée sur UNE seule commande (la plus chère du groupe).
        commandes_reduites = [c for c in data['commandes'] if int(c['reduction_points']) > 0]
        self.assertEqual(len(commandes_reduites), 1)

    def test_points_debites_correspondent_toujours_a_la_reduction_accordee(self):
        """Régression : la réduction doit être calculée directement sur le
        total de la commande CIBLÉE (pas celui, plus large, du groupe) pour
        que les points débités du solde correspondent TOUJOURS exactement à
        la réduction accordée — jamais plus, même avec un solde de points
        énorme et une commande ciblée petite face au reste du groupe."""
        self.client_user.points_solde = 100000  # solde volontairement énorme
        self.client_user.save(update_fields=['points_solde'])
        solde_avant = self.client_user.points_solde

        self._auth()
        # Resto A domine largement le total du groupe (sa propre commande
        # reste donc la « cible ») ; Resto B garde un total modeste.
        res = self._checkout(*CLIENT_PROCHE, mode='especes', utiliser_points=True, items=[
            {'plat_id': self.plat_a.id, 'quantite': 5},
            {'plat_id': self.plat_b.id, 'quantite': 1},
        ])
        self.assertEqual(res.status_code, 201, res.content)

        groupe = CommandeGroupe.objects.get(pk=res.json()['id'])
        cible = max(groupe.commandes.all(), key=lambda c: c.montant_total)
        self.assertGreater(cible.reduction_points, 0)
        # Jamais plus que ce que CETTE commande peut absorber.
        self.assertLessEqual(cible.reduction_points, cible.montant_total)

        self.client_user.refresh_from_db()
        points_debites = solde_avant - self.client_user.points_solde
        self.assertEqual(points_debites, cible.points_utilises)


class WebhookGroupeTest(CommandeGroupeeBaseTest):
    def _creer_groupe_mobile_money(self):
        self._auth()
        res = self._checkout(*CLIENT_PROCHE, mode='mtn_money')
        groupe_id = res.json()['id']
        groupe = CommandeGroupe.objects.get(pk=groupe_id)
        paiement = PaiementGroupe.objects.get(groupe=groupe)
        paiement.reference = f'EEUEZG-{groupe.id}-TEST'
        paiement.save(update_fields=['reference'])
        return groupe, paiement

    def _notify(self, ref, amount, status='completed'):
        web = Client()
        sig = _signature(CAMERPAY_TEST_SECRET, 'uuid-test', ref, status, amount)
        return web.post('/api/camerpay/notify/', {
            'uuid': 'uuid-test', 'invoice_id': ref, 'status': status, 'amount': amount, 'signature': sig,
        })

    def test_paiement_groupe_confirme_toutes_les_commandes(self):
        groupe, paiement = self._creer_groupe_mobile_money()
        res = self._notify(paiement.reference, str(paiement.montant))
        self.assertEqual(res.status_code, 200)

        paiement.refresh_from_db()
        self.assertEqual(paiement.statut, 'complete')
        for c in groupe.commandes.all():
            c.refresh_from_db()
            self.assertTrue(c.paiement_confirme)
            txn = Transaction.objects.get(commande=c, type='paiement_client')
            self.assertEqual(txn.statut, 'complete')

    def test_idempotence_seconde_notification_sans_effet(self):
        groupe, paiement = self._creer_groupe_mobile_money()
        self._notify(paiement.reference, str(paiement.montant))
        res2 = self._notify(paiement.reference, str(paiement.montant))
        self.assertEqual(res2.status_code, 200)  # ne casse rien, pas d'erreur

    def test_montant_incoherent_rejete(self):
        groupe, paiement = self._creer_groupe_mobile_money()
        res = self._notify(paiement.reference, str(int(paiement.montant) + 5000))
        self.assertEqual(res.status_code, 400)
        paiement.refresh_from_db()
        self.assertEqual(paiement.statut, 'en_attente')

    def test_echec_paiement_marque_commandes_en_echec(self):
        groupe, paiement = self._creer_groupe_mobile_money()
        res = self._notify(paiement.reference, str(paiement.montant), status='failed')
        self.assertEqual(res.status_code, 200)
        paiement.refresh_from_db()
        self.assertEqual(paiement.statut, 'echouee')
        for c in groupe.commandes.all():
            txn = Transaction.objects.get(commande=c, type='paiement_client')
            self.assertEqual(txn.statut, 'echouee')
            c.refresh_from_db()
            self.assertFalse(c.paiement_confirme)


class DetailGroupeTest(CommandeGroupeeBaseTest):
    """GET /client/commandes/groupes/{id}/ — utilisé par l'app pour vérifier
    (polling) qu'un paiement CamerPay a bien confirmé TOUTES les commandes."""

    def test_paiement_confirme_faux_tant_que_pas_toutes_payees(self):
        self._auth()
        res = self._checkout(*CLIENT_PROCHE, mode='mtn_money')
        groupe_id = res.json()['id']

        detail = self.api.get(f'/api/client/commandes/groupes/{groupe_id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertFalse(detail.json()['paiement_confirme'])

    def test_paiement_confirme_vrai_une_fois_tout_paye(self):
        self._auth()
        res = self._checkout(*CLIENT_PROCHE, mode='especes')  # confirmé immédiatement
        groupe_id = res.json()['id']

        detail = self.api.get(f'/api/client/commandes/groupes/{groupe_id}/')
        self.assertTrue(detail.json()['paiement_confirme'])

    def test_autre_client_ne_peut_pas_consulter(self):
        self._auth()
        res = self._checkout(*CLIENT_PROCHE, mode='especes')
        groupe_id = res.json()['id']

        User.objects.create_user(
            username='autre@b.cm', email='autre@b.cm', password='pass1234', role='client',
        )
        autre_api = APIClient()
        tok = autre_api.post(
            '/api/auth/login', {'email': 'autre@b.cm', 'password': 'pass1234'}, format='json',
        ).json()
        autre_api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")

        res2 = autre_api.get(f'/api/client/commandes/groupes/{groupe_id}/')
        self.assertEqual(res2.status_code, 404)  # n'appartient pas à ce client

        anon = APIClient()
        res3 = anon.get(f'/api/client/commandes/groupes/{groupe_id}/')
        self.assertEqual(res3.status_code, 401)  # pas authentifié du tout


class AnnulationGroupeTest(CommandeGroupeeBaseTest):
    def test_annulation_groupe_non_paye_supprime_tout(self):
        self._auth()
        res = self._checkout(*CLIENT_PROCHE, mode='mtn_money')
        groupe_id = res.json()['id']

        res2 = self.api.post(f'/api/client/commandes/groupes/{groupe_id}/annuler/')
        self.assertEqual(res2.status_code, 204)
        self.assertFalse(Commande.objects.filter(groupe_id=groupe_id).exists())
        self.assertFalse(CommandeGroupe.objects.filter(pk=groupe_id).exists())

    def test_annulation_impossible_si_deja_paye(self):
        self._auth()
        res = self._checkout(*CLIENT_PROCHE, mode='especes')  # confirmé immédiatement
        groupe_id = res.json()['id']
        res2 = self.api.post(f'/api/client/commandes/groupes/{groupe_id}/annuler/')
        self.assertEqual(res2.status_code, 400)
        self.assertTrue(CommandeGroupe.objects.filter(pk=groupe_id).exists())


class CommandeUniqueRegressionTest(CommandeGroupeeBaseTest):
    """L'ancien endpoint (un seul restaurant) doit continuer à fonctionner
    exactement comme avant le refactor vers checkout_groupe.construire_commande."""

    def test_ancien_endpoint_toujours_fonctionnel(self):
        self._auth()
        res = self.api.post('/api/client/commandes/', {
            'restaurant': self.resto_a.id, 'adresse_livraison': 'Quelque part',
            'mode_paiement': 'especes', 'latitude': CLIENT_PROCHE[0], 'longitude': CLIENT_PROCHE[1],
            'items': [{'plat_id': self.plat_a.id, 'quantite': 1}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        cmd = Commande.objects.get(pk=res.json()['id'])
        self.assertEqual(int(cmd.frais_livraison), 500)
        self.assertIsNone(cmd.groupe)

    def test_ancien_endpoint_hors_zone_toujours_refuse(self):
        self._auth()
        res = self.api.post('/api/client/commandes/', {
            'restaurant': self.resto_a.id, 'adresse_livraison': 'Loin',
            'mode_paiement': 'especes', 'latitude': CLIENT_LOIN[0], 'longitude': CLIENT_LOIN[1],
            'items': [{'plat_id': self.plat_a.id, 'quantite': 1}],
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Commande.objects.count(), 0)
