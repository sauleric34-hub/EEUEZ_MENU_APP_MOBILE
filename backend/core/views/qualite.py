# ═══════════════════════════════════════════════════════════
#  Qualité restaurants (admin) — livraisons en retard (>1h sans confirmation,
#  cf. management command alerter_livraisons_en_retard) et commandes annulées,
#  restaurant par restaurant. Sert à repérer les restaurants qui gèrent mal
#  leurs clients et à décider d'une suspension (bouton réutilisant l'action
#  existante restaurant_toggle).
# ═══════════════════════════════════════════════════════════

from django.db.models import Count, Q
from django.shortcuts import render

from core.models import RestaurantProfile
from .dashboard import admin_required

# Une série d'annulations consécutives à partir de ce seuil est mise en avant
# comme « à surveiller » sur la page et dans l'alerte du dashboard.
SEUIL_ANNULATIONS_CONSECUTIVES = 3
# On ne regarde que les commandes les plus récentes pour calculer la série en
# cours : pas besoin de charger tout l'historique d'un restaurant actif depuis
# des années pour savoir s'il enchaîne les annulations en ce moment.
FENETRE_SERIE = 20


def annulations_consecutives(restaurant):
    """Nombre de commandes annulées d'affilée en partant de la plus récente
    (s'arrête à la première commande non annulée)."""
    statuts = restaurant.commandes.order_by('-created_at').values_list(
        'statut', flat=True,
    )[:FENETRE_SERIE]
    n = 0
    for statut in statuts:
        if statut != 'annulee':
            break
        n += 1
    return n


def restaurants_a_surveiller():
    """Restaurants dont la série d'annulations en cours dépasse le seuil.
    Réutilisé par le dashboard pour l'alerte, et par la page qualité."""
    candidats = RestaurantProfile.objects.filter(
        commandes__statut='annulee',
    ).distinct()
    return [r for r in candidats if annulations_consecutives(r) >= SEUIL_ANNULATIONS_CONSECUTIVES]


@admin_required
def qualite_view(request):
    restaurants = RestaurantProfile.objects.annotate(
        livraisons_en_retard=Count(
            'commandes__livraison', filter=Q(commandes__livraison__alerte_retard_envoyee=True),
        ),
        commandes_annulees=Count('commandes', filter=Q(commandes__statut='annulee')),
        nb_commandes=Count('commandes'),
    ).filter(nb_commandes__gt=0)

    lignes = []
    for r in restaurants:
        lignes.append({
            'restaurant': r,
            'livraisons_en_retard': r.livraisons_en_retard,
            'commandes_annulees': r.commandes_annulees,
            'serie_annulations': annulations_consecutives(r),
        })
    lignes.sort(key=lambda l: (l['livraisons_en_retard'], l['serie_annulations']), reverse=True)

    stats = {
        'total_en_retard': sum(l['livraisons_en_retard'] for l in lignes),
        'total_annulees': sum(l['commandes_annulees'] for l in lignes),
        'a_surveiller': sum(1 for l in lignes if l['serie_annulations'] >= SEUIL_ANNULATIONS_CONSECUTIVES),
    }

    return render(request, 'admin_panel/qualite/index.html', {
        'lignes': lignes,
        'stats': stats,
        'seuil': SEUIL_ANNULATIONS_CONSECUTIVES,
        'active_page': 'qualite',
    })
