# ═══════════════════════════════════════════════════════════
#  Suppression de compte client (exigence Google Play)
#
#  On ANONYMISE la ligne User plutôt que de la supprimer : commandes,
#  transactions, réservations et grand livre de fidélité restent intacts
#  pour la comptabilité et les litiges (remboursements CamerPay), mais ne
#  pointent plus vers aucune donnée personnelle. Tout le contenu propre au
#  client (adresses, messages, publications, favoris…) est supprimé.
# ═══════════════════════════════════════════════════════════

import uuid

from django.db import transaction

# Statuts où la commande est terminée : plus rien à livrer, rien à rembourser
# en cours de route.
STATUTS_TERMINES = ('livree', 'recuperee', 'refusee', 'annulee')


# Doit rester aligné sur eeuez-expo-ui/constants/demo.ts (DEMO.email).
COMPTES_PROTEGES = {'client@menu.cm'}


class SuppressionImpossible(Exception):
    pass


def commandes_en_cours(user):
    """Commandes payées pas encore terminées : on ne peut pas effacer
    l'adresse et le téléphone qu'un livreur utilise peut-être en ce moment."""
    from .models import Commande
    return Commande.objects.filter(client=user, paiement_confirme=True).exclude(statut__in=STATUTS_TERMINES)


def supprimer_compte_client(user):
    from .models import AdresseLivraison, Conversation, Favori, Abonnement, Commande, Reservation
    from .models_livraison import AppareilPush
    from .models_publications import Publication, PublicationCommentaire, PublicationLike

    if user.role != 'client':
        raise SuppressionImpossible("Seuls les comptes clients se suppriment depuis l'application.")
    # Compte de démonstration : ses identifiants sont publics (écran de
    # connexion) — n'importe qui pourrait sinon le supprimer pour tous.
    if (user.email or user.username or '').strip().lower() in COMPTES_PROTEGES:
        raise SuppressionImpossible("Le compte de démonstration ne peut pas être supprimé.")
    if commandes_en_cours(user).exists():
        raise SuppressionImpossible(
            "Vous avez une commande en cours. Réessayez une fois qu'elle sera livrée."
        )

    with transaction.atomic():
        AdresseLivraison.objects.filter(client=user).delete()
        Conversation.objects.filter(client=user).delete()
        Favori.objects.filter(client=user).delete()
        Abonnement.objects.filter(client=user).delete()
        AppareilPush.objects.filter(user=user).delete()
        PublicationLike.objects.filter(client=user).delete()
        PublicationCommentaire.objects.filter(auteur=user).delete()
        Publication.objects.filter(auteur=user).delete()

        # Historique conservé, mais sans adresse ni note personnelle.
        Commande.objects.filter(client=user).update(
            adresse_livraison='', latitude_livraison=None, longitude_livraison=None, notes='',
        )
        Reservation.objects.filter(client=user).update(
            nom='Client supprimé', notes='',
        )

        if user.avatar:
            user.avatar.delete(save=False)
        user.username = f'supprime-{user.pk}-{uuid.uuid4().hex[:8]}'
        user.email = ''
        user.first_name = ''
        user.last_name = ''
        user.telephone = ''
        user.allergies = ''
        user.paiement_numero = ''
        user.paiement_operateur = ''
        user.avatar = None
        # Compte inactif : les jetons JWT existants sont refusés
        # (simplejwt rejette un utilisateur is_active=False).
        user.is_active = False
        user.set_unusable_password()
        user.save()
