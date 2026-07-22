"""Tests du cache de note des restaurants (dénormalisation anti-N+1)."""

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import (
    RestaurantProfile, Plat, PlatNote, Commande, LigneCommande,
)

User = get_user_model()


class NoteCacheTests(TestCase):
    def setUp(self):
        patron = User.objects.create_user(username='r', password='x', role='restaurant')
        self.resto = RestaurantProfile.objects.create(
            user=patron, nom='Test', ville='Douala', adresse='Akwa',
        )
        self.plat = Plat.objects.create(
            restaurant=self.resto, nom='Ndole', prix=2000, is_visible=True,
        )

    def _noter(self, plat, note, suffixe=''):
        client = User.objects.create_user(username=f'c{plat.pk}{note}{suffixe}', password='x')
        return PlatNote.objects.create(client=client, plat=plat, note=note)

    # ── Le signal maintient le cache ────────────────────────
    def test_noter_met_a_jour_le_cache(self):
        self.assertEqual(self.resto.note_moyenne, 0.0)
        self._noter(self.plat, 4)
        self.resto.refresh_from_db()
        self.assertEqual(self.resto.note_moyenne, 4.0)

    def test_plusieurs_notes_moyennees(self):
        self._noter(self.plat, 5)
        self._noter(self.plat, 3)
        self.resto.refresh_from_db()
        self.assertEqual(self.resto.note_moyenne, 4.0)

    def test_supprimer_une_note_rafraichit(self):
        n5 = self._noter(self.plat, 5)
        self._noter(self.plat, 1)
        n5.delete()
        self.resto.refresh_from_db()
        self.assertEqual(self.resto.note_moyenne, 1.0)

    # ── La lecture ne coûte AUCUNE requête ──────────────────
    def test_note_moyenne_ne_fait_aucune_requete(self):
        """C'est tout l'intérêt : sérialiser N restaurants = 0 requête de note."""
        self._noter(self.plat, 4)
        resto = RestaurantProfile.objects.get(pk=self.resto.pk)
        with self.assertNumQueries(0):
            _ = resto.note_moyenne

    # ── La pondération par commandes reste correcte ─────────
    def test_ponderation_par_commandes(self):
        """Un plat très commandé pèse plus dans la moyenne du restaurant."""
        populaire = self.plat
        rare = Plat.objects.create(
            restaurant=self.resto, nom='Rare', prix=2000, is_visible=True,
        )
        self._noter(populaire, 5)
        self._noter(rare, 1)

        # 10 unités commandées du plat populaire → il pèse davantage.
        client = User.objects.create_user(username='acheteur', password='x')
        cmd = Commande.objects.create(client=client, restaurant=self.resto, montant_total=1000)
        LigneCommande.objects.create(commande=cmd, plat=populaire, quantite=10, prix_unitaire=2000)

        self.resto.recalculer_note()
        # Sans pondération la moyenne serait 3,0 ; pondérée, elle penche vers 5.
        self.assertGreater(self.resto.note_moyenne, 3.0)

    # ── Rattrapage de l'existant ────────────────────────────
    def test_commande_recalculer_notes(self):
        from django.core.management import call_command
        from io import StringIO

        self._noter(self.plat, 4)
        # Simule un cache périmé (ex. données d'avant la dénormalisation).
        RestaurantProfile.objects.filter(pk=self.resto.pk).update(note_cache=0)

        call_command('recalculer_notes', stdout=StringIO())

        self.resto.refresh_from_db()
        self.assertEqual(self.resto.note_moyenne, 4.0)
