from django.conf import settings
from django.shortcuts import render
from django.http import JsonResponse
from core.models import RestaurantProfile
from .dashboard import admin_required


@admin_required
def map_view(request):
    total = RestaurantProfile.objects.count()
    with_coords = RestaurantProfile.objects.filter(latitude__isnull=False, longitude__isnull=False).count()
    return render(request, 'admin_panel/map/index.html', {
        'total': total,
        'with_coords': with_coords,
        'active_page': 'map',
        'carto_api_key': settings.CARTO_API_KEY,
    })


@admin_required
def restaurants_geojson(request):
    features = []
    qs = RestaurantProfile.objects.select_related('user').filter(
        latitude__isnull=False, longitude__isnull=False
    )
    for r in qs:
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [float(r.longitude), float(r.latitude)]},
            'properties': {
                'id': r.pk,
                'nom': r.nom,
                'ville': r.ville,
                'adresse': r.adresse,
                'note': float(r.note_moyenne),
                'ca': float(r.chiffre_affaires),
                'nb_commandes': r.total_commandes,
                'commission_rate': float(r.commission_rate),
                'is_verified': r.is_verified,
                'is_open': r.is_open,
                'is_active': r.user.is_active,
                'color': '#10B981' if (r.is_verified and r.user.is_active) else ('#F59E0B' if not r.is_verified else '#EF4444'),
                'url': f'/admin-panel/restaurants/{r.pk}/',
            }
        })

    return JsonResponse({'type': 'FeatureCollection', 'features': features})
