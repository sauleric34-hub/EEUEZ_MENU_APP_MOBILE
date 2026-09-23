"""Prévient l'équipe admin par e-mail des livraisons bloquées depuis plus 1h.

Une livraison encore active (pas confirmée, pas en échec) une heure après sa
création signale un restaurant probablement injoignable ou en difficulté —
l'admin doit pouvoir l'appeler. Chaque livraison n'est alertée qu'une seule
fois (`alerte_retard_envoyee`), qu'un destinataire soit configuré ou non
(ADMIN_ALERT_EMAILS) — pas de ré-essai en boucle. Le flag sert aussi de
compteur cumulatif pour la page admin « Qualité restaurants ».

À planifier en cron, toutes les 10-15 minutes :

    python manage.py alerter_livraisons_en_retard
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Livraison
from core.emailing import alerter_livraison_en_retard

ACTIVES = ['en_attente', 'assignee', 'en_collecte', 'en_livraison']
DELAI_ALERTE_MINUTES = 60


class Command(BaseCommand):
    help = "Alerte l'équipe admin des livraisons non confirmées depuis plus d'1h."

    def handle(self, *args, **options):
        limite = timezone.now() - timezone.timedelta(minutes=DELAI_ALERTE_MINUTES)

        en_retard = Livraison.objects.filter(
            statut__in=ACTIVES, created_at__lt=limite, alerte_retard_envoyee=False,
        ).select_related('commande__restaurant', 'commande__client')

        total = 0
        for livraison in en_retard:
            alerter_livraison_en_retard(livraison)
            livraison.alerte_retard_envoyee = True
            livraison.save(update_fields=['alerte_retard_envoyee'])
            total += 1

        self.stdout.write(self.style.SUCCESS(
            f'{total} livraison(s) en retard signalée(s).'
        ))
