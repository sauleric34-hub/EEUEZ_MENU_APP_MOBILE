"""Écran cuisine (KDS) de l'espace restaurant web."""
from django.test import Client, TestCase

from .models import Commande, LigneCommande, Plat, RestaurantProfile, User
from .models_complements import ChoixLigneCommande


class EcranCuisineTests(TestCase):
    def setUp(self):
        u = User.objects.create_user(username='r@k.cm', email='r@k.cm', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=u, nom='Resto K', adresse='Douala', ville='Douala', is_open=True, is_verified=True, commission_rate=10,
        )
        self.client_user = User.objects.create_user(
            username='c@k.cm', email='c@k.cm', password='x', role='client', first_name='Awa', allergies='Arachides',
        )
        self.plat = Plat.objects.create(restaurant=self.resto, nom='Ndolé', prix=3000, is_available=True, is_visible=True)
        self.web = Client()
        self.web.force_login(u)

    def _commande(self, statut='en_attente', payee=True, resto=None):
        c = Commande.objects.create(
            client=self.client_user, restaurant=resto or self.resto, montant_total=3300,
            adresse_livraison='Akwa', statut=statut, paiement_confirme=payee, notes='Sans piment',
        )
        l = LigneCommande.objects.create(commande=c, plat=self.plat, quantite=2, prix_unitaire=3000)
        ChoixLigneCommande.objects.create(ligne=l, groupe_nom='Accompagnement', option_nom='Plantain')
        return c

    def test_page_et_donnees(self):
        self.assertEqual(self.web.get('/admin-panel/resto/cuisine/').status_code, 200)
        active = self._commande()
        self._commande(payee=False)           # non payée → invisible
        self._commande(statut='livree')       # terminée → invisible
        data = self.web.get('/admin-panel/resto/cuisine/donnees/').json()
        self.assertEqual([c['id'] for c in data['commandes']], [active.pk])
        c = data['commandes'][0]
        self.assertEqual(c['client'], 'Awa')
        self.assertEqual(c['allergies'], 'Arachides')
        self.assertEqual(c['notes'], 'Sans piment')
        self.assertEqual(c['lignes'][0]['quantite'], 2)
        self.assertEqual(c['lignes'][0]['choix'], ['Accompagnement : Plantain'])
        self.assertEqual(data['servies_aujourdhui'], 1)

    def test_parcours_des_actions(self):
        c = self._commande()
        url = f'/admin-panel/resto/cuisine/{c.pk}/action/'
        self.assertEqual(self.web.post(url, {'action': 'prete'}).status_code, 409)  # pas avant d'accepter
        for action, statut in [('accepter', 'acceptee'), ('preparation', 'en_preparation'), ('prete', 'prete')]:
            r = self.web.post(url, {'action': action})
            self.assertEqual(r.status_code, 200, action)
            c.refresh_from_db()
            self.assertEqual(c.statut, statut)

    def test_commande_d_un_autre_restaurant_refusee(self):
        u2 = User.objects.create_user(username='r2@k.cm', email='r2@k.cm', password='x', role='restaurant')
        autre = RestaurantProfile.objects.create(user=u2, nom='Autre', adresse='-', ville='Douala', is_open=True, is_verified=True, commission_rate=10)
        c = self._commande(resto=autre)
        r = self.web.post(f'/admin-panel/resto/cuisine/{c.pk}/action/', {'action': 'accepter'})
        self.assertEqual(r.status_code, 404)

    def test_reserve_aux_restaurants(self):
        web = Client()
        web.force_login(self.client_user)
        self.assertNotEqual(web.get('/admin-panel/resto/cuisine/donnees/').status_code, 200)
