from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # Enregistre les signaux (maintien du cache de note). L'import tardif
        # évite les dépendances circulaires au chargement des modèles.
        from . import signals  # noqa: F401
        # Enregistre le schéma d'auth partenaire auprès de drf-spectacular
        # (voir partner_openapi.py) — doit être importé avant toute
        # génération de schéma OpenAPI.
        from . import partner_openapi  # noqa: F401
