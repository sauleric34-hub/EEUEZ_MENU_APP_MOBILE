# ═══════════════════════════════════════════════════════════
#  Attribution des points de fidélité
#
#  Règle d'or : chaque événement ne peut créditer QU'UNE SEULE FOIS.
#  C'est la contrainte d'unicité du grand livre qui le garantit, pas du
#  code applicatif — donc aucune course ni rejeu ne peut la contourner.
# ═══════════════════════════════════════════════════════════

import logging

from django.db import IntegrityError, transaction
from django.db.models import F, Q, Sum

from .models import MouvementPoints, ParametrageFidelite, User

logger = logging.getLogger(__name__)


def config():
    return ParametrageFidelite.get_solo()


def niveau(points):
    return config().niveau(points)


def crediter(client, montant, motif, source_type='', source_id=''):
    """Crédite (ou débite si négatif) le solde d'un client, une seule fois par
    événement. Retourne le mouvement créé, ou None si déjà compté / sans objet.

    Le couple (client, motif, source_type, source_id) est la clé d'idempotence.
    """
    if client is None or not montant:
        return None

    reglages = config()
    if not reglages.actif:
        return None

    try:
        with transaction.atomic():
            mouvement = MouvementPoints.objects.create(
                client=client, montant=int(montant), motif=motif,
                source_type=source_type, source_id=str(source_id),
            )
            # Le solde n'est qu'un cache : mis à jour dans la même transaction,
            # via F() pour rester correct en cas d'écritures concurrentes.
            User.objects.filter(pk=client.pk).update(
                points_solde=F('points_solde') + int(montant),
            )
            return mouvement
    except IntegrityError:
        # Événement déjà crédité (re-like, re-validation…) : c'est le
        # comportement attendu, on ne paie pas deux fois.
        return None


def solde_reel(client):
    """Recalcule le solde depuis le grand livre (source de vérité)."""
    total = MouvementPoints.objects.filter(client=client).aggregate(t=Sum('montant'))['t']
    return max(0, total or 0)


def resynchroniser(client):
    """Réaligne le cache sur le grand livre. Utile après un incident."""
    total = solde_reel(client)
    User.objects.filter(pk=client.pk).update(points_solde=total)
    return total


# ─── Événements métier ───────────────────────────────────────

def crediter_publication_validee(publication):
    """+N points à l'auteur quand le restaurant valide sa contribution.

    Ne s'applique pas aux publications du restaurant lui-même (auteur nul).
    Le drapeau `points_attribues` double le garde-fou du grand livre.
    """
    auteur = publication.auteur
    if auteur is None or publication.points_attribues:
        return None

    mouvement = crediter(
        auteur, config().points_publication_validee,
        motif='publication_validee', source_type='publication', source_id=publication.pk,
    )
    if not publication.points_attribues:
        publication.points_attribues = True
        publication.save(update_fields=['points_attribues'])
    return mouvement


def crediter_like_recu(publication, liker):
    """+N points à l'auteur de la publication quand quelqu'un l'aime.

    · rien pour une publication du restaurant (pas d'auteur) ;
    · rien si l'on aime sa propre publication ;
    · le retrait du like NE DÉBITE PAS — sinon un tiers pourrait vider le
      solde d'un utilisateur en aimant puis retirant en boucle.
    """
    auteur = publication.auteur
    if auteur is None or liker is None or auteur.pk == liker.pk:
        return None
    return crediter(
        auteur, config().points_par_like,
        motif='like_recu', source_type='like', source_id=f'{publication.pk}:{liker.pk}',
    )


def crediter_commentaire_recu(commentaire):
    """+N points à l'auteur de la publication pour chaque commentaire reçu."""
    publication = commentaire.publication
    auteur = publication.auteur
    if auteur is None or auteur.pk == commentaire.auteur_id:
        return None
    return crediter(
        auteur, config().points_par_commentaire,
        motif='commentaire_recu', source_type='commentaire', source_id=commentaire.pk,
    )


# ─── Conversion en réduction (paiement) ──────────────────────

def calculer_reduction(client, montant_total):
    """Réduction applicable à un panier, en (points_a_debiter, reduction_fcfa).

    Trois plafonds successifs :
      1. le solde du client ;
      2. le plafond en pourcentage de la commande (réglable) ;
      3. l'arrondi au palier de conversion — on ne débite jamais plus de
         points que ceux réellement convertis.
    """
    if client is None:
        return 0, 0

    reglages = config()
    if not reglages.actif or not reglages.points_par_unite or not reglages.valeur_unite:
        return 0, 0

    solde = int(getattr(client, 'points_solde', 0) or 0)
    if solde < reglages.seuil_minimum_conversion:
        return 0, 0

    # Valeur brute du solde, puis plafond en % du panier.
    reduction = reglages.points_vers_fcfa(solde)
    plafond = int(int(montant_total) * reglages.reduction_max_pourcentage / 100)
    reduction = min(reduction, plafond)
    if reduction <= 0:
        return 0, 0

    # On ne consomme que les paliers effectivement utilisés.
    unites = reduction // reglages.valeur_unite
    if unites <= 0:
        return 0, 0
    return unites * reglages.points_par_unite, unites * reglages.valeur_unite


def depenser_points(client, commande, points):
    """Débite les points au profit d'une commande. Idempotent par commande.

    Le solde étant un PositiveIntegerField, la base REFUSE elle-même de passer
    sous zéro : une dépense concurrente échoue au lieu de créer des points.
    """
    if not points:
        return None
    return crediter(
        client, -int(points), motif='depense_commande',
        source_type='commande', source_id=commande.pk,
    )


def rembourser_points(commande):
    """Rend les points quand une commande payée en points est annulée/refusée."""
    client = commande.client
    if client is None or not commande.points_utilises:
        return None
    return crediter(
        client, int(commande.points_utilises), motif='annulation',
        source_type='commande_annulee', source_id=commande.pk,
    )


def annuler_points_publication(publication):
    """Écriture compensatoire lors d'une suppression DÉFINITIVE par l'admin.

    Utilisée uniquement là : une suppression douce (client ou restaurant) ne
    retire jamais les points déjà acquis.
    """
    auteur = publication.auteur
    if auteur is None:
        return None

    # Les trois familles de crédit n'ont pas la même forme de clé :
    #  · publication  → l'id de la publication
    #  · like         → « <publication>:<liker> »  (le « : » évite de confondre 1 et 10)
    #  · commentaire  → l'id du COMMENTAIRE, pas celui de la publication
    ids_commentaires = [
        str(pk) for pk in publication.commentaires.values_list('pk', flat=True)
    ]
    filtre = (
        Q(source_type='publication', source_id=str(publication.pk))
        | Q(source_type='like', source_id__startswith=f'{publication.pk}:')
    )
    if ids_commentaires:
        filtre |= Q(source_type='commentaire', source_id__in=ids_commentaires)

    total = MouvementPoints.objects.filter(client=auteur).filter(filtre).aggregate(
        t=Sum('montant'),
    )['t'] or 0

    if total <= 0:
        return None
    return crediter(
        auteur, -total, motif='annulation',
        source_type='publication_annulee', source_id=publication.pk,
    )
