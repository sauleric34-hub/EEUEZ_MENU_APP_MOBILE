from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/topic/commande/(?P<commande_id>\w+)/tracking$', consumers.TrackingConsumer.as_asgi()),
]
