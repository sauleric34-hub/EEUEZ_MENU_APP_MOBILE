# ═══════════════════════════════════════════════════════════
#  Moteur de recommandation personnalisée
#
#  Principe produit : présenter d'abord les plats avec les
#  meilleurs retours LES PLUS PROCHES de l'utilisateur, afin de
#  réduire le coût du transport.
#
#  Score plat = Σ (poids × composante normalisée 0..1)
#    · proximité   45 %  — décroissance exponentielle avec la distance
#    · commandes   20 %  — volume de commandes (échelle log)
#    · likes       15 %  — favoris clients (échelle log)
#    · fraîcheur   10 %  — plats récemment publiés mis en avant
#    · followers   10 %  — notoriété du restaurant (échelle log)
#
#  Score restaurant = proximité 50 % · note 20 % · followers 15 % · volume 15 %
# ═══════════════════════════════════════════════════════════

import math
from django.db.models import Sum, Count
from django.utils import timezone

from .models import Plat, RestaurantProfile, LigneCommande, Favori, Abonnement, Commande
from .utils import geo

# Poids des composantes (plats)
W_DISTANCE = 0.45
W_ORDERS = 0.20
W_LIKES = 0.15
W_RECENCY = 0.10
W_FOLLOWERS = 0.10

# Poids des composantes (restaurants)
WR_DISTANCE = 0.50
WR_RATING = 0.20
WR_FOLLOWERS = 0.15
WR_VOLUME = 0.15

# À 3 km le score de proximité vaut ~0.5 ; quasi nul au-delà de ~12 km.
DISTANCE_HALF_KM = 3.0
# Un plat perd la moitié de son bonus fraîcheur au bout de 14 jours.
RECENCY_HALF_DAYS = 14.0


def _distance_score(dist_km):
    """1.0 tout près → tend vers 0 au loin. None (position inconnue) = neutre 0.5."""
    if dist_km is None:
        return 0.5
    return math.exp(-math.log(2) * dist_km / DISTANCE_HALF_KM)


def _log_norm(value, max_value):
    """Normalise sur échelle log pour amortir les gros volumes (0..1)."""
    if not max_value:
        return 0.0
    return math.log1p(max(0, value)) / math.log1p(max_value)


def _recency_score(created_at):
    age_days = max(0.0, (timezone.now() - created_at).total_seconds() / 86400.0)
    return math.exp(-math.log(2) * age_days / RECENCY_HALF_DAYS)


def _safe_distance(lat, lon, r):
    """Distance client→restaurant, ou None si une coordonnée manque."""
    if lat is None or lon is None or r.latitude is None or r.longitude is None:
        return None
    return geo.calculer_distance(lat, lon, r.latitude, r.longitude)


def _stats():
    """Pré-agrège commandes/likes/followers en 3 requêtes (pas de N+1)."""
    orders = {
        row['plat']: row['total'] or 0
        for row in LigneCommande.objects.values('plat').annotate(total=Sum('quantite'))
    }
    likes = {
        row['plat']: row['c']
        for row in Favori.objects.values('plat').annotate(c=Count('id'))
    }
    followers = {
        row['restaurant']: row['c']
        for row in Abonnement.objects.values('restaurant').annotate(c=Count('id'))
    }
    return orders, likes, followers


def recommander_plats(lat=None, lon=None, limit=20):
    """Retourne [(plat, score, dist_km, détail)] triés du meilleur au moins bon."""
    plats = list(
        Plat.objects.filter(
            is_available=True, is_visible=True,
            restaurant__is_open=True, restaurant__is_verified=True,
        ).select_related('restaurant', 'categorie')
    )
    if not plats:
        return []

    orders, likes, followers = _stats()
    max_orders = max((orders.get(p.id, 0) for p in plats), default=0)
    max_likes = max((likes.get(p.id, 0) for p in plats), default=0)
    max_followers = max(followers.values(), default=0)

    scored = []
    for p in plats:
        dist = _safe_distance(lat, lon, p.restaurant)
        detail = {
            'proximite': _distance_score(dist),
            'commandes': _log_norm(orders.get(p.id, 0), max_orders),
            'likes': _log_norm(likes.get(p.id, 0), max_likes),
            'fraicheur': _recency_score(p.created_at),
            'followers': _log_norm(followers.get(p.restaurant_id, 0), max_followers),
        }
        score = (
            W_DISTANCE * detail['proximite']
            + W_ORDERS * detail['commandes']
            + W_LIKES * detail['likes']
            + W_RECENCY * detail['fraicheur']
            + W_FOLLOWERS * detail['followers']
        )
        scored.append((p, round(score, 4), dist, detail))

    scored.sort(key=lambda t: t[1], reverse=True)
    return scored[:limit]


def recommander_restaurants(lat=None, lon=None, limit=10):
    """Retourne [(resto, score, dist_km)] triés du meilleur au moins bon."""
    restos = list(RestaurantProfile.objects.filter(is_open=True, is_verified=True))
    if not restos:
        return []

    _, _, followers = _stats()
    volume = {
        row['restaurant']: row['c']
        for row in Commande.objects.values('restaurant').annotate(c=Count('id'))
    }
    max_followers = max(followers.values(), default=0)
    max_volume = max(volume.values(), default=0)

    scored = []
    for r in restos:
        dist = _safe_distance(lat, lon, r)
        score = (
            WR_DISTANCE * _distance_score(dist)
            + WR_RATING * (float(r.note_moyenne) / 5.0)
            + WR_FOLLOWERS * _log_norm(followers.get(r.id, 0), max_followers)
            + WR_VOLUME * _log_norm(volume.get(r.id, 0), max_volume)
        )
        scored.append((r, round(score, 4), dist))

    scored.sort(key=lambda t: t[1], reverse=True)
    return scored[:limit]
