"""Tests de la livraison libre : pool de livreurs indépendants.

Un restaurant confie une commande au pool ; un livreur INDÉPENDANT (sans
restaurant attaché) la prend. La prise déplace de l'argent à la livraison :
les contrôles d'accès et l'anti double-prise sont donc critiques.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from rest_framework.test import APIClient

from core.models import RestaurantProfile, Commande, Livraison
from core.delivery import prendre_commande_libre, PriseImpossible

User = get_user_model()


class LivraisonLibreBaseTest(TestCase):
    def setUp(self):
        patron = User.objects.create_user(username='resto', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Chez Test', ville='Douala', adresse='Akwa',
            is_verified=True, is_open=True, frais_livraison=1000,
        )
        self.client_final = User.objects.create_user(username='client', password='x', role='client')
        # Livreur INDÉPENDANT (pas de restaurant attaché).
        self.libre = User.objects.create_user(username='indep', password='x', role='livreur')
        # Livreur ATTACHÉ à un restaurant.
        self.attache = User.objects.create_user(
            username='maison', password='x', role='livreur', restaurant_attache=self.resto,
        )

    def _commande(self, libre=True, statut='prete'):
        return Commande.objects.create(
            client=self.client_final, restaurant=self.resto,
            montant_total=5000, statut=statut, livraison_libre=libre,
        )


class HelperPriseTest(LivraisonLibreBaseTest):
    """Le cœur métier : prendre_commande_libre()."""

    def test_un_independant_prend_une_commande_libre(self):
        cmd = self._commande()
        livraison = prendre_commande_libre(cmd.pk, self.libre)
        self.assertEqual(livraison.livreur, self.libre)
        self.assertEqual(livraison.statut, 'assignee')

    def test_un_livreur_attache_ne_peut_pas_prendre(self):
        """Le pool libre est réservé aux indépendants."""
        cmd = self._commande()
        with self.assertRaises(PriseImpossible):
            prendre_commande_libre(cmd.pk, self.attache)
        self.assertFalse(Livraison.objects.filter(commande=cmd).exists())

    def test_un_client_ne_peut_pas_prendre(self):
        cmd = self._commande()
        with self.assertRaises(PriseImpossible):
            prendre_commande_libre(cmd.pk, self.client_final)

    def test_commande_non_liberee_refusee(self):
        cmd = self._commande(libre=False)
        with self.assertRaises(PriseImpossible):
            prendre_commande_libre(cmd.pk, self.libre)

    def test_pas_de_double_prise(self):
        """Une commande déjà prise ne peut pas l'être une seconde fois."""
        cmd = self._commande()
        prendre_commande_libre(cmd.pk, self.libre)

        autre = User.objects.create_user(username='indep2', password='x', role='livreur')
        with self.assertRaises(PriseImpossible):
            prendre_commande_libre(cmd.pk, autre)
        self.assertEqual(Livraison.objects.filter(commande=cmd).count(), 1)


class RestaurantLiberationTest(LivraisonLibreBaseTest):
    """Le restaurant confie / retire une commande du pool."""

    def _login_resto(self):
        nav = Client()
        nav.force_login(self.resto.user)
        return nav

    def _url(self, cmd):
        return f'/admin-panel/resto/commandes/{cmd.pk}/action/'

    def test_liberer_marque_la_commande(self):
        cmd = self._commande(libre=False, statut='prete')
        self._login_resto().post(self._url(cmd), {'action': 'liberer'})
        cmd.refresh_from_db()
        self.assertTrue(cmd.livraison_libre)

    def test_reprendre_retire_du_pool(self):
        cmd = self._commande(libre=True, statut='prete')
        self._login_resto().post(self._url(cmd), {'action': 'reprendre_libre'})
        cmd.refresh_from_db()
        self.assertFalse(cmd.livraison_libre)

    def test_assigner_maison_retire_du_pool(self):
        """Confier à un livreur maison sort la commande du pool libre."""
        cmd = self._commande(libre=True, statut='prete')
        self._login_resto().post(self._url(cmd), {'action': 'assigner', 'livreur': self.attache.pk})
        cmd.refresh_from_db()
        self.assertFalse(cmd.livraison_libre)
        self.assertTrue(Livraison.objects.filter(commande=cmd, livreur=self.attache).exists())


