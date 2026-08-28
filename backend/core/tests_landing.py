"""Tests de la page d'accueil publique : vraies données et classement par note."""

from django.test import TestCase, Client
from django.contrib.auth import get_user_model

from core.models import RestaurantProfile, Plat, PlatNote, Commande

User = get_user_model()


class LandingTests(TestCase):
    def _resto(self, nom, *, verifie=True, ouvert=True, actif=True):
        user = User.objects.create_user(
            username=f'u_{nom}', password='x', is_active=actif,
        )
        return RestaurantProfile.objects.create(
            user=user, nom=nom, ville='Douala', adresse='Akwa',
            is_verified=verifie, is_open=ouvert,
        )

    def _plat(self, resto, nom, prix=1000, visible=True, dispo=True, image='plats/demo.jpg'):
        # La vitrine d'accueil n'affiche que les plats illustrés
        # (landing_view : .exclude(image='')) — on en pose une par défaut.
        return Plat.objects.create(
            restaurant=resto, nom=nom, prix=prix, image=image,
            is_visible=visible, is_available=dispo,
        )

    def _noter(self, plat, notes):
        """Attribue une liste de notes au plat, chacune par un client distinct."""
        for i, note in enumerate(notes):
            client = User.objects.create_user(username=f'c_{plat.pk}_{i}', password='x')
            PlatNote.objects.create(client=client, plat=plat, note=note)

    def _page(self):
        reponse = Client().get('/')
        self.assertEqual(reponse.status_code, 200)
        return reponse

    # ── Vraies données ──────────────────────────────────────
    def test_affiche_les_restaurants_de_la_base(self):
        self._resto('Le Phenix')
        contexte = self._page().context
        self.assertEqual([r.nom for r in contexte['restaurants']], ['Le Phenix'])

    def test_affiche_les_plats_de_la_base(self):
        resto = self._resto('Chez Mama')
        self._plat(resto, 'Ndole')
        contexte = self._page().context
        self.assertEqual([p.nom for p in contexte['plats_vedette']], ['Ndole'])

    def test_exclut_restaurants_non_verifies_fermes_ou_desactives(self):
        self._resto('NonVerifie', verifie=False)
        self._resto('Ferme', ouvert=False)
        self._resto('Desactive', actif=False)
        self.assertEqual(list(self._page().context['restaurants']), [])

    def test_exclut_plats_invisibles_ou_indisponibles(self):
        resto = self._resto('Resto')
        self._plat(resto, 'Cache', visible=False)
        self._plat(resto, 'Rupture', dispo=False)
        self.assertEqual(list(self._page().context['plats_vedette']), [])

    # ── Classement par note ─────────────────────────────────
    def test_les_plats_sont_classes_par_note(self):
        resto = self._resto('Resto')
        faible = self._plat(resto, 'Faible')
        fort = self._plat(resto, 'Fort')
        self._noter(faible, [2, 2, 2, 2, 2, 2])
        self._noter(fort, [5, 5, 5, 5, 5, 5])
        noms = [p.nom for p in self._page().context['plats_vedette']]
        self.assertEqual(noms[0], 'Fort')

    def test_les_restaurants_sont_classes_par_note(self):
        faible = self._resto('Mediocre')
        fort = self._resto('Excellent')
        self._noter(self._plat(faible, 'p1'), [2, 2, 2, 2, 2, 2])
        self._noter(self._plat(fort, 'p2'), [5, 5, 5, 5, 5, 5])
        noms = [r.nom for r in self._page().context['restaurants']]
        self.assertEqual(noms[0], 'Excellent')

    def test_une_note_isolee_ne_depasse_pas_une_moyenne_etablie(self):
        """Le garde-fou : 5/5 sur une seule note ne doit pas coiffer 4,8 sur
        vingt notes, sinon la vitrine serait truquable avec un seul avis.

        Le score tire les peu-notés vers la moyenne de la plateforme ; le
        scénario comprend donc un établissement médiocre, sans quoi cette
        moyenne vaudrait ~4,8 et ne freinerait plus personne.
        """
        chanceux = self._resto('UneSeuleNote')
        etabli = self._resto('Etabli')
        mediocre = self._resto('Mediocre')
        self._noter(self._plat(chanceux, 'p1'), [5])
        self._noter(self._plat(etabli, 'p2'), [5] * 16 + [4] * 4)   # moyenne 4,8
        self._noter(self._plat(mediocre, 'p3'), [2] * 20)           # tire la moyenne globale
        noms = [r.nom for r in self._page().context['restaurants']]
        self.assertEqual(noms[0], 'Etabli')
        self.assertLess(noms.index('Etabli'), noms.index('UneSeuleNote'))

    def test_restaurant_sans_note_affiche_zero_note(self):
        self._resto('Nouveau')
        resto = self._page().context['restaurants'][0]
        self.assertEqual(resto.nb_notes, 0)

    # ── Régressions ─────────────────────────────────────────
    def test_pas_de_plats_en_double(self):
        """order_by('-restaurant__commandes') dupliquait chaque plat autant de
        fois qu'il y avait de commandes au restaurant."""
        resto = self._resto('Resto')
        plat = self._plat(resto, 'Unique')
        client = User.objects.create_user(username='acheteur', password='x')
        for _ in range(3):
            Commande.objects.create(client=client, restaurant=resto, montant_total=1000)
        self._noter(plat, [5, 4])
        noms = [p.nom for p in self._page().context['plats_vedette']]
        self.assertEqual(noms, ['Unique'], 'le plat ne doit apparaître qu\'une fois')

    def test_le_compteur_de_commandes_nest_pas_gonfle(self):
        """Les annotations multiples (notes + commandes) se multipliaient entre
        elles : 2 commandes et 3 notes donnaient 6 commandes."""
        resto = self._resto('Resto')
        self._noter(self._plat(resto, 'p1'), [5, 4, 3])
        client = User.objects.create_user(username='acheteur', password='x')
        for _ in range(2):
            Commande.objects.create(client=client, restaurant=resto, montant_total=1000)
        affiche = self._page().context['restaurants'][0]
        self.assertEqual(affiche.nb_commandes, 2)

    def test_le_compteur_de_plats_nest_pas_gonfle(self):
        resto = self._resto('Resto')
        self._noter(self._plat(resto, 'p1'), [5, 4, 3])
        self._plat(resto, 'p2')
        self._plat(resto, 'invisible', visible=False)
        affiche = self._page().context['restaurants'][0]
        self.assertEqual(affiche.nb_plats, 2)
