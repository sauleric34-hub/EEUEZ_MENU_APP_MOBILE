import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer


class TrackingConsumer(AsyncWebsocketConsumer):
    """Canal de suivi en direct d'une commande, en LECTURE SEULE pour le
    client : le serveur y pousse un signal « ça a changé » (voir
    tracking_ws.broadcast_tracking) à chaque étape — commande acceptée,
    livreur assigné, livraison démarrée, position du livreur, livraison
    terminée — et l'app recharge la commande via l'API REST habituelle.

    Réservé au client propriétaire de la commande : le livreur pousse sa
    position via l'endpoint HTTP existant (déjà vérifié côté serveur),
    jamais via ce canal.
    """

    async def connect(self):
        self.commande_id = self.scope['url_route']['kwargs']['commande_id']
        user = self.scope.get('user')
        if user is None or not user.is_authenticated or not await self._est_proprietaire(user):
            await self.close(code=4403)
            return
        self.room_group_name = f'tracking_{self.commande_id}'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    @database_sync_to_async
    def _est_proprietaire(self, user):
        from .models import Commande
        return Commande.objects.filter(pk=self.commande_id, client=user).exists()

    async def receive(self, text_data):
        # Canal descendant uniquement — tout message entrant est ignoré.
        pass

    async def tracking_update(self, event):
        await self.send(text_data=json.dumps(event.get('data', {})))
