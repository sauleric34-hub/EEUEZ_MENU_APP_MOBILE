from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import api_views
from . import client_views
from . import reservation_views
from .views import publication_views

router = DefaultRouter()
# Viewsets routing
router.register(r'client/commandes', api_views.ClientCommandeViewSet, basename='client-commandes')
router.register(r'restaurant/menu/plats', api_views.RestaurantPlatViewSet, basename='restaurant-plats')
router.register(r'restaurant/commandes', api_views.RestaurantCommandeViewSet, basename='restaurant-commandes')
router.register(r'livreur/missions', api_views.LivreurMissionViewSet, basename='livreur-missions')

urlpatterns = [
    # Auth
    path('auth/login', api_views.LoginView.as_view(), name='api-login'),
    path('auth/register/<str:role>', api_views.RegisterView.as_view(), name='api-register'),
    path('auth/refresh', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('auth/ping', api_views.ping_view, name='api-ping'),

    # Client — profil
    path('client/profile', api_views.ClientProfileView.as_view(), name='api-client-profile'),
    path('client/restaurants/nearby', api_views.nearby_restaurants, name='api-client-nearby'),

    # Client — catalogue (app mobile)
    path('client/restaurants', client_views.restaurants_list, name='api-client-restaurants'),
    path('client/restaurants/<int:id>', client_views.restaurant_detail, name='api-client-restaurant-detail'),
    path('client/plats', client_views.plats_list, name='api-client-plats'),
    path('client/plats/<int:id>', client_views.plat_detail, name='api-client-plat-detail'),
    path('client/categories', client_views.categories_list, name='api-client-categories'),
    path('client/recommandations', client_views.recommandations, name='api-client-recommandations'),
    path('client/tendances', client_views.tendances, name='api-client-tendances'),
    path('client/plats/<int:id>/noter', client_views.noter_plat, name='api-client-noter-plat'),

    # Client — messagerie
    path('client/conversations', client_views.conversations, name='api-client-conversations'),
    path('client/conversations/<int:id>/messages', client_views.conversation_messages, name='api-client-conversation-messages'),

    # Client — adresses de livraison enregistrées
    path('client/adresses', client_views.adresses, name='api-client-adresses'),
    path('client/adresses/<int:id>', client_views.adresse_detail, name='api-client-adresse-detail'),

    # Client — favoris & abonnements
    path('client/favoris', client_views.favoris, name='api-client-favoris'),
    path('client/abonnements', client_views.abonnements, name='api-client-abonnements'),

    # Client — avis
    path('client/commandes/<int:commande_id>/avis', client_views.create_avis, name='api-client-avis'),

    # Client — galerie & réservations
    path('client/restaurants/<int:id>/galerie', reservation_views.galerie, name='api-client-galerie'),
    path('client/reservations', reservation_views.reservations, name='api-client-reservations'),
    path('client/reservations/<int:id>/payer', reservation_views.reservation_payer, name='api-client-reservation-payer'),
    path('client/reservations/<int:id>/ticket', reservation_views.reservation_ticket, name='api-client-reservation-ticket'),

    # ─── Publications (fil social) ─────────────────────────────────────────────
    path('client/publications/feed', publication_views.feed, name='api-client-pub-feed'),
    path('client/publications/likees', publication_views.publications_likees, name='api-client-pub-likees'),
    path('client/publications/mes-publications', publication_views.mes_publications, name='api-client-pub-miennes'),
    path('client/fidelite', publication_views.fidelite_apercu, name='api-client-fidelite'),
    path('client/restaurants/<int:id>/publications', publication_views.contribuer, name='api-client-pub-contribuer'),
    path('client/publications/<int:id>/supprimer', publication_views.publication_delete, name='api-client-pub-supprimer'),
    path('client/publications/<int:id>', publication_views.publication_detail, name='api-client-pub-detail'),
    path('client/publications/<int:id>/like', publication_views.toggle_like, name='api-client-pub-like'),
    path('client/publications/<int:id>/commentaires', publication_views.commentaires, name='api-client-pub-commentaires'),
    path('client/commentaires/<int:id>', publication_views.commentaire_delete, name='api-client-pub-commentaire-delete'),

    # ─── Monetbil — webhook serveur-à-serveur ──────────────────────────────────
    # Note : le routeur DRF enregistre automatiquement l'action initier_paiement
    # sous POST /api/client/commandes/{id}/initier_paiement/
    path('monetbil/notify/', api_views.monetbil_notify, name='api-monetbil-notify'),

    # Restaurant
    path('restaurant/workspace', api_views.RestaurantWorkspaceView.as_view(), name='api-restaurant-workspace'),

    # Map
    path('map/restaurants', api_views.map_restaurants, name='api-map-restaurants'),
    path('map/restaurants/search', api_views.map_restaurants_search, name='api-map-restaurants-search'),
    path('map/restaurants/<int:id>/details', api_views.map_restaurant_details, name='api-map-restaurant-details'),

    # Viewsets (client/commandes, restaurant/menu/plats, etc.)
    path('', include(router.urls)),
]
