# Réglages de test : base SQLite en mémoire (indépendant de MySQL/XAMPP).
# Usage : python manage.py test core.tests --settings=backend.test_settings
from .settings import *  # noqa

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}
