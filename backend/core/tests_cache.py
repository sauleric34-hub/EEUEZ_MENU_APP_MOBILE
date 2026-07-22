"""Test du cache de la page d'accueil (mise en cache 60 s)."""

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, Client, override_settings

from core.models import RestaurantProfile

User = get_user_model()


# Le réglage de test utilise DummyCache (isolation) ; ici on réactive un vrai
# cache local pour VÉRIFIER la mise en cache. DEBUG=False car cache_page ne met
# rien en cache en mode debug.
@override_settings(
    DEBUG=False,
    ALLOWED_HOSTS=['*', 'testserver'],
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}},
)
class LandingCacheTests(TestCase):
    def setUp(self):
        cache.clear()  # isole ce test d'un cache résiduel.
        patron = User.objects.create_user(username='r', password='x', role='restaurant')
        RestaurantProfile.objects.create(
            user=patron, nom='Le Phenix', ville='Douala', adresse='Akwa',
            is_verified=True, is_open=True,
        )

    def test_seconde_visite_servie_depuis_le_cache(self):
        navigateur = Client()

        premiere = navigateur.get('/')
        self.assertEqual(premiere.status_code, 200)

        # La seconde visite ne doit toucher AUCUNE table : tout vient du cache.
        with self.assertNumQueries(0):
            seconde = navigateur.get('/')
        self.assertEqual(seconde.status_code, 200)
        self.assertEqual(premiere.content, seconde.content)

    def test_le_cache_expire_et_reflete_les_nouveautes(self):
        """Après vidage du cache, un nouveau restaurant apparaît."""
        Client().get('/')  # amorce le cache

        patron = User.objects.create_user(username='r2', password='x', role='restaurant')
        RestaurantProfile.objects.create(
            user=patron, nom='Nouveau Resto', ville='Douala', adresse='Bonapriso',
            is_verified=True, is_open=True,
        )

        # Tant que le cache tient, la nouveauté n'est pas visible…
        self.assertNotIn(b'Nouveau Resto', Client().get('/').content)

        # …puis elle apparaît une fois le cache expiré (simulé par un vidage).
        cache.clear()
        self.assertIn(b'Nouveau Resto', Client().get('/').content)
