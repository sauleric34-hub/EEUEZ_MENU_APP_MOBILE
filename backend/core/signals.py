"""Signaux : maintien du cache de note des restaurants.

note_cache est dénormalisé pour être lisible sans requête (cf.
RestaurantProfile.note_moyenne). Il doit donc être rafraîchi dès qu'une note
de plat change. C'est le SEUL point d'écriture automatique — la pondération
par les commandes, elle, dérive lentement et se rattrape via la commande
`recalculer_notes` (lancée périodiquement).
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import PlatNote


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