class LivreurWorkspaceTest(LivraisonLibreBaseTest):
    def test_le_dashboard_liste_les_missions_libres(self):
        cmd = self._commande()
        nav = Client(); nav.force_login(self.libre)
        page = nav.get('/admin-panel/livreur/')
        self.assertEqual(page.status_code, 200)
        self.assertIn(cmd, list(page.context['missions_libres']))

    def test_livreur_attache_ne_voit_pas_le_pool(self):
        self._commande()
        nav = Client(); nav.force_login(self.attache)
        page = nav.get('/admin-panel/livreur/')
        self.assertFalse(page.context['est_independant'])
        self.assertEqual(list(page.context['missions_libres']), [])

    def test_prendre_via_le_workspace(self):
        cmd = self._commande()
        nav = Client(); nav.force_login(self.libre)
        nav.post(f'/admin-panel/livreur/missions/{cmd.pk}/prendre/')
        self.assertTrue(Livraison.objects.filter(commande=cmd, livreur=self.libre).exists())


class MobileApiTest(LivraisonLibreBaseTest):
    def _api(self, user):
        api = APIClient(); api.force_authenticate(user=user); return api

    def test_liste_mobile_montre_les_missions_libres(self):
        cmd = self._commande()
        data = self._api(self.libre).get('/api/livreur/missions/').json()
        self.assertIn(cmd.pk, [c['id'] for c in data])

    def test_liste_mobile_vide_pour_livreur_attache(self):
        self._commande()
        data = self._api(self.attache).get('/api/livreur/missions/').json()
        self.assertEqual(data, [])

    def test_accept_mobile_cree_la_livraison(self):
        cmd = self._commande()
        rep = self._api(self.libre).post(f'/api/livreur/missions/{cmd.pk}/accept/')
        self.assertEqual(rep.status_code, 200)
        self.assertTrue(Livraison.objects.filter(commande=cmd, livreur=self.libre).exists())

    def test_accept_mobile_refuse_commande_non_liberee(self):
        cmd = self._commande(libre=False)
        rep = self._api(self.libre).post(f'/api/livreur/missions/{cmd.pk}/accept/')
        self.assertEqual(rep.status_code, 400)


class AdminLivreursTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='adm', password='x', role='admin')
        self.nav = Client(); self.nav.force_login(self.admin)

    def test_creer_un_livreur_independant(self):
        self.nav.post('/admin-panel/livreurs/', {
            'email': 'nouveau@livreur.cm', 'password': 'motdepasse', 'first_name': 'Jean',
        })
        livreur = User.objects.get(username='nouveau@livreur.cm')
        self.assertEqual(livreur.role, 'livreur')
        self.assertIsNone(livreur.restaurant_attache_id, 'doit être indépendant')

    def test_email_en_double_refuse(self):
        User.objects.create_user(username='pris@livreur.cm', email='pris@livreur.cm', password='x')
        self.nav.post('/admin-panel/livreurs/', {'email': 'pris@livreur.cm', 'password': 'motdepasse'})
        self.assertEqual(User.objects.filter(email='pris@livreur.cm').count(), 1)

    def test_mot_de_passe_trop_court_refuse(self):
        self.nav.post('/admin-panel/livreurs/', {'email': 'court@livreur.cm', 'password': '123'})
        self.assertFalse(User.objects.filter(username='court@livreur.cm').exists())

    def test_toggle_desactive(self):
        livreur = User.objects.create_user(username='x@x.cm', password='x', role='livreur')
        self.nav.post(f'/admin-panel/livreurs/{livreur.pk}/toggle/')
        livreur.refresh_from_db()
        self.assertFalse(livreur.is_active)
