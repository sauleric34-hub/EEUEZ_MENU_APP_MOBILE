from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# Charge un fichier .env local s'il existe (dev). En prod (cPanel/Passenger), les
# variables sont fournies par l'environnement — python-dotenv est alors facultatif.
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')
except Exception:
    pass


def _env_bool(name, default):
    """Lit un booléen depuis l'environnement, insensible à la casse.
    Accepte true/false, 1/0, yes/no, on/off (ex. DEBUG=False)."""
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ('1', 'true', 'yes', 'on')


# DEBUG=True par défaut pour le dev local ; la prod DOIT poser DEBUG=False.
DEBUG = _env_bool('DEBUG', True)

# En production (DEBUG=False), SECRET_KEY DOIT venir de l'environnement.
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'django-insecure-dev-only-change-me'
    else:
        raise RuntimeError('SECRET_KEY manquante : définissez la variable d\'environnement SECRET_KEY en production.')

# En dev, on autorise tout ; en prod, liste explicite via ALLOWED_HOSTS.
_default_hosts = '*' if DEBUG else 'localhost,127.0.0.1'
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', _default_hosts).split(',') if h.strip()]

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'channels',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'
ASGI_APPLICATION = 'backend.asgi.application'


# Base de données MySQL (cPanel). Les identifiants viennent des variables
# d'environnement : AUCUN secret n'est écrit en dur dans le code (sinon il finit
# dans Git). Le mot de passe DOIT être fourni via DB_PASSWORD.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.environ.get('DB_NAME', 'ch6973134ef1cfd_menu'),
        'USER': os.environ.get('DB_USER', 'ch6973134ef1cfd_yan'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '3306'),
        'CONN_MAX_AGE': 600,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'core.User'

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Douala'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Stockage : les médias uploadés passent par un stockage qui translittère les
# noms accentués en ASCII (évite les UnicodeEncodeError sur locale ASCII/POSIX).
STORAGES = {
    'default': {
        'BACKEND': 'core.storage.ASCIIFileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LOGIN_URL = '/admin-panel/login/'
LOGIN_REDIRECT_URL = '/admin-panel/'

# CORS : tout autorisé en dev ; en prod, liste blanche via CORS_ALLOWED_ORIGINS.
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [
        o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()
    ]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # Défaut FERMÉ. Sans cette ligne, DRF retombe sur AllowAny : une vue qui
    # oublie ses permissions devient publique en silence. Avec ce défaut, le
    # même oubli renvoie 401 — l'erreur se voit au lieu d'exposer des données.
    # Les vues réellement publiques déclarent explicitement AllowAny.
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/min',
        'user': '240/min',
        'auth': '10/min',   # login / register (anti brute-force)
    },
}

# En-têtes de sécurité (actifs uniquement en production).
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = _env_bool('SECURE_SSL_REDIRECT', True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    CSRF_TRUSTED_ORIGINS = [
        o.strip() for o in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()
    ]

# ─── Monetbil ─────────────────────────────────────────────────────────────────
# Les clés viennent UNIQUEMENT des variables d'environnement (jamais en dur dans
# le code : le SECRET ne doit pas se retrouver dans Git). Définissez-les en cPanel
# (prod) ou dans un fichier .env non versionné (dev).
MONETBIL_SERVICE_KEY    = os.environ.get('MONETBIL_SERVICE_KEY',    '')
MONETBIL_SERVICE_SECRET = os.environ.get('MONETBIL_SERVICE_SECRET', '')
# URL de base publique de l'application (utilisée pour notify_url)
APP_BASE_URL = os.environ.get('APP_BASE_URL', 'https://menu.cambus.cm')
# Vérifier la signature des notifications Monetbil (activer une fois validé en prod).
MONETBIL_VERIFY_SIGN = _env_bool('MONETBIL_VERIFY_SIGN', False)

# ─── Monetbil Décaissement (payout / cashout) ───────────────────────────────────
# Produit DISTINCT du widget d'encaissement : envoie de l'argent vers un bénéficiaire
# (retrait restaurant). Nécessite l'activation du décaissement côté Monetbil + sa doc.
# Tant que désactivé, les retraits sont traités manuellement (aucun versement auto).
MONETBIL_PAYOUT_ENABLED = os.environ.get('MONETBIL_PAYOUT_ENABLED', 'false').lower() in ('1', 'true', 'yes')
# URL de base de l'API de décaissement (à renseigner d'après la doc payout Monetbil).
MONETBIL_PAYOUT_URL = os.environ.get('MONETBIL_PAYOUT_URL', 'https://api.monetbil.com/payout/v1')

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ─── Redis : cache + couche WebSocket ────────────────────────
#
# Piloté par la variable d'environnement REDIS_URL.
#   • ABSENTE (dev)  → cache local par-process + WebSockets en mémoire. Simple,
#     zéro dépendance, MAIS ne fonctionne qu'avec UN seul worker.
#   • PRÉSENTE (prod) → Redis partagé. C'est ce qui rend le multi-worker viable :
#     sans lui, une notification envoyée par un worker n'atteint pas un client
#     connecté à un autre worker (cf. montée en charge).
#
# Redis rend ainsi trois services d'une seule brique : cache, channel layer, et
# (plus tard) broker de tâches asynchrones.
REDIS_URL = os.environ.get('REDIS_URL', '').strip()

if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                # Un Redis indisponible ne doit pas faire tomber le site :
                # on sert alors sans cache plutôt que de renvoyer une erreur.
                'IGNORE_EXCEPTIONS': True,
            },
        }
    }
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {'hosts': [REDIS_URL]},
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
    CHANNEL_LAYERS = {
        'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
    }

