"""Filet de sécurité des paiements : interroge les agrégateurs pour les
paiements restés « en attente » (webhook perdu, retard réseau) et applique
le résultat définitif. À lancer toutes les 5 minutes (cron / planificateur) :

    python manage.py verifier_paiements

Sans effet sur un paiement déjà confirmé (le traitement est idempotent)."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from core.models import TentativePaiement
from core.paiements import alertes
from core.paiements.traitement import verifier_tentative

AGE_MINIMUM = timedelta(minutes=3)      # laisse au webhook le temps d'arriver
AGE_MAXIMUM = timedelta(hours=48)       # au-delà, l'opérateur a abandonné
INTERVALLE = timedelta(minutes=2)       # pas plus d'une vérification toutes les 2 min par paiement
SEUIL_ALERTE = timedelta(minutes=45)    # paiement bloqué : alerte admin
LOT_MAX = 200


class Command(BaseCommand):
    help = 'Revérifie auprès des agrégateurs les paiements restés en attente.'

    def handle(self, *args, **options):
        maintenant = timezone.now()
        a_verifier = (
            TentativePaiement.objects
            .filter(statut='en_attente', created_at__lte=maintenant - AGE_MINIMUM,
                    created_at__gte=maintenant - AGE_MAXIMUM)
            .exclude(provider_reference='')
            .filter(Q(derniere_verification__isnull=True) | Q(derniere_verification__lte=maintenant - INTERVALLE))
            .order_by('created_at')[:LOT_MAX]
        )
        bilan = {'verifies': 0, 'confirmes': 0, 'echoues': 0}
        for tentative in a_verifier:
            statut = verifier_tentative(tentative)
            bilan['verifies'] += 1
            if statut == 'complete':
                bilan['confirmes'] += 1
            elif statut in ('echouee', 'remboursee'):
                bilan['echoues'] += 1

        bloques = TentativePaiement.objects.filter(
            statut='en_attente', created_at__lte=maintenant - SEUIL_ALERTE,
            created_at__gte=maintenant - AGE_MAXIMUM,
        ).exclude(provider_reference='').count()
        if bloques:
            alertes.alerter(
                titre=f'{bloques} paiement(s) en attente depuis plus de 45 min',
                message="Ni webhook ni vérification n'ont donné de résultat définitif. Vérifiez le tableau de bord de l'agrégateur concerné.",
                niveau='avertissement', details={'paiements_bloques': bloques},
                cle_anti_rafale='paiements-bloques',
            )
        self.stdout.write(self.style.SUCCESS(
            f"{bilan['verifies']} vérifié(s) · {bilan['confirmes']} confirmé(s) · {bilan['echoues']} échoué(s) · {bloques} bloqué(s)"
        ))
