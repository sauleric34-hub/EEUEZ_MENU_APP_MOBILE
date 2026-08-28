"""Permissions DRF fondées sur le rôle.

Rappel important : le projet ne définit PAS de DEFAULT_PERMISSION_CLASSES.
DRF retombe donc sur AllowAny, et toute vue qui oublie ses permissions est
publique. Chaque vue doit déclarer les siennes explicitement.
"""

from rest_framework import permissions


class EstLivreur(permissions.BasePermission):
    """Réservé aux comptes livreurs.

    « Être authentifié » ne suffit pas : sans ce contrôle, un compte client
    ordinaire peut s'attribuer des missions de livraison et déclencher les
    versements qui vont avec.
    """

    message = 'Action réservée aux livreurs.'

    def has_permission(self, request, view):
        utilisateur = request.user
        return bool(
            utilisateur
            and utilisateur.is_authenticated
            and utilisateur.is_active
            and getattr(utilisateur, 'role', None) == 'livreur'
        )


class EstRestaurant(permissions.BasePermission):
    """Réservé aux comptes restaurant."""

    message = 'Action réservée aux restaurants.'

    def has_permission(self, request, view):
        utilisateur = request.user
        return bool(
            utilisateur
            and utilisateur.is_authenticated
            and utilisateur.is_active
            and getattr(utilisateur, 'role', None) == 'restaurant'
        )
