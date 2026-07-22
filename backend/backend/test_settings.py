# Réglages de test : base SQLite en mémoire (indépendant de MySQL/XAMPP).
# Usage : python manage.py test core.tests --settings=backend.test_settings
from .settings import *  # noqa

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Le stockage statique « manifeste » (WhiteNoise) exige un collectstatic
# préalable : sans lui, tout test qui rend un template du workspace échoue sur
# « Missing staticfiles manifest entry ». En test, stockage simple.
STORAGES = {
    'default': {'BACKEND': 'core.storage.ASCIIFileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}

# Cache neutralisé par défaut en test : sans cela, cache_page (page d'accueil)
# renverrait un response.context vide sur les hits, et le cache local fuirait
# entre les tests — brisant leur isolation. Les tests qui veulent VÉRIFIER la
# mise en cache réactivent un vrai cache localement (@override_settings).
CACHES = {
    'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'},
}

# Throttling désactivé en test.
#
# La limite de production sur /api/auth/login est de 10 requêtes/minute. Or une
# suite de tests s'authentifie des dizaines de fois par minute : passé le
# dixième appel, la connexion renvoie 429 et le test échoue sur une réponse
# sans jeton. Le résultat dépendait donc de la VITESSE de la machine — une
# suite rapide échouait, une suite lente passait.
#
# Les quotas restent actifs en production ; ils ne sont simplement pas
# l'objet de ces tests.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    'DEFAULT_THROTTLE_CLASSES': (),
    'DEFAULT_THROTTLE_RATES': {},
}
