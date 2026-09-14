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


class EstPartenaireActif(permissions.BasePermission):
    """Réservé aux requêtes authentifiées par PartnerAPIKeyAuthentication.

    `request.partenaire` n'est posé QUE si la clé + signature HMAC sont
    valides ET que le partenaire est approuvé (voir core/partner_auth.py) :
    ce contrôle est donc une deuxième ligne de défense déclarative, pas la
    vérification elle-même.
    """

    message = "Accès réservé aux partenaires API approuvés."

    def has_permission(self, request, view):
        return bool(getattr(request, 'partenaire', None) and request.partenaire.est_actif)


class AutoriseEcritureCommandes(permissions.BasePermission):
    """En plus d'EstPartenaireActif : le PLAN du partenaire doit inclure la
    création de commandes (le plan Découverte est catalogue seul)."""

    message = "Votre plan n'inclut pas la création de commandes — passez au plan Business."

    def has_permission(self, request, view):
        partenaire = getattr(request, 'partenaire', None)
        return bool(partenaire and partenaire.plan_config['ecriture_commandes'])
