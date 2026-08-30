"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

from channels.routing import ProtocolTypeRouter, URLRouter
import core.routing
from core.ws_auth import JWTAuthMiddleware

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # JWT (query string) plutôt que AuthMiddlewareStack (cookies de session) :
    # l'app mobile s'authentifie partout via un Bearer JWT, pas de session Django.
    "websocket": JWTAuthMiddleware(
        URLRouter(
            core.routing.websocket_urlpatterns
        )
    ),
})
