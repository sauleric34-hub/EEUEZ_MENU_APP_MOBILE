from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.views.static import serve as media_serve
from core.views.landing import landing_view
from core.api_views import monetbil_return, monetbil_failed

urlpatterns = [
    path('', landing_view, name='home'),
    path('django-admin/', admin.site.urls),
    path('admin-panel/', include('core.urls')),
    path('api/', include('core.api_urls')),
    # Pages de retour Monetbil après paiement mobile money
    path('payment/success/', monetbil_return, name='monetbil-return'),
    path('payment/failed/', monetbil_failed, name='monetbil-failed'),
    # Sert les fichiers média (logos, plats, avatars…) même en production (DEBUG=False),
    # car django.conf.urls.static.static() ne sert rien hors DEBUG et WhiteNoise ne couvre
    # que le static. Idéalement Apache/cPanel sert /media/, cette route garantit le fallback.
    re_path(r'^media/(?P<path>.*)$', media_serve, {'document_root': settings.MEDIA_ROOT}),
]
