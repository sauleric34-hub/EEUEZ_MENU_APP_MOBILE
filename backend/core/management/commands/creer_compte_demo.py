"""Crée (ou réinitialise) le compte de démonstration de l'application mobile.

Le bouton « Visiter en invité » se connecte avec ce compte. S'il n'existe pas
en base, le bouton échoue silencieusement — c'était le cas jusqu'ici.

    python manage.py creer_compte_demo

La commande est idempotente : relancée, elle remet simplement le mot de passe
et réactive le compte.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()

EMAIL_DEMO = 'client@menu.cm'
MOT_DE_PASSE_DEMO = 'client123'


class Command(BaseCommand):
    help = "Crée ou réinitialise le compte de démonstration (client@menu.cm)."

    def handle(self, *args, **options):
        utilisateur, cree = User.objects.get_or_create(
            username=EMAIL_DEMO,
            defaults={
                'email': EMAIL_DEMO,
                'first_name': 'Visiteur',
                'last_name': 'Démo',
                'role': 'client',
            },
        )

        # Toujours réappliquer : le compte est public, son mot de passe doit
        # rester celui qu'attend l'application.
        utilisateur.email = EMAIL_DEMO
        utilisateur.role = 'client'
        utilisateur.is_active = True
        utilisateur.set_password(MOT_DE_PASSE_DEMO)
        utilisateur.save()

        verbe = 'créé' if cree else 'réinitialisé'
        self.stdout.write(self.style.SUCCESS(
            f'Compte de démonstration {verbe} : {EMAIL_DEMO}'
        ))
