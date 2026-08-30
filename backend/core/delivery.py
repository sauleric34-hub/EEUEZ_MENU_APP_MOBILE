# ═══════════════════════════════════════════════════════════
#  Finalisation d'une livraison
#  Terminer la livraison (après confirmation du client par QR/code)
#  crédite le livreur et débloque l'argent du restaurant :
#  la commande passe en « livree », donc son montant quitte
#  « l'argent gelé » et entre dans le solde disponible du resto.
# ═══════════════════════════════════════════════════════════

from django.db import transaction
from django.utils import timezone

from core.tracking_ws import broadcast_tracking


def est_livreur_independant(utilisateur):
    """Un livreur indépendant a le rôle « livreur » et n'est attaché à AUCUN
    restaurant. Ce sont eux qui prennent les commandes en livraison libre."""
    return bool(
        utilisateur
        and getattr(utilisateur, 'role', None) == 'livreur'
        and getattr(utilisateur, 'restaurant_attache_id', None) is None
    )


class PriseImpossible(Exception):
    """La commande libre n'a pas pu être prise (déjà prise, non libérée…)."""


def prendre_commande_libre(commande_id, livreur):
    """Attribue une commande en livraison libre à un livreur indépendant.

    Sûr face à la concurrence : deux livreurs qui tapent « Prendre » en même
    temps ne peuvent pas obtenir la même commande. On verrouille la ligne
    (select_for_update) puis on revérifie qu'aucune Livraison n'existe déjà.

    Lève PriseImpossible si la commande n'est pas (ou plus) disponible.
    Renvoie la Livraison créée.
    """
    from .models import Commande, Livraison

    if not est_livreur_independant(livreur):
        raise PriseImpossible("Réservé aux livreurs indépendants.")

    with transaction.atomic():
        commande = (
            Commande.objects.select_for_update()
            .filter(pk=commande_id, livraison_libre=True)
            .first()
        )
        if commande is None:
            raise PriseImpossible("Cette commande n'est pas en livraison libre.")
        if Livraison.objects.filter(commande=commande).exists():
            raise PriseImpossible("Cette commande vient d'être prise par un autre livreur.")

        livraison = Livraison.objects.create(
            commande=commande, livreur=livreur, statut='assignee',
        )
        # La commande sort du statut « en attente d'assignation ».
        commande.statut = 'en_preparation'
        commande.save(update_fields=['statut', 'updated_at'])

    # Hors transaction : le signal ne doit partir qu'une fois la prise
    # effectivement validée en base (évite de notifier une prise qui,
    # concurrentiellement, pourrait encore échouer avant le commit).
    broadcast_tracking(commande_id)
    return livraison


def finaliser_livraison(livraison):
    """Marque la livraison et la commande comme livrées, crédite le livreur.
    Idempotent : ne fait rien si la livraison est déjà terminée."""
    if livraison.statut == 'livree':
        return livraison

    commande = livraison.commande
    livraison.statut = 'livree'
    livraison.delivered_at = timezone.now()
    livraison.save(update_fields=['statut', 'delivered_at'])

    if commande and commande.statut != 'livree':
        commande.statut = 'livree'
        commande.save(update_fields=['statut', 'updated_at'])

    livreur = livraison.livreur
    if livreur and commande and commande.restaurant:
        # Gains livreur : 70 % des frais de livraison
        gain = float(commande.restaurant.frais_livraison) * 0.7
        livreur.gain_total = float(livreur.gain_total) + gain
        livreur.nombre_livraisons = (livreur.nombre_livraisons or 0) + 1
        livreur.save(update_fields=['gain_total', 'nombre_livraisons'])

    broadcast_tracking(commande.pk if commande else None)
    return livraison
