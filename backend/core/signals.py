"""Signaux : maintien du cache de note des restaurants.

note_cache est dénormalisé pour être lisible sans requête (cf.
RestaurantProfile.note_moyenne). Il doit donc être rafraîchi dès qu'une note
de plat change. C'est le SEUL point d'écriture automatique — la pondération
par les commandes, elle, dérive lentement et se rattrape via la commande
`recalculer_notes` (lancée périodiquement).
"""

from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver

from .models import PlatNote, Commande


def _rafraichir_restaurant_de_la_note(note):
    """Recalcule la note du restaurant auquel appartient le plat noté."""
    plat = getattr(note, 'plat', None)
    restaurant = getattr(plat, 'restaurant', None)
    if restaurant is not None:
        restaurant.recalculer_note()


@receiver(post_save, sender=PlatNote)
def note_creee_ou_modifiee(sender, instance, **kwargs):
    _rafraichir_restaurant_de_la_note(instance)


@receiver(post_delete, sender=PlatNote)
def note_supprimee(sender, instance, **kwargs):
    _rafraichir_restaurant_de_la_note(instance)


# ─── Webhook sortant : notifie un partenaire d'un changement de statut ────────
# Point d'accroche UNIQUE plutôt que d'appeler envoyer_webhook_commande depuis
# chaque vue qui change un statut de commande (acceptation restaurant,
# livraison, retrait…) : ces vues n'ont pas à savoir qu'un partenaire existe.
@receiver(pre_save, sender=Commande)
def _commande_statut_avant(sender, instance, **kwargs):
    # Requête supplémentaire UNIQUEMENT pour les commandes déjà rattachées à
    # un partenaire (immense majorité des commandes ne le sont pas et ne
    # paient donc rien ici).
    if instance.partenaire_id and instance.pk:
        instance._statut_avant = (
            Commande.objects.filter(pk=instance.pk).values_list('statut', flat=True).first()
        )
    else:
        instance._statut_avant = instance.statut


@receiver(post_save, sender=Commande)
def commande_statut_change_notifie_partenaire(sender, instance, created, **kwargs):
    if not instance.partenaire_id:
        return
    if not created and getattr(instance, '_statut_avant', instance.statut) == instance.statut:
        return
    from .tasks import notifier_partenaire_async
    notifier_partenaire_async(instance.id)
