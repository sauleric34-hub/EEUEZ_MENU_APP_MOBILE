from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.views.landing import landing_view
from core.api_views import monetbil_return

urlpatterns = [
    path('', landing_view, name='home'),
    path('django-admin/', admin.site.urls),
    path('admin-panel/', include('core.urls')),
    path('api/', include('core.api_urls')),
    # Page de retour Monetbil (return_url après paiement mobile money)
    path('payment/success/', monetbil_return, name='monetbil-return'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
