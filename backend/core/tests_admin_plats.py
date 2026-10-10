"""Modification d'un plat par l'administrateur (formulaire partagé avec l'espace restaurant)."""
from django.test import Client, TestCase

from .models import AuditLog, Categorie, Plat, RestaurantProfile, User


class AdminModifiePlatTests(TestCase):
    def setUp(self):
        ur = User.objects.create_user(username='r@ap.cm', email='r@ap.cm', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(user=ur, nom='Resto AP', adresse='-', ville='Douala',
                                                      is_open=True, is_verified=True, commission_rate=10)
        self.plat = Plat.objects.create(restaurant=self.resto, nom='Ndolé', prix=3000, type_plat='resistance',
                                        is_available=True, is_visible=True)
        self.admin = User.objects.create_user(username='a@ap.cm', email='a@ap.cm', password='x', role='admin')
        self.web_admin = Client(); self.web_admin.force_login(self.admin)
        self.web_resto = Client(); self.web_resto.force_login(ur)
        self.cat = Categorie.objects.create(nom='Traditionnel')

    def _donnees(self, **kw):
        d = {'nom': 'Ndolé crevettes', 'prix': '3500', 'type_plat': 'resistance', 'description': 'Recette maison',
             'ingredients': 'Ndolé, Crevettes', 'categorie': str(self.cat.pk), 'is_available': 'on',
             'groupe_nom[0]': 'Accompagnement', 'groupe_obligatoire[0]': 'on',
             'option_nom[0][]': ['Plantain', 'Miondo'], 'option_prix[0][]': ['0', '300']}
        d.update(kw)
        return d

    def test_page_avec_apercu(self):
        r = self.web_admin.get(f'/admin-panel/dishes/{self.plat.pk}/modifier/')
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, 'apercu-plat')
        self.assertContains(r, 'Réglages administrateur')

    def test_admin_modifie_tout_et_journalise(self):
        r = self.web_admin.post(f'/admin-panel/dishes/{self.plat.pk}/modifier/', self._donnees(is_visible='on'))
        self.assertRedirects(r, f'/admin-panel/dishes/{self.plat.pk}/', fetch_redirect_response=False)
        self.plat.refresh_from_db()
        self.assertEqual((self.plat.nom, int(self.plat.prix), self.plat.categorie_id), ('Ndolé crevettes', 3500, self.cat.pk))
        self.assertEqual(self.plat.restaurant_id, self.resto.pk)  # reste au même restaurant
        groupe = self.plat.groupes_complements.get()
        self.assertEqual([o.nom for o in groupe.options.all()], ['Plantain', 'Miondo'])
        self.assertTrue(AuditLog.objects.filter(action='ADMIN_EDIT_DISH', object_id=str(self.plat.pk)).exists())

    def test_masque_par_l_admin_reste_masque_apres_edition_du_restaurant(self):
        self.web_admin.post(f'/admin-panel/dishes/{self.plat.pk}/modifier/', self._donnees())  # is_visible absent → masqué
        self.plat.refresh_from_db()
        self.assertFalse(self.plat.is_visible)
        self.web_resto.post(f'/admin-panel/resto/plats/{self.plat.pk}/', self._donnees(nom='Renommé'))
        self.plat.refresh_from_db()
        self.assertEqual(self.plat.nom, 'Renommé')
        self.assertFalse(self.plat.is_visible)

    def test_le_restaurant_cree_toujours_un_plat_visible(self):
        r = self.web_resto.post('/admin-panel/resto/plats/nouveau/', self._donnees(nom='Poulet DG'))
        self.assertEqual(r.status_code, 302)
        self.assertTrue(Plat.objects.get(nom='Poulet DG').is_visible)

    def test_formulaire_invalide(self):
        r = self.web_admin.post(f'/admin-panel/dishes/{self.plat.pk}/modifier/', self._donnees(prix='abc'))
        self.assertEqual(r.status_code, 200)
        self.plat.refresh_from_db()
        self.assertEqual(self.plat.nom, 'Ndolé')

    def test_reserve_aux_admins(self):
        r = self.web_resto.get(f'/admin-panel/dishes/{self.plat.pk}/modifier/')
        self.assertNotEqual(r.status_code, 200)
