"""Paiement des livreurs indépendants : part figée, grand livre, versement auto."""

from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from rest_framework.test import APIClient

from core.models import RestaurantProfile, Commande, Livraison, Transaction
from core.models_livraison import ParametrageLivraison, PaiementLivreur
from core.delivery import finaliser_livraison, marquer_livree_sans_code

User = get_user_model()


class BaseLivraison(TestCase):
    def setUp(self):
        patron = User.objects.create_user(username='resto', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Chez Test', ville='Douala', adresse='Akwa',
            is_verified=True, is_open=True, frais_livraison=1000,
        )
        self.client_final = User.objects.create_user(username='client', password='x', role='client')
        self.livreur = User.objects.create_user(username='indep', password='x', role='livreur')

    def _commande_livrable(self, frais=1500, part=None):
        cmd = Commande.objects.create(
            client=self.client_final, restaurant=self.resto, montant_total=6000,
            frais_livraison=frais, part_livreur=part if part is not None else round(frais * 0.7),
            statut='en_livraison',
        )
        return Livraison.objects.create(
            commande=cmd, livreur=self.livreur, statut='en_livraison',
            code_confirmation='ABC234',
        )


class PartFigeeTest(BaseLivraison):
    def test_la_creation_de_commande_fige_les_frais_et_la_part(self):
        plat = self.resto.plats.create(nom='Ndolé', prix=3000, frais_livraison=1500,
                                       is_available=True, is_visible=True)
        api = APIClient(); api.force_authenticate(self.client_final)
        rep = api.post('/api/client/commandes/', {
            'restaurant': self.resto.pk,
            'items': [{'plat_id': plat.pk, 'quantite': 1}],
        }, format='json')
        self.assertEqual(rep.status_code, 201)
        cmd = Commande.objects.get(pk=rep.json()['id'])
        self.assertEqual(int(cmd.frais_livraison), 1500)
        self.assertEqual(int(cmd.part_livreur), 1050)  # 70 % de 1500

    def test_le_livreur_est_credite_de_la_part_figee(self):
        liv = self._commande_livrable(frais=1500)  # part = 1050
        finaliser_livraison(liv, par='client')
        self.livreur.refresh_from_db()
        self.assertEqual(float(self.livreur.gain_total), 1050.0)

    def test_transaction_gain_livreur_unique(self):
        liv = self._commande_livrable()
        finaliser_livraison(liv, par='client')
        finaliser_livraison(liv, par='client')  # idempotent
        self.assertEqual(
            Transaction.objects.filter(commande=liv.commande, type='gain_livreur').count(), 1,
        )
        self.livreur.refresh_from_db()
        self.assertEqual(float(self.livreur.gain_total), 1050.0)


class VersementAutoTest(BaseLivraison):
    def test_pas_de_versement_sans_numero(self):
        param = ParametrageLivraison.get_solo()
        param.seuil_paiement_auto = 100
        param.save()
        finaliser_livraison(self._commande_livrable(), par='client')
        self.assertFalse(PaiementLivreur.objects.filter(livreur=self.livreur).exists())

    def test_versement_declenche_au_seuil(self):
        self.livreur.paiement_numero = '650000000'
        self.livreur.paiement_operateur = 'mtn_money'
        self.livreur.save()
        param = ParametrageLivraison.get_solo()
        param.seuil_paiement_auto = 1000
        param.save()

        finaliser_livraison(self._commande_livrable(frais=1500), par='client')

        paiement = PaiementLivreur.objects.get(livreur=self.livreur)
        self.assertEqual(int(paiement.montant), 1050)
        # Mode manuel par défaut → « approuvé », à verser à la main.
        self.assertEqual(paiement.statut, 'approuve')
        # Le solde disponible retombe à 0 (gain 1050 − paiement 1050).
        self.livreur.refresh_from_db()
        self.assertEqual(int(self.livreur.solde_livreur), 0)

    def test_validation_admin_d_une_course_sans_code_credite(self):
        liv = self._commande_livrable(frais=1500)
        marquer_livree_sans_code(liv, 'Client absent')
        liv.refresh_from_db()
        self.assertEqual(liv.statut, 'livree_sans_code')
        self.livreur.refresh_from_db()
        self.assertEqual(float(self.livreur.gain_total), 0.0)

        admin = User.objects.create_user(username='adm', password='x', role='admin')
        nav = Client(); nav.force_login(admin)
        rep = nav.post(f'/admin-panel/deliveries/{liv.pk}/action/', {'action': 'valider_sans_code'})
        self.assertEqual(rep.status_code, 302)

        liv.refresh_from_db(); self.livreur.refresh_from_db()
        self.assertEqual(liv.statut, 'livree')
        self.assertEqual(liv.confirmee_par, 'admin')
        self.assertEqual(liv.commande.statut, 'livree')
        self.assertEqual(float(self.livreur.gain_total), 1050.0)

    def test_refus_de_paiement_reconstitue_le_solde(self):
        self.livreur.paiement_numero = '650000000'
        self.livreur.save()
        p = PaiementLivreur.objects.create(livreur=self.livreur, montant=1050, numero='650000000')
        self.livreur.gain_total = 1050
        self.livreur.save()
        self.assertEqual(int(self.livreur.solde_livreur), 0)
        p.statut = 'refuse'
        p.save()
        self.livreur.refresh_from_db()
        self.assertEqual(int(self.livreur.solde_livreur), 1050)
