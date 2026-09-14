from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from . import partner_views

app_name = 'partners'

urlpatterns = [
    # Doc OpenAPI générée — urlconf=__name__ : n'introspecte QUE ce fichier,
    # jamais core.api_urls (app mobile, surface interne non destinée à des tiers).
    path('schema/', SpectacularAPIView.as_view(urlconf='core.partner_urls'), name='schema'),
    path('schema/swagger/', SpectacularSwaggerView.as_view(url_name='partners:schema'), name='swagger-ui'),
    path('schema/redoc/', SpectacularRedocView.as_view(url_name='partners:schema'), name='redoc'),

    # Candidature KYB — porte d'entrée, sans clé.
    path('apply', partner_views.deposer_candidature, name='apply'),

    # Catalogue (lecture, clé + signature requises)
    path('restaurants', partner_views.restaurants_list, name='restaurants'),
    path('restaurants/<int:id>', partner_views.restaurant_detail, name='restaurant-detail'),
    path('plats', partner_views.plats_list, name='plats'),
    path('plats/<int:id>', partner_views.plat_detail, name='plat-detail'),
    path('categories', partner_views.categories_list, name='categories'),

    # Commandes (écriture, clé + signature requises)
    path('commandes', partner_views.creer_commande, name='commandes'),
    path('commandes/<int:id>', partner_views.commande_detail, name='commande-detail'),
]
