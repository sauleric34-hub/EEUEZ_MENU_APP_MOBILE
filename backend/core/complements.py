"""Validation et tarification des compléments choisis.

Règle non négociable : le montant des suppléments est calculé ICI, à partir de
la base. Un prix envoyé par l'application n'est jamais cru — sinon un client
modifié pourrait s'attribuer des suppléments gratuits.
"""

from decimal import Decimal

from .models_complements import GroupeComplement, OptionComplement


class ComplementInvalide(Exception):
    """Choix incohérent : option d'un autre plat, groupe obligatoire omis…"""


def resoudre_choix(plat, ids_options):
    """Valide les options choisies pour un plat et renvoie leur description.

    Renvoie une liste de dictionnaires prêts à devenir des ChoixLigneCommande,
    et le supplément total (Decimal) pour UNE unité du plat.

    Lève ComplementInvalide si :
      • une option n'appartient pas à ce plat (choix forgé) ;
      • un même groupe reçoit deux options (le choix est unique) ;
      • un groupe obligatoire n'a aucune option choisie.
    """
    ids = [int(i) for i in (ids_options or [])]

    groupes = GroupeComplement.objects.filter(plat=plat).prefetch_related('options')
    options_du_plat = {
        option.pk: option
        for groupe in groupes
        for option in groupe.options.all()
    }

    choisies = []
    groupes_vus = set()
    for identifiant in ids:
        option = options_du_plat.get(identifiant)
        if option is None:
            raise ComplementInvalide(
                "Un des compléments choisis n'existe pas pour ce plat."
            )
        if not option.disponible:
            raise ComplementInvalide(f'« {option.nom} » n\'est plus disponible.')
        if option.groupe_id in groupes_vus:
            raise ComplementInvalide(
                f'Un seul choix est possible pour « {option.groupe.nom} ».'
            )
        groupes_vus.add(option.groupe_id)
        choisies.append(option)

    for groupe in groupes:
        if groupe.obligatoire and groupe.pk not in groupes_vus:
            # Un groupe obligatoire sans option disponible ne peut pas être
            # satisfait : on ne bloque pas la commande pour autant.
            if any(o.disponible for o in groupe.options.all()):
                raise ComplementInvalide(f'Veuillez choisir : {groupe.nom}.')

    supplement_total = sum(
        (option.supplement for option in choisies), Decimal(0),
    )

    descriptions = [
        {
            'option': option,
            'groupe_nom': option.groupe.nom,
            'option_nom': option.nom,
            'supplement': option.supplement,
        }
        for option in choisies
    ]
    return descriptions, supplement_total


def enregistrer_choix(ligne, descriptions):
    """Recopie les choix sur la ligne de commande (libellés et prix figés)."""
    from .models_complements import ChoixLigneCommande

    ChoixLigneCommande.objects.bulk_create([
        ChoixLigneCommande(
            ligne=ligne,
            option=d['option'],
            groupe_nom=d['groupe_nom'],
            option_nom=d['option_nom'],
            supplement=d['supplement'],
        )
        for d in descriptions
    ])
