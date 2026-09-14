from django.urls import path
from core.views import auth, dashboard, restaurants, users, dishes, finances, deliveries, reviews, logs, map_view
from core.views import publications_admin, bannieres
from core.views import resto_ws, livreur_ws
from core.views import livreurs_admin
from core.views import partenaires_admin

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
    path('restaurants/<int:pk>/bareme-livraison/', restaurants.restaurant_bareme, name='restaurant_bareme'),

    # Users
    path('users/', users.user_list, name='user_list'),
    path('users/<int:pk>/', users.user_detail, name='user_detail'),
    path('users/<int:pk>/toggle/', users.user_toggle, name='user_toggle'),
    path('users/<int:pk>/delete/', users.user_delete, name='user_delete'),

    # Dishes
    path('dishes/', dishes.dish_list, name='dish_list'),
    path('dishes/<int:pk>/', dishes.dish_detail, name='dish_detail'),
    path('dishes/<int:pk>/toggle/', dishes.dish_toggle, name='dish_toggle'),

    # Bannières (accueil client)
    path('bannieres/', bannieres.banniere_list, name='banniere_list'),
    path('bannieres/nouvelle/', bannieres.banniere_form, name='banniere_create'),
    path('bannieres/<int:pk>/', bannieres.banniere_form, name='banniere_edit'),
    path('bannieres/<int:pk>/supprimer/', bannieres.banniere_delete, name='banniere_delete'),
    path('bannieres/<int:pk>/toggle/', bannieres.banniere_toggle, name='banniere_toggle'),
    path('bannieres/<int:pk>/monter/', bannieres.banniere_move, {'direction': 'up'}, name='banniere_up'),
    path('bannieres/<int:pk>/descendre/', bannieres.banniere_move, {'direction': 'down'}, name='banniere_down'),

    # Finances
    path('finances/', finances.finances_view, name='finances'),
    path('finances/transactions/', finances.transaction_list, name='transaction_list'),
    path('finances/retraits/', finances.retraits_view, name='admin_retraits'),
    path('finances/export/', finances.export_csv, name='finance_export'),

    # Deliveries
    path('deliveries/', deliveries.deliveries_view, name='deliveries'),
    path('deliveries/<int:pk>/action/', deliveries.delivery_action, name='delivery_action'),
    path('livreurs/', livreurs_admin.livreurs_view, name='admin_livreurs'),
    path('livreurs/<int:pk>/toggle/', livreurs_admin.livreur_toggle, name='admin_livreur_toggle'),
    path('livreurs/<int:pk>/verifier/', livreurs_admin.livreur_verifier, name='admin_livreur_verifier'),
    path('livreurs/paiements/', livreurs_admin.paiements_view, name='admin_livreur_paiements'),
    path('livreurs/paiements/<int:pk>/action/', livreurs_admin.paiement_action, name='admin_livreur_paiement_action'),
    path('livreurs/parametrage/', livreurs_admin.parametrage_view, name='admin_livreur_parametrage'),

    # Reviews
    path('reviews/', reviews.reviews_view, name='reviews'),
    path('reviews/<int:pk>/toggle/', reviews.review_toggle, name='review_toggle'),

    # Partenaires API (KYB)
    path('partenaires/', partenaires_admin.partenaires_list, name='partenaires_list'),
    path('partenaires/cles/', partenaires_admin.api_keys_list, name='partenaire_api_keys_list'),
    path('partenaires/<int:pk>/', partenaires_admin.partenaire_detail, name='partenaire_detail'),
    path('partenaires/<int:pk>/decider/', partenaires_admin.partenaire_decider, name='partenaire_decider'),
    path('partenaires/<int:pk>/plan/', partenaires_admin.partenaire_plan_changer, name='partenaire_plan_changer'),
    path('partenaires/<int:pk>/credential/', partenaires_admin.credential_emettre, name='partenaire_credential_emettre'),
    path('partenaires/<int:pk>/webhook/', partenaires_admin.webhook_configurer, name='partenaire_webhook_configurer'),
    path('partenaires/<int:pk>/mot-de-passe/', partenaires_admin.mot_de_passe_generer, name='partenaire_mot_de_passe_generer'),
    path('partenaires/documents/<int:pk>/decider/', partenaires_admin.document_decider, name='partenaire_document_decider'),
    path('partenaires/documents/<int:pk>/telecharger/', partenaires_admin.document_telecharger, name='partenaire_document_telecharger'),
    path('partenaires/credentials/<int:pk>/revoquer/', partenaires_admin.credential_revoquer, name='partenaire_credential_revoquer'),

    # Logs
    path('logs/', logs.logs_view, name='logs'),

    # ─── Modération des publications (admin) ───
    path('publications/', publications_admin.publications_view, name='admin_publications'),
    path('publications/<int:pk>/', publications_admin.publication_detail, name='admin_publication_detail'),
    path('fidelite/', publications_admin.fidelite_config, name='admin_fidelite'),
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
    path('resto/galerie/', resto_ws.galerie, name='resto_galerie'),
    path('resto/galerie/<int:pk>/supprimer/', resto_ws.galerie_delete, name='resto_galerie_delete'),
    path('resto/publications/', resto_ws.publications, name='resto_publications'),
    path('resto/publications/nouvelle/', resto_ws.publication_create, name='resto_publication_create'),
    path('resto/publications/<int:pk>/supprimer/', resto_ws.publication_delete, name='resto_publication_delete'),
    path('resto/publications/commentaires/<int:pk>/supprimer/', resto_ws.publication_commentaire_delete, name='resto_publication_commentaire_delete'),
    path('resto/reservations/', resto_ws.reservations, name='resto_reservations'),
    path('resto/profil/', resto_ws.profil, name='resto_profil'),

    # ─── Workspace Livreur ───
    path('livreur/', livreur_ws.dashboard, name='livreur_dashboard'),
    path('livreur/missions/<int:pk>/prendre/', livreur_ws.prendre_mission, name='livreur_prendre_mission'),
    path('livreur/carte/', livreur_ws.carte, name='livreur_carte'),
    path('livreur/livraisons/<int:pk>/action/', livreur_ws.livraison_action, name='livreur_livraison_action'),
    path('livreur/livraisons/<int:pk>/position/', livreur_ws.position_update, name='livreur_position_update'),
]
