"""Abandon d'une mission : retour au pool, timeout, auto-désactivation."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import RestaurantProfile, Commande, Livraison
from core.models_livraison import ParametrageLivraison, AbandonLivraison
from core.delivery import abandonner_livraison, prendre_commande_libre

User = get_user_model()


class AbandonBase(TestCase):
    def setUp(self):
        patron = User.objects.create_user(username='resto', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Chez Test', ville='Douala', adresse='Akwa',
            is_verified=True, is_open=True, frais_livraison=1000,
        )
        self.client_final = User.objects.create_user(username='client', password='x', role='client')
        self.livreur = User.objects.create_user(username='indep', password='x', role='livreur')

    def _mission_prise(self):
        cmd = Commande.objects.create(
            client=self.client_final, restaurant=self.resto, montant_total=5000,
            statut='prete', livraison_libre=True, paiement_confirme=True,
        )
        return prendre_commande_libre(cmd.pk, self.livreur)


class AbandonTest(AbandonBase):
    def test_abandon_remet_la_commande_au_pool(self):
        livraison = self._mission_prise()
        commande = livraison.commande
        abandonner_livraison(livraison, 'Panne moto', auto=False)

        commande.refresh_from_db()
        self.assertTrue(commande.livraison_libre)
        self.assertEqual(commande.statut, 'prete')
        self.assertFalse(Livraison.objects.filter(commande=commande).exists())
        self.assertTrue(AbandonLivraison.objects.filter(livreur=self.livreur).exists())

        # Un autre livreur peut la reprendre.
        autre = User.objects.create_user(username='indep2', password='x', role='livreur')
        prendre_commande_libre(commande.pk, autre)
        self.assertTrue(Livraison.objects.filter(commande=commande, livreur=autre).exists())

    def test_abandon_via_api(self):
        livraison = self._mission_prise()
        api = APIClient(); api.force_authenticate(self.livreur)
        rep = api.post(f'/api/livreur/missions/{livraison.commande_id}/abandonner/', {'motif': 'RAS'})
        self.assertEqual(rep.status_code, 200)
        self.assertFalse(Livraison.objects.filter(pk=livraison.pk).exists())

    def test_auto_desactivation_apres_quota(self):
        param = ParametrageLivraison.get_solo()
        param.max_abandons = 2
        param.save()

        for _ in range(2):
            abandonner_livraison(self._mission_prise(), 'x', auto=False)

        self.livreur.refresh_from_db()
        self.assertFalse(self.livreur.is_active)

        # Bloqué → ne peut plus prendre de mission.
        cmd = Commande.objects.create(
            client=self.client_final, restaurant=self.resto, montant_total=5000,
            statut='prete', livraison_libre=True, paiement_confirme=True,
        )
        from core.delivery import PriseImpossible
        with self.assertRaises(PriseImpossible):
            prendre_commande_libre(cmd.pk, self.livreur)


class TimeoutTest(AbandonBase):
    def test_relance_remet_au_pool_les_missions_non_demarrees(self):
        livraison = self._mission_prise()
        Livraison.objects.filter(pk=livraison.pk).update(
            created_at=timezone.now() - timezone.timedelta(minutes=45),
        )
        from django.core.management import call_command
        call_command('relancer_livraisons')

        self.assertFalse(Livraison.objects.filter(pk=livraison.pk).exists())
        ab = AbandonLivraison.objects.get(livreur=self.livreur)
        self.assertTrue(ab.auto)
