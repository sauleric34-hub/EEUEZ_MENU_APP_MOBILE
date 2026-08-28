"""Remet au pool les missions prises mais jamais démarrées.

Un livreur qui accepte une mission puis disparaît bloquerait la commande.
Passé le délai `ParametrageLivraison.delai_relance_minutes`, une livraison
encore au statut « assignee » est automatiquement rendue au pool (et comptée
comme un abandon pour le livreur).

À planifier en cron, toutes les 5 minutes :

    python manage.py relancer_livraisons
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Livraison
from core.models_livraison import ParametrageLivraison
from core.delivery import abandonner_livraison


class Command(BaseCommand):
    help = "Remet au pool les missions prises mais pas démarrées à temps."

    def handle(self, *args, **options):
        param = ParametrageLivraison.get_solo()
        limite = timezone.now() - timezone.timedelta(minutes=param.delai_relance_minutes)

        en_retard = Livraison.objects.filter(
            statut='assignee', created_at__lt=limite,
        ).select_related('commande', 'livreur')

        total = 0
        for livraison in en_retard:
            abandonner_livraison(
                livraison,
                f'Non démarrée sous {param.delai_relance_minutes} min',
                auto=True,
            )
            total += 1

        self.stdout.write(self.style.SUCCESS(
            f'{total} mission(s) remise(s) au pool.'
        ))
