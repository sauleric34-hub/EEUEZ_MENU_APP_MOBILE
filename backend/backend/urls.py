from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.views.landing import landing_view

urlpatterns = [
    path('', landing_view, name='home'),
    path('django-admin/', admin.site.urls),
    path('admin-panel/', include('core.urls')),
    path('api/', include('core.api_urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
