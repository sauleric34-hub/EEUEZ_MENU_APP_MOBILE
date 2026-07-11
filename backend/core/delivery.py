# ═══════════════════════════════════════════════════════════
#  Finalisation d'une livraison
#  Terminer la livraison (après confirmation du client par QR/code)
#  crédite le livreur et débloque l'argent du restaurant :
#  la commande passe en « livree », donc son montant quitte
#  « l'argent gelé » et entre dans le solde disponible du resto.
# ═══════════════════════════════════════════════════════════

from django.utils import timezone


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

    return livraison
