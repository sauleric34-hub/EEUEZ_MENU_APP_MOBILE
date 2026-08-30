"""Barème de livraison par distance.

Le restaurant définit son prix de livraison par tranches de distance. À la
commande, le serveur mesure la distance restaurant → adresse, choisit la
tranche, et FIGE le montant. Au-delà de la dernière tranche : hors zone.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from rest_framework.test import APIClient

from core.models import RestaurantProfile, Categorie, Plat, Commande
from core.models_livraison import ParametrageLivraison, PalierLivraison
from core.delivery import calculer_frais_livraison

User = get_user_model()

# Restaurant à (4.0000, 9.0000). À cette latitude, 1° de longitude ≈ 111 km.
RESTO_LAT, RESTO_LON = 4.0, 9.0
# ~2 km à l'est du restaurant (0.018° ≈ 2 km).
PROCHE = (4.0, 9.018)
# ~22 km à l'est du restaurant (0.2° ≈ 22 km).
LOIN = (4.0, 9.2)


class BaremeBaseTest(TestCase):
    def setUp(self):
        patron = User.objects.create_user(username='resto', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Chez Test', ville='Douala', adresse='Akwa',
            is_verified=True, is_open=True, frais_livraison=700,
            latitude=RESTO_LAT, longitude=RESTO_LON,
        )
        cat = Categorie.objects.create(nom='Plats')
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='Poulet', prix=3000,
            frais_livraison=500, is_available=True, is_visible=True,
        )
        # Coefficient routier neutralisé : distance = vol d'oiseau, tranches nettes.
        param = ParametrageLivraison.get_solo()
        param.coefficient_distance_routiere = 1
        param.save()

        self.client_user = User.objects.create_user(
            username='c@b.cm', email='c@b.cm', password='pass1234', role='client',
        )
        self.api = APIClient()

    def _bareme(self, *tranches):
        """tranches : (jusqu_a_km, prix), …"""
        for km, prix in tranches:
            PalierLivraison.objects.create(restaurant=self.resto, jusqu_a_km=km, prix=prix)

    def _auth(self):
        tok = self.api.post(
            '/api/auth/login', {'email': 'c@b.cm', 'password': 'pass1234'}, format='json',
        ).json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")

    def _commander(self, lat=None, lon=None):
        payload = {
            'restaurant': self.resto.id, 'adresse_livraison': 'Quelque part',
            'mode_paiement': 'especes',
            'items': [{'plat_id': self.plat.id, 'quantite': 1}],
        }
        if lat is not None:
            payload['latitude'], payload['longitude'] = lat, lon
        return self.api.post('/api/client/commandes/', payload, format='json')


class HelperTest(BaremeBaseTest):
    def test_sans_bareme_repli(self):
        frais, hors_zone, dist = calculer_frais_livraison(self.resto, *PROCHE, repli=700)
        self.assertEqual((frais, hors_zone), (700, False))

    def test_distance_inconnue_repli(self):
        self._bareme((5, 500), (15, 1000))
        frais, hors_zone, dist = calculer_frais_livraison(self.resto, None, None, repli=700)
        self.assertEqual((frais, hors_zone, dist), (700, False, None))

    def test_tranche_proche(self):
        self._bareme((5, 500), (15, 1000))
        frais, hors_zone, dist = calculer_frais_livraison(self.resto, *PROCHE, repli=700)
        self.assertEqual((frais, hors_zone), (500, False))
        self.assertLess(dist, 5)

    def test_tranche_intermediaire(self):
        self._bareme((5, 500), (15, 1000))
        # ~11 km : au-delà de 5, dans la tranche 15.
        frais, hors_zone, dist = calculer_frais_livraison(self.resto, 4.0, 9.1, repli=700)
        self.assertEqual((frais, hors_zone), (1000, False))

    def test_hors_zone_au_dela_du_dernier_palier(self):
        self._bareme((5, 500), (15, 1000))
        frais, hors_zone, dist = calculer_frais_livraison(self.resto, *LOIN, repli=700)
        self.assertEqual((frais, hors_zone), (None, True))
        self.assertGreater(dist, 15)


class CommandeTest(BaremeBaseTest):
    def test_frais_fige_selon_la_tranche(self):
        self._bareme((5, 500), (15, 1200))
        self._auth()
        res = self._commander(*PROCHE)
        self.assertEqual(res.status_code, 201)
        cmd = Commande.objects.get(pk=res.json()['id'])
        self.assertEqual(int(cmd.frais_livraison), 500)
        # part_livreur = 70 % de 500
        self.assertEqual(int(cmd.part_livreur), 350)

    def test_commande_refusee_hors_zone(self):
        self._bareme((5, 500), (15, 1200))
        self._auth()
        res = self._commander(*LOIN)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Commande.objects.count(), 0)

    def test_repli_sans_gps(self):
        self._bareme((5, 500), (15, 1200))
        self._auth()
        res = self._commander()  # aucune coordonnée
        self.assertEqual(res.status_code, 201)
        cmd = Commande.objects.get(pk=res.json()['id'])
        # Repli = frais le plus élevé parmi les plats (500), sinon frais resto.
        self.assertEqual(int(cmd.frais_livraison), 500)

    def test_sans_bareme_comportement_historique(self):
        self._auth()
        res = self._commander(*LOIN)
        self.assertEqual(res.status_code, 201)  # pas de blocage sans barème
        cmd = Commande.objects.get(pk=res.json()['id'])
        self.assertEqual(int(cmd.frais_livraison), 500)


class EstimationEndpointTest(BaremeBaseTest):
    def test_estimation_renvoie_le_prix_de_la_tranche(self):
        self._bareme((5, 500), (15, 1000))
        self._auth()
        res = self.api.post('/api/client/livraison/estimer', {
            'restaurant': self.resto.id, 'latitude': PROCHE[0], 'longitude': PROCHE[1],
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['frais_livraison'], 500)
        self.assertFalse(res.json()['hors_zone'])

    def test_estimation_hors_zone(self):
        self._bareme((5, 500), (15, 1000))
        self._auth()
        res = self.api.post('/api/client/livraison/estimer', {
            'restaurant': self.resto.id, 'latitude': LOIN[0], 'longitude': LOIN[1],
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['hors_zone'])
        self.assertIsNone(res.json()['frais_livraison'])


class WorkspaceBaremeTest(BaremeBaseTest):
    def test_le_restaurant_enregistre_son_bareme(self):
        web = Client()
        web.force_login(self.resto.user)
        res = web.post('/admin-panel/resto/profil/', {
            'form': 'bareme',
            'palier_km': ['15', '5'],       # volontairement dans le désordre
            'palier_prix': ['1000', '500'],
        })
        self.assertEqual(res.status_code, 302)
        paliers = list(self.resto.paliers_livraison.values_list('jusqu_a_km', 'prix'))
        self.assertEqual(
            [(float(k), int(p)) for k, p in paliers],
            [(5.0, 500), (15.0, 1000)],  # re-trié par distance
        )

    def test_bareme_vide_efface(self):
        self._bareme((5, 500))
        web = Client()
        web.force_login(self.resto.user)
        web.post('/admin-panel/resto/profil/', {
            'form': 'bareme', 'palier_km': [''], 'palier_prix': [''],
        })
        self.assertEqual(self.resto.paliers_livraison.count(), 0)


class AdminWorkspaceTest(BaremeBaseTest):
    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_user(
            username='a@b.cm', email='a@b.cm', password='pass1234', role='admin',
        )
        self.web = Client()
        self.web.force_login(self.admin)

    def test_admin_regle_le_coefficient(self):
        res = self.web.post('/admin-panel/livreurs/parametrage/', {
            'pourcentage_livreur': '70', 'seuil_paiement_auto': '5000',
            'delai_relance_minutes': '20', 'max_abandons': '3',
            'fenetre_abandons_jours': '7',
            'coefficient_distance_routiere': '1,45', 'actif': 'on',
        })
        self.assertEqual(res.status_code, 302)
        self.assertEqual(
            float(ParametrageLivraison.get_solo().coefficient_distance_routiere), 1.45,
        )

    def test_coefficient_hors_bornes_rejete(self):
        res = self.web.post('/admin-panel/livreurs/parametrage/', {
            'pourcentage_livreur': '70', 'seuil_paiement_auto': '5000',
            'delai_relance_minutes': '20', 'max_abandons': '3',
            'fenetre_abandons_jours': '7', 'coefficient_distance_routiere': '5',
        })
        self.assertEqual(res.status_code, 302)
        self.assertEqual(
            float(ParametrageLivraison.get_solo().coefficient_distance_routiere), 1.0,
        )

    def test_admin_edite_le_bareme_dun_restaurant(self):
        res = self.web.post(
            f'/admin-panel/restaurants/{self.resto.pk}/bareme-livraison/',
            {'palier_km': ['5', '20'], 'palier_prix': ['600', '1500']},
        )
        self.assertEqual(res.status_code, 302)
        paliers = list(self.resto.paliers_livraison.values_list('jusqu_a_km', 'prix'))
        self.assertEqual(
            [(float(k), int(p)) for k, p in paliers], [(5.0, 600), (20.0, 1500)],
        )

    def test_fiche_restaurant_affiche_la_zone(self):
        self._bareme((5, 500))
        res = self.web.get(f'/admin-panel/restaurants/{self.resto.pk}/')
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'Zone de livraison')

    def test_liste_signale_bareme_non_configure(self):
        res = self.web.get('/admin-panel/restaurants/')
        self.assertContains(res, 'Barème non configuré')
