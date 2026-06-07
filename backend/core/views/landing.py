from django.shortcuts import render
from django.db.models import Count, Avg
from core.models import RestaurantProfile, Plat, Categorie


def landing_view(request):
    restaurants = RestaurantProfile.objects.filter(
        is_verified=True, is_open=True, user__is_active=True
    ).annotate(
        note_avg=Avg('avis_set__note'),
        nb_commandes=Count('commandes'),
    ).order_by('-nb_commandes')[:6]

    categories = Categorie.objects.annotate(nb=Count('plat')).order_by('-nb')[:6]

    plats_vedette = Plat.objects.filter(
        is_available=True, is_visible=True, is_featured=True
    ).select_related('restaurant')[:8]

    if plats_vedette.count() < 4:
        plats_vedette = Plat.objects.filter(
            is_available=True, is_visible=True
        ).select_related('restaurant').order_by('-restaurant__commandes')[:8]

    stats = {
        'restaurants': RestaurantProfile.objects.filter(is_verified=True).count(),
        'plats': Plat.objects.filter(is_available=True).count(),
        'villes': RestaurantProfile.objects.values('ville').distinct().count(),
    }

    return render(request, 'landing.html', {
        'restaurants': restaurants,
        'categories': categories,
        'plats_vedette': plats_vedette,
        'stats': stats,
    })
