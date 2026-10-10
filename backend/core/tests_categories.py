"""Catégories de plats : API client (accueil + page catégorie) et CRUD admin."""
from django.test import TestCase, override_settings, Client
from rest_framework.test import APIClient

from .categories_icones import suggerer_icone
from .models import Categorie, Plat, RestaurantProfile, User
from .tests import NO_THROTTLE


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class CategoriesTests(TestCase):
    def setUp(self):
        Categorie.objects.all().delete()  # catégories semées par les migrations
        resto_user = User.objects.create_user(
            username='r@cat.cm', email='r@cat.cm', password='pass1234', role='restaurant',
        )
        self.resto = RestaurantProfile.objects.create(
            user=resto_user, nom='Resto Cat', adresse='Douala', ville='Douala',
            is_open=True, is_verified=True, commission_rate=10,
        )
        self.grill = Categorie.objects.create(nom='Grillades', icone='flame', ordre=1)
        self.pizza = Categorie.objects.create(nom='Pizzas', icone='pizza', ordre=0)
        self.masquee = Categorie.objects.create(nom='Cachée', is_active=False, ordre=2)
        for nom, visible in [('Soya', True), ('Brochette', True), ('Retiré', False)]:
            Plat.objects.create(
                restaurant=self.resto, categorie=self.grill, nom=nom, prix=2000,
                is_available=True, is_visible=visible,
            )
        self.admin = User.objects.create_user(
            username='a@cat.cm', email='a@cat.cm', password='pass1234', role='admin',
        )

    def test_api_actives_dans_l_ordre_avec_nombre_de_plats(self):
        data = APIClient().get('/api/client/categories').json()
        self.assertEqual([c['nom'] for c in data], ['Pizzas', 'Grillades'])
        grill = data[1]
        self.assertEqual(grill['icone'], 'flame')
        self.assertEqual(grill['icone_type'], 'icone')
        self.assertEqual(grill['nb_plats'], 2)  # le plat masqué n'est pas compté

    def test_plats_filtrables_par_identifiant_et_par_nom(self):
        api = APIClient()
        par_id = api.get(f'/api/client/plats?categorie={self.grill.pk}').json()
        par_nom = api.get('/api/client/plats?categorie=grillades').json()
        self.assertEqual(len(par_id), 2)
        self.assertEqual(len(par_nom), 2)

    def test_admin_cree_modifie_supprime(self):
        c = Client()
        c.force_login(self.admin)
        r = c.post('/admin-panel/categories/nouvelle/', {
            'nom': 'Brunch', 'icone_type': 'icone', 'icone': 'coffee', 'is_active': 'on',
        })
        self.assertEqual(r.status_code, 302)
        brunch = Categorie.objects.get(nom='Brunch')
        self.assertEqual(brunch.icone, 'coffee')
        self.assertEqual(brunch.ordre, 3)  # ajoutée en fin de liste

        # Icône inconnue → on garde la précédente
        c.post(f'/admin-panel/categories/{brunch.pk}/', {'nom': 'Brunch', 'icone_type': 'icone', 'icone': 'inconnue'})
        brunch.refresh_from_db()
        self.assertEqual(brunch.icone, 'coffee')
        self.assertFalse(brunch.is_active)

        # Type « image » sans image → refusé
        c.post(f'/admin-panel/categories/{brunch.pk}/', {'nom': 'Brunch', 'icone_type': 'image'})
        brunch.refresh_from_db()
        self.assertEqual(brunch.icone_type, 'icone')

        # Doublon de nom refusé
        c.post('/admin-panel/categories/nouvelle/', {'nom': 'pizzas', 'icone_type': 'icone', 'icone': 'pizza'})
        self.assertEqual(Categorie.objects.filter(nom__iexact='pizzas').count(), 1)

        # Suppression : les plats restent, sans catégorie
        c.post(f'/admin-panel/categories/{self.grill.pk}/supprimer/')
        self.assertFalse(Categorie.objects.filter(pk=self.grill.pk).exists())
        self.assertEqual(Plat.objects.filter(categorie__isnull=True).count(), 3)

    def test_reordonner(self):
        c = Client()
        c.force_login(self.admin)
        c.post(f'/admin-panel/categories/{self.grill.pk}/monter/')
        self.assertEqual(
            list(Categorie.objects.values_list('nom', flat=True)),
            ['Grillades', 'Pizzas', 'Cachée'],
        )

    def test_admin_reserve_aux_administrateurs(self):
        c = Client()
        c.force_login(self.resto.user)
        r = c.get('/admin-panel/categories/')
        self.assertNotEqual(r.status_code, 200)

    def test_suggestion_d_icone(self):
        self.assertEqual(suggerer_icone('Poulet & Volailles'), 'drumstick')
        self.assertEqual(suggerer_icone('Inconnu'), 'utensils')
