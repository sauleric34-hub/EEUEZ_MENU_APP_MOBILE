"""Recalcule la note_cache de tous les restaurants.

À lancer :
  • une fois après le déploiement (remplir l'existant) ;
  • périodiquement (cron / tâche planifiée), car la pondération par le nombre
    de commandes dérive à chaque nouvelle commande, alors que le signal ne se
    déclenche que sur les notes.

    python manage.py recalculer_notes
"""

from django.core.management.base import BaseCommand

from core.models import RestaurantProfile


class Command(BaseCommand):
    help = "Recalcule la note moyenne dénormalisée de tous les restaurants."

    def handle(self, *args, **options):
        total = 0
        for restaurant in RestaurantProfile.objects.iterator():
            restaurant.recalculer_note()
            total += 1
        self.stdout.write(self.style.SUCCESS(
            f'{total} restaurant(s) recalculé(s).'
        ))
