"""Fabrique les aperçus des images déjà en base.

La génération est automatique à l'envoi, mais tout ce qui a été publié avant
cette optimisation continuerait d'être servi en pleine résolution. Cette
commande rattrape l'existant.

    python manage.py generer_apercus
    python manage.py generer_apercus --modele plat
    python manage.py generer_apercus --refaire   # régénère même si un aperçu existe
"""

from django.core.management.base import BaseCommand

from core.models import Plat, PlatImage
from core.models_publications import PublicationMedia

MODELES = {
    'plat': Plat,
    'platimage': PlatImage,
    'publicationmedia': PublicationMedia,
}


class Command(BaseCommand):
    help = "Génère les aperçus et placeholders des images déjà enregistrées."

    def add_arguments(self, parseur):
        parseur.add_argument(
            '--modele', choices=sorted(MODELES),
            help='Ne traiter qu\'un seul modèle (par défaut : tous).',
        )
        parseur.add_argument(
            '--refaire', action='store_true',
            help='Régénère même les aperçus déjà présents.',
        )

    def handle(self, *args, **options):
        choisis = [options['modele']] if options['modele'] else sorted(MODELES)

        for nom in choisis:
            modele = MODELES[nom]
            lot = modele.objects.all()
            if not options['refaire']:
                lot = lot.filter(apercu__in=['', None])

            traites = ignores = 0
            for objet in lot.iterator():
                if options['refaire']:
                    objet.apercu = None
                # save() du mixin fabrique l'aperçu quand il manque.
                objet.save()
                objet.refresh_from_db()
                if objet.apercu:
                    traites += 1
                else:
                    # Vidéo, fichier manquant ou format illisible : normal.
                    ignores += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f'{nom} : {traites} aperçu(s) généré(s), {ignores} ignoré(s)'
                )
            )
