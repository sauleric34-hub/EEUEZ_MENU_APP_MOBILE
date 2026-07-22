from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.views.static import serve as media_serve
from django.views.decorators.cache import cache_page
from core.views.landing import landing_view
from core.api_views import monetbil_return, monetbil_failed
from core.views.publication_views import publication_rebond

urlpatterns = [
    # Page d'accueil publique, identique pour tous : mise en cache 60 s.
    # Sous charge, 1000 visites/minute = 1 rendu + 999 lectures de cache, au
    # lieu de 1000 volées de requêtes SQL (classement bayésien, stats…).
    # Le cache local (dev) suffit à valider ; en prod il vit dans Redis.
    path('', cache_page(60)(landing_view), name='home'),
    path('django-admin/', admin.site.urls),
    path('admin-panel/', include('core.urls')),
    path('api/', include('core.api_urls')),
    # Pages de retour Monetbil après paiement mobile money
    path('payment/success/', monetbil_return, name='monetbil-return'),
    path('payment/failed/', monetbil_failed, name='monetbil-failed'),
    # Lien partagé d'une publication → rebond vers l'application
    path('publication/<int:id>/', publication_rebond, name='publication-rebond'),
    # Sert les fichiers média (logos, plats, avatars…) même en production (DEBUG=False),
    # car django.conf.urls.static.static() ne sert rien hors DEBUG et WhiteNoise ne couvre
    # que le static. Idéalement Apache/cPanel sert /media/, cette route garantit le fallback.
    re_path(r'^media/(?P<path>.*)$', media_serve, {'document_root': settings.MEDIA_ROOT}),
]
