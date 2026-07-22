from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # Enregistre les signaux (maintien du cache de note). L'import tardif
        # évite les dépendances circulaires au chargement des modèles.
        from . import signals  # noqa: F401
