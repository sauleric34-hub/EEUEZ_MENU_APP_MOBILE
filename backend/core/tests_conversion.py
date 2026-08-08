"""Conversion des points en réduction au paiement.

Ces tests touchent de l'ARGENT RÉEL. L'invariant central est que la réduction
sort de la marge de la plateforme : la part du restaurant et les frais du
livreur ne bougent jamais.
"""

from django.test import TestCase, override_settings, Client
from rest_framework.test import APIClient

from . import fidelite
from .models import (
    Categorie, Commande, MouvementPoints, ParametrageFidelite, Plat,
    RestaurantProfile, Transaction, User,
)
from .tests import NO_THROTTLE


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class ConversionPaiementTests(TestCase):

    def setUp(self):
        self.client_user = User.objects.create_user(
            username='c@cv.cm', email='c@cv.cm', password='pass1234', role='client',
        )
        self.resto_user = User.objects.create_user(
            username='r@cv.cm', email='r@cv.cm', password='pass1234', role='restaurant',
        )
        self.resto = RestaurantProfile.objects.create(
            user=self.resto_user, nom='Resto CV', adresse='Douala', ville='Douala',
            is_open=True, is_verified=True, commission_rate=10, frais_livraison=500,
        )
        cat = Categorie.objects.create(nom='Plats')
        # prix 10 000 → prix_client 11 000 (majoration 10 %)
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='Grand plat', prix=10000,
            frais_livraison=500, is_available=True, is_visible=True,
        )
        self.api = APIClient()
        self.config = ParametrageFidelite.get_solo()   # 100 pts = 500 F, min 100, max 30 %

    def _auth(self):
        tok = self.api.post(
            '/api/auth/login', {'email': 'c@cv.cm', 'password': 'pass1234'}, format='json',
        ).json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")

    def _crediter(self, points):
        fidelite.crediter(
            self.client_user, points, motif='ajustement',
            source_type='test', source_id=f'seed-{points}',
        )
        self.client_user.refresh_from_db()

    def _commander(self, utiliser_points=False, quantite=1):
        payload = {
            'restaurant': self.resto.id, 'adresse_livraison': 'Akwa',
            'mode_paiement': 'especes',
            'items': [{'plat_id': self.plat.id, 'quantite': quantite}],
        }
        if utiliser_points:
            payload['utiliser_points'] = True
        return self.api.post('/api/client/commandes/', payload, format='json')

    def _solde(self):
        self.client_user.refresh_from_db()
        return self.client_user.points_solde

    # ── Cas nominal ─────────────────────────────────────────
    def test_reduction_appliquee_et_points_debites(self):
        self._crediter(200)          # = 1 000 F théoriques
        self._auth()
        res = self._commander(utiliser_points=True)
        self.assertEqual(res.status_code, 201)

        commande = Commande.objects.get(pk=res.json()['id'])
        # Panier : 11 000 + 500 = 11 500 ; plafond 30 % = 3 450 ; solde = 1 000 F
        self.assertEqual(int(commande.reduction_points), 1000)
        self.assertEqual(commande.points_utilises, 200)
        self.assertEqual(int(commande.montant_total), 10500)
        self.assertEqual(self._solde(), 0)

    def test_le_restaurant_est_paye_integralement(self):
        """L'invariant qui compte : la réduction ne sort JAMAIS de sa part."""
        self._crediter(200)
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        # Prix de base intacts, quelle que soit la réduction.
        self.assertEqual(int(commande.montant_restaurant), 10000)
        # C'est la marge plateforme qui absorbe : 1 000 - 1 000 = 0
        self.assertEqual(int(commande.commission_eeuez), 0)

    def test_la_plateforme_peut_absorber_plus_que_sa_marge(self):
        """Réduction > commission : la marge devient négative, le resto est
        toujours payé. C'est un coût marketing assumé, pas un impayé."""
        self._crediter(600)          # 3 000 F, sous le plafond de 3 450
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        self.assertEqual(int(commande.reduction_points), 3000)
        self.assertEqual(int(commande.montant_restaurant), 10000)
        self.assertLess(int(commande.commission_eeuez), 0)
        self.assertEqual(int(commande.montant_total), 8500)

    def test_le_montant_paye_correspond_a_la_transaction(self):
        """CamerPay doit encaisser exactement le montant réduit."""
        self._crediter(200)
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        transaction = Transaction.objects.get(commande=commande)
        self.assertEqual(int(transaction.montant), int(commande.montant_total))
        self.assertEqual(int(transaction.montant), 10500)

    # ── Plafonds ────────────────────────────────────────────
    def test_reduction_plafonnee_au_pourcentage(self):
        self._crediter(10000)        # 50 000 F théoriques, très au-dessus
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        # Plafond = 30 % de 11 500 = 3 450 → arrondi au palier de 500 = 3 000
        self.assertEqual(int(commande.reduction_points), 3000)
        self.assertEqual(commande.points_utilises, 600)
        # Le reste du solde est conservé.
        self.assertEqual(self._solde(), 10000 - 600)

    def test_solde_sous_le_seuil_ne_donne_rien(self):
        self._crediter(50)           # seuil minimum = 100
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        self.assertEqual(int(commande.reduction_points), 0)
        self.assertEqual(commande.points_utilises, 0)
        self.assertEqual(self._solde(), 50)

    def test_sans_points_aucune_reduction(self):
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        self.assertEqual(int(commande.reduction_points), 0)
        self.assertEqual(int(commande.montant_total), 11500)

    def test_sans_demande_explicite_les_points_sont_conserves(self):
        """Les points ne se dépensent jamais tout seuls."""
        self._crediter(500)
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=False).json()['id'])
        self.assertEqual(int(commande.reduction_points), 0)
        self.assertEqual(self._solde(), 500)

    def test_programme_inactif_ne_reduit_pas(self):
        self.config.actif = False
        self.config.save(update_fields=['actif'])
        self._crediter(500)
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        self.assertEqual(int(commande.reduction_points), 0)

    def test_le_client_ne_fixe_pas_le_montant_de_la_reduction(self):
        """Même en envoyant une réduction énorme, seul le serveur décide."""
        self._crediter(200)
        self._auth()
        res = self.api.post('/api/client/commandes/', {
            'restaurant': self.resto.id, 'adresse_livraison': 'Akwa',
            'mode_paiement': 'especes', 'utiliser_points': True,
            'reduction_points': 999999, 'points_utilises': 999999,
            'montant_total': 1,
            'items': [{'plat_id': self.plat.id, 'quantite': 1}],
        }, format='json')
        commande = Commande.objects.get(pk=res.json()['id'])
        self.assertEqual(int(commande.reduction_points), 1000)
        self.assertEqual(int(commande.montant_total), 10500)

    # ── Débit unique ────────────────────────────────────────
    def test_un_seul_mouvement_de_depense_par_commande(self):
        self._crediter(200)
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        depenses = MouvementPoints.objects.filter(
            motif='depense_commande', source_id=str(commande.pk),
        )
        self.assertEqual(depenses.count(), 1)
        self.assertEqual(depenses.first().montant, -200)

    def test_deux_commandes_ne_depensent_pas_deux_fois_le_meme_solde(self):
        self._crediter(200)
        self._auth()
        c1 = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        c2 = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        self.assertEqual(int(c1.reduction_points), 1000)
        self.assertEqual(int(c2.reduction_points), 0)   # solde épuisé
        self.assertEqual(self._solde(), 0)

    # ── Remboursement ───────────────────────────────────────
    def test_annulation_rend_les_points(self):
        self._crediter(200)
        self._auth()
        res = self.api.post('/api/client/commandes/', {
            'restaurant': self.resto.id, 'adresse_livraison': 'Akwa',
            'mode_paiement': 'mtn_money', 'utiliser_points': True,
            'items': [{'plat_id': self.plat.id, 'quantite': 1}],
        }, format='json')
        pk = res.json()['id']
        self.assertEqual(self._solde(), 0)

        self.assertEqual(self.api.post(f'/api/client/commandes/{pk}/annuler/').status_code, 204)
        self.assertEqual(self._solde(), 200)

    def test_refus_par_le_restaurant_rend_les_points(self):
        self._crediter(200)
        self._auth()
        commande = Commande.objects.get(pk=self._commander(utiliser_points=True).json()['id'])
        self.assertEqual(self._solde(), 0)

        web = Client()
        web.force_login(self.resto_user)
        web.post(f'/admin-panel/resto/commandes/{commande.pk}/action/', {'action': 'refuser'})

        commande.refresh_from_db()
        self.assertEqual(commande.statut, 'refusee')
        self.assertEqual(self._solde(), 200)
        self.assertEqual(commande.points_utilises, 0)

    # ── Aperçu pour le panier ───────────────────────────────
    def test_apercu_expose_la_reduction_applicable(self):
        self._crediter(200)
        self._auth()
        res = self.api.get('/api/client/fidelite?montant=11500')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data['solde'], 200)
        self.assertEqual(data['reduction'], 1000)
        self.assertEqual(data['points_utilisables'], 200)
        self.assertEqual(data['seuil_minimum'], self.config.seuil_minimum_conversion)

    def test_apercu_respecte_le_plafond_du_panier(self):
        self._crediter(10000)
        self._auth()
        # Petit panier : le plafond de 30 % écrase la valeur du solde.
        data = self.api.get('/api/client/fidelite?montant=2000').json()
        self.assertEqual(data['reduction'], 500)   # 30 % de 2 000 = 600 → palier 500

    def test_apercu_exige_authentification(self):
        self.assertEqual(self.api.get('/api/client/fidelite?montant=1000').status_code, 401)

    # ── Cohérence du grand livre ────────────────────────────
    def test_le_solde_reste_aligne_apres_depense_et_remboursement(self):
        self._crediter(200)
        self._auth()
        res = self.api.post('/api/client/commandes/', {
            'restaurant': self.resto.id, 'adresse_livraison': 'Akwa',
            'mode_paiement': 'mtn_money', 'utiliser_points': True,
            'items': [{'plat_id': self.plat.id, 'quantite': 1}],
        }, format='json')
        self.api.post(f"/api/client/commandes/{res.json()['id']}/annuler/")
        self.assertEqual(self._solde(), fidelite.solde_reel(self.client_user))
