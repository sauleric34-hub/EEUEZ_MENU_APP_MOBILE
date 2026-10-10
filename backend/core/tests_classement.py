"""Ordre « découverte » des plats et alternance du fil de publications."""
from datetime import timedelta
from statistics import mean

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .classement_plats import annoter_popularite, classer_plats
from .models import Commande, Favori, LigneCommande, Plat, Publication, RestaurantProfile, User
from .tests import NO_THROTTLE


def _resto(nom, ville):
    u = User.objects.create_user(username=f'{nom}@r.cm', email=f'{nom}@r.cm', password='x', role='restaurant')
    return RestaurantProfile.objects.create(
        user=u, nom=nom, adresse=ville, ville=ville, is_open=True, is_verified=True, commission_rate=10,
    )


def _clients(n, ville=''):
    return [
        User.objects.create_user(username=f'c{i}{ville}@c.cm', email=f'c{i}{ville}@c.cm', password='x', role='client', ville=ville)
        for i in range(n)
    ]


def _vieillir(plat, jours=30):
    Plat.objects.filter(pk=plat.pk).update(created_at=timezone.now() - timedelta(days=jours))


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class ClassementPlatsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.douala = _resto('douala', 'Douala')
        self.yaounde = _resto('yaounde', 'Yaoundé')
        self.plats = []
        for i in range(12):
            p = Plat.objects.create(
                restaurant=self.douala if i % 2 else self.yaounde, nom=f'Plat {i}', prix=2000,
                is_available=True, is_visible=True,
            )
            _vieillir(p)
            self.plats.append(p)

    def _ordre(self, user, ville=''):
        qs = annoter_popularite(Plat.objects.select_related('restaurant'))
        return [p.pk for p in classer_plats(qs, user=user, ville=ville or user.ville)]

    def test_deux_utilisateurs_ordres_differents_et_stables(self):
        a, b = _clients(2)
        self.assertEqual(self._ordre(a), self._ordre(a), 'stable pour un même utilisateur')
        self.assertNotEqual(self._ordre(a), self._ordre(b), 'différent entre utilisateurs')

    def test_plats_de_la_ville_d_abord(self):
        (client,) = _clients(1, ville='Douala')
        ordre = self._ordre(client)
        locaux = {p.pk for p in self.plats if p.restaurant_id == self.douala.pk}
        self.assertEqual(set(ordre[:len(locaux)]), locaux)

    def test_les_plats_populaires_passent_plus_souvent_devant(self):
        star = self.plats[0]
        acheteur = _clients(1, ville='x')[0]
        cmd = Commande.objects.create(client=acheteur, restaurant=star.restaurant, montant_total=0, adresse_livraison='-')
        LigneCommande.objects.create(commande=cmd, plat=star, quantite=40, prix_unitaire=2000)
        for c in _clients(8, ville='fan'):
            Favori.objects.create(client=c, plat=star)
        positions_star, positions_autre = [], []
        for c in _clients(30, ville='z'):
            ordre = self._ordre(c, ville='')
            positions_star.append(ordre.index(star.pk))
            positions_autre.append(ordre.index(self.plats[2].pk))
        self.assertLess(mean(positions_star), mean(positions_autre))

    def test_nouveau_plat_en_tete_chez_une_partie_des_utilisateurs(self):
        neuf = Plat.objects.create(restaurant=self.douala, nom='Tout neuf', prix=2500, is_available=True, is_visible=True)
        en_tete = sum(1 for c in _clients(40, ville='Douala') if neuf.pk in self._ordre(c)[:2])
        self.assertGreater(en_tete, 0, 'au moins un utilisateur le voit en tête')
        self.assertLess(en_tete, 40, 'mais pas tout le monde')

    def test_api_renvoie_l_ordre_personnalise(self):
        a, b = _clients(2, ville='Douala')
        ids = []
        for u in (a, b):
            api = APIClient()
            api.force_authenticate(u)
            ids.append([d['id'] for d in api.get('/api/client/plats').json()])
        self.assertEqual(sorted(ids[0]), sorted(ids[1]))
        self.assertNotEqual(ids[0], ids[1])
        recent = APIClient().get('/api/client/plats?ordre=recent').json()
        self.assertEqual([d['id'] for d in recent], sorted(ids[0], reverse=True))


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class AlternanceFilTests(TestCase):
    def setUp(self):
        cache.clear()
        self.resto = _resto('fil', 'Douala')
        # Des publications anciennes et peu populaires, bien au-delà de l'ancienne fenêtre de 60 jours
        for i in range(25):
            p = Publication.objects.create(restaurant=self.resto, texte=f'P{i}', statut='publiee')
            Publication.objects.filter(pk=p.pk).update(created_at=timezone.now() - timedelta(days=5 * i))

    def _fil(self, user):
        api = APIClient()
        api.force_authenticate(user)
        ids, curseur, page = [], None, 1
        while True:
            q = f'/api/client/publications/feed?taille=10&page={page}' + (f'&curseur={curseur}' if curseur else '')
            data = api.get(q).json()
            ids += [p['id'] for p in data['resultats']]
            curseur = data.get('curseur')
            if not data.get('a_suivant'):
                return ids
            page += 1

    def test_toutes_les_publications_sont_atteignables_sans_doublon(self):
        (u,) = _clients(1)
        ids = self._fil(u)
        self.assertEqual(len(ids), 25)
        self.assertEqual(len(set(ids)), 25)

    def test_la_tete_du_fil_alterne_entre_utilisateurs(self):
        tetes = {tuple(self._fil(u)[:3]) for u in _clients(10)}
        self.assertGreater(len(tetes), 5, 'les utilisateurs ne doivent pas tous voir les mêmes publications en tête')


@override_settings(REST_FRAMEWORK=NO_THROTTLE)
class PerformanceListePlatsTests(TestCase):
    """Garde-fou anti « N+1 » : le nombre de requêtes de /client/plats ne doit
    pas dépendre du nombre de plats (cf. core/prechargement_plats.py)."""

    def _requetes(self, api):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        with CaptureQueriesContext(connection) as ctx:
            self.assertEqual(api.get('/api/client/plats').status_code, 200)
        return len(ctx.captured_queries)

    def test_nombre_de_requetes_constant(self):
        from .models_complements import GroupeComplement, OptionComplement
        cache.clear()
        resto = _resto('perf', 'Douala')
        (client,) = _clients(1, ville='Douala')
        api = APIClient()
        api.force_authenticate(client)

        def ajouter(n):
            for i in range(n):
                p = Plat.objects.create(restaurant=resto, nom=f'P{i}', prix=1000, is_available=True, is_visible=True)
                g = GroupeComplement.objects.create(plat=p, nom='Sauce')
                OptionComplement.objects.create(groupe=g, nom='Piment', supplement=0)
                Favori.objects.create(client=client, plat=p)

        ajouter(3)
        peu = self._requetes(api)
        ajouter(15)
        beaucoup = self._requetes(api)
        self.assertEqual(peu, beaucoup, f'{peu} requêtes pour 3 plats contre {beaucoup} pour 18')
