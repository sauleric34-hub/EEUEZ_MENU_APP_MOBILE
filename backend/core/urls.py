from django.urls import path
from core.views import auth, dashboard, restaurants, users, dishes, finances, deliveries, reviews, logs, map_view
from core.views import resto_ws, livreur_ws

app_name = 'core'

urlpatterns = [
    # Auth
    path('login/', auth.login_view, name='login'),
    path('logout/', auth.logout_view, name='logout'),

    # Dashboard
    path('', dashboard.dashboard_view, name='dashboard'),

    # Restaurants
    path('restaurants/', restaurants.restaurant_list, name='restaurant_list'),
    path('restaurants/create/', restaurants.restaurant_create, name='restaurant_create'),
    path('restaurants/<int:pk>/', restaurants.restaurant_detail, name='restaurant_detail'),
    path('restaurants/<int:pk>/edit/', restaurants.restaurant_edit, name='restaurant_edit'),
    path('restaurants/<int:pk>/toggle/', restaurants.restaurant_toggle, name='restaurant_toggle'),
    path('restaurants/<int:pk>/verify/', restaurants.restaurant_verify, name='restaurant_verify'),
    path('restaurants/<int:pk>/commission/', restaurants.restaurant_commission, name='restaurant_commission'),

    # Users
    path('users/', users.user_list, name='user_list'),
    path('users/<int:pk>/', users.user_detail, name='user_detail'),
    path('users/<int:pk>/toggle/', users.user_toggle, name='user_toggle'),
    path('users/<int:pk>/delete/', users.user_delete, name='user_delete'),

    # Dishes
    path('dishes/', dishes.dish_list, name='dish_list'),
    path('dishes/<int:pk>/', dishes.dish_detail, name='dish_detail'),
    path('dishes/<int:pk>/toggle/', dishes.dish_toggle, name='dish_toggle'),

    # Finances
    path('finances/', finances.finances_view, name='finances'),
    path('finances/transactions/', finances.transaction_list, name='transaction_list'),
    path('finances/export/', finances.export_csv, name='finance_export'),

    # Deliveries
    path('deliveries/', deliveries.deliveries_view, name='deliveries'),

    # Reviews
    path('reviews/', reviews.reviews_view, name='reviews'),
    path('reviews/<int:pk>/toggle/', reviews.review_toggle, name='review_toggle'),

    # Logs
    path('logs/', logs.logs_view, name='logs'),
    path('logs/export/', logs.export_csv, name='logs_export'),

    # Map
    path('map/', map_view.map_view, name='map'),
    path('api/restaurants/geojson/', map_view.restaurants_geojson, name='restaurants_geojson'),

    # ─── Workspace Restaurant ───
    path('resto/', resto_ws.dashboard, name='resto_dashboard'),
    path('resto/commandes/', resto_ws.commandes, name='resto_commandes'),
    path('resto/commandes/<int:pk>/action/', resto_ws.commande_action, name='resto_commande_action'),
    path('resto/plats/', resto_ws.plats, name='resto_plats'),
    path('resto/plats/nouveau/', resto_ws.plat_form, name='resto_plat_create'),
    path('resto/plats/<int:pk>/', resto_ws.plat_form, name='resto_plat_edit'),
    path('resto/plats/<int:pk>/toggle/', resto_ws.plat_toggle, name='resto_plat_toggle'),
    path('resto/plats/<int:pk>/du-jour/', resto_ws.plat_du_jour, name='resto_plat_du_jour'),
    path('resto/plats/<int:pk>/supprimer/', resto_ws.plat_delete, name='resto_plat_delete'),
    path('resto/messages/', resto_ws.conversations, name='resto_messages'),
    path('resto/messages/<int:pk>/', resto_ws.conversation_detail, name='resto_conversation'),
    path('resto/livreurs/', resto_ws.livreurs, name='resto_livreurs'),
    path('resto/communaute/', resto_ws.communaute, name='resto_communaute'),
    path('resto/finances/', resto_ws.finances, name='resto_finances'),
    path('resto/profil/', resto_ws.profil, name='resto_profil'),

    # ─── Workspace Livreur ───
    path('livreur/', livreur_ws.dashboard, name='livreur_dashboard'),
    path('livreur/carte/', livreur_ws.carte, name='livreur_carte'),
    path('livreur/livraisons/<int:pk>/action/', livreur_ws.livraison_action, name='livreur_livraison_action'),
]
