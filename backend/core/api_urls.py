from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import api_views

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
    path('auth/ping', api_views.ping_view, name='api-ping'),
    
    # Client
    path('client/profile', api_views.ClientProfileView.as_view(), name='api-client-profile'),
    path('client/restaurants/nearby', api_views.nearby_restaurants, name='api-client-nearby'),
    
    # Restaurant
    path('restaurant/workspace', api_views.RestaurantWorkspaceView.as_view(), name='api-restaurant-workspace'),
    
    # Map
    path('map/restaurants', api_views.map_restaurants, name='api-map-restaurants'),
    path('map/restaurants/search', api_views.map_restaurants_search, name='api-map-restaurants-search'),
    path('map/restaurants/<int:id>/details', api_views.map_restaurant_details, name='api-map-restaurant-details'),
    
    # Viewsets (includes client/commandes, restaurant/menu/plats, etc.)
    path('', include(router.urls)),
]
