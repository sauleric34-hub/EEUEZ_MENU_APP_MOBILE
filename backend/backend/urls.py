from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.views.static import serve as media_serve
from django.views.decorators.cache import cache_page
from django.views.generic import TemplateView
from core.views.landing import landing_view
from core.api_views import camerpay_return, camerpay_failed
from core.views.publication_views import publication_rebond
from core.views.partner_public import documentation as partenaire_documentation, partenaire_candidature

urlpatterns = [
    # Page d'accueil publique, identique pour tous : mise en cache 60 s.
    # Sous charge, 1000 visites/minute = 1 rendu + 999 lectures de cache, au
    # lieu de 1000 volées de requêtes SQL (classement bayésien, stats…).
    # Le cache local (dev) suffit à valider ; en prod il vit dans Redis.
    path('', cache_page(60)(landing_view), name='home'),
    path('django-admin/', admin.site.urls),
    path('admin-panel/', include('core.urls')),
    path('api/', include('core.api_urls')),
    # API Partenaires — surface publique séparée (voir core/partner_urls.py)
    path('api/partners/v1/', include('core.partner_urls')),
    # Formulaire web de candidature partenaire (grand public, sans clé API)
    path('partenaires/candidature/', partenaire_candidature, name='partenaire-candidature'),
    # Documentation développeur publique de l'API Partenaires
    path('partenaires/documentation/', partenaire_documentation, name='partenaire-documentation'),
    # Portail self-service partenaire (session, humain — voir core/partner_portal_auth.py)
    path('partenaires/portail/', include('core.partner_portal_urls')),
    # Pages légales publiques (URL à déclarer dans la Play Console)
    path('confidentialite/', TemplateView.as_view(template_name='legal/confidentialite.html'), name='confidentialite'),
    path('compte/suppression/', TemplateView.as_view(template_name='legal/suppression_compte.html'), name='suppression-compte'),
    # Pages de retour CamerPay après paiement mobile money
    path('payment/success/', camerpay_return, name='camerpay-return'),
    path('payment/failed/', camerpay_failed, name='camerpay-failed'),
    # Lien partagé d'une publication → rebond vers l'application
    path('publication/<int:id>/', publication_rebond, name='publication-rebond'),
    # Sert les fichiers média (logos, plats, avatars…) même en production (DEBUG=False),
    # car django.conf.urls.static.static() ne sert rien hors DEBUG et WhiteNoise ne couvre
    # que le static. Idéalement Apache/cPanel sert /media/, cette route garantit le fallback.
    re_path(r'^media/(?P<path>.*)$', media_serve, {'document_root': settings.MEDIA_ROOT}),
]
