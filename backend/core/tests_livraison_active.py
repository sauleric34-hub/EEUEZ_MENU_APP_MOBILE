"""Service « livraison » désactivable par restaurant + suivi admin qualité.

- Un restaurant peut désactiver la livraison (`livraison_active=False`) tout en
  gardant réservation et/ou vente à emporter actives : le panier « livraison »
  est alors refusé au checkout, mais le retrait sur place reste possible.
- Le management command alerter_livraisons_en_retard alerte l'équipe admin
  (une seule fois par livraison) passé 1h sans confirmation.
- La page admin « Qualité restaurants » agrège, par restaurant, les livraisons
  en retard et la série d'annulations consécutives en cours.
"""
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, Client, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import RestaurantProfile, Categorie, Plat, Commande, Livraison, User
from core.models_livraison import ParametrageLivraison
from core.views.qualite import annulations_consecutives, restaurants_a_surveiller

NO_THROTTLE = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_THROTTLE_CLASSES': (), 'DEFAULT_THROTTLE_RATES': {},
}

RESTO = (4.0, 9.0)
CLIENT_PROCHE = (4.0, 9.01)


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class LivraisonActiveCheckoutTest(TestCase):
    def setUp(self):
        ParametrageLivraison.get_solo()
        cat = Categorie.objects.create(nom='Plats')
        patron = User.objects.create_user(username='resto', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Chez Test', ville='Douala', adresse='Rue A',
            is_verified=True, is_open=True, frais_livraison=700,
            latitude=RESTO[0], longitude=RESTO[1],
            livraison_active=False, plats_a_emporter_actifs=True,
        )
        self.plat = Plat.objects.create(
            restaurant=self.resto, categorie=cat, nom='Ndolé', prix=2000,
            frais_livraison=500, is_available=True, is_visible=True,
        )
        self.client_user = User.objects.create_user(
            username='c@b.cm', email='c@b.cm', password='pass1234', role='client',
        )
        self.api = APIClient()
        tok = self.api.post(
            '/api/auth/login', {'email': 'c@b.cm', 'password': 'pass1234'}, format='json',
        ).json()
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tok['token']}")

    def _checkout(self, *, emporter):
        payload = {
            'adresse_livraison': 'Quelque part', 'latitude': CLIENT_PROCHE[0], 'longitude': CLIENT_PROCHE[1],
            'mode_paiement': 'especes',
            'items': [{'plat_id': self.plat.id, 'quantite': 1, 'emporter': emporter}],
        }
        return self.api.post('/api/client/commandes/groupees/', payload, format='json')

    def test_livraison_refusee_si_service_inactif(self):
        res = self._checkout(emporter=False)
        self.assertEqual(res.status_code, 400, res.content)

    def test_emporter_toujours_possible_si_livraison_inactive(self):
        res = self._checkout(emporter=True)
        self.assertEqual(res.status_code, 201, res.content)

    def test_livraison_acceptee_apres_activation(self):
        self.resto.livraison_active = True
        self.resto.save(update_fields=['livraison_active'])
        res = self._checkout(emporter=False)
        self.assertEqual(res.status_code, 201, res.content)


class AlerteLivraisonRetardTest(TestCase):
    def setUp(self):
        patron = User.objects.create_user(username='resto', password='x', role='restaurant', telephone='690000000')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Chez Test', ville='Douala', adresse='Rue A',
            is_verified=True, is_open=True,
        )
        self.client_user = User.objects.create_user(username='c', password='x', role='client')

    def _livraison(self, *, age_minutes, statut='en_livraison'):
        cmd = Commande.objects.create(
            client=self.client_user, restaurant=self.resto, montant_total=2000, statut=statut,
        )
        liv = Livraison.objects.create(commande=cmd, statut=statut)
        Livraison.objects.filter(pk=liv.pk).update(
            created_at=timezone.now() - timezone.timedelta(minutes=age_minutes),
        )
        liv.refresh_from_db()
        return liv

    @override_settings(ADMIN_ALERT_EMAILS=['admin@eeuez.test'])
    def test_alerte_envoyee_une_seule_fois(self):
        liv = self._livraison(age_minutes=90)
        call_command('alerter_livraisons_en_retard')
        liv.refresh_from_db()
        self.assertTrue(liv.alerte_retard_envoyee)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('en retard', mail.outbox[0].subject)

        # Un second passage ne renvoie rien : déjà marquée.
        call_command('alerter_livraisons_en_retard')
        self.assertEqual(len(mail.outbox), 1)

    def test_livraison_recente_non_alertee(self):
        liv = self._livraison(age_minutes=10)
        call_command('alerter_livraisons_en_retard')
        liv.refresh_from_db()
        self.assertFalse(liv.alerte_retard_envoyee)

    def test_pas_de_destinataire_marque_quand_meme_pour_eviter_la_boucle(self):
        liv = self._livraison(age_minutes=90)
        call_command('alerter_livraisons_en_retard')  # ADMIN_ALERT_EMAILS vide par défaut en test
        liv.refresh_from_db()
        self.assertTrue(liv.alerte_retard_envoyee)
        self.assertEqual(len(mail.outbox), 0)


class QualiteRestaurantsTest(TestCase):
    def setUp(self):
        patron = User.objects.create_user(username='resto', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Chez Test', ville='Douala', adresse='Rue A',
            is_verified=True, is_open=True,
        )
        self.client_user = User.objects.create_user(username='c', password='x', role='client')
        self.admin = User.objects.create_user(username='admin', password='x', role='admin')

    def _commande(self, statut):
        return Commande.objects.create(
            client=self.client_user, restaurant=self.resto, montant_total=1000, statut=statut,
        )

    def test_serie_annulations_consecutives(self):
        self._commande('livree')
        self._commande('annulee')
        self._commande('annulee')
        self._commande('annulee')
        self.assertEqual(annulations_consecutives(self.resto), 3)

    def test_serie_interrompue_par_une_commande_valide(self):
        self._commande('annulee')
        self._commande('livree')
        self._commande('annulee')
        self.assertEqual(annulations_consecutives(self.resto), 1)

    def test_restaurant_remonte_dans_a_surveiller_au_dela_du_seuil(self):
        for _ in range(3):
            self._commande('annulee')
        self.assertIn(self.resto, restaurants_a_surveiller())

    def test_page_qualite_accessible_a_l_admin(self):
        self._commande('annulee')
        web = Client(); web.force_login(self.admin)
        res = web.get('/admin-panel/qualite/')
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'Chez Test')

    def test_dashboard_affiche_l_alerte_annulations(self):
        for _ in range(3):
            self._commande('annulee')
        web = Client(); web.force_login(self.admin)
        res = web.get('/admin-panel/')
        self.assertEqual(res.status_code, 200)
        # L'apostrophe de « d'affilée » est échappée en HTML (&#x27;) par le
        # rendu du template — on vérifie le fragment stable de part et d'autre.
        self.assertContains(res, "annulations")
        self.assertContains(res, "affilée : Chez Test")
