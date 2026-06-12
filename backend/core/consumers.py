import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class TrackingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.commande_id = self.scope['url_route']['kwargs']['commande_id']
        self.room_group_name = f'tracking_{self.commande_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    @database_sync_to_async
    def save_livreur_position(self, commande_id, lat, lon):
        from .models import Livraison
        try:
            livraison = Livraison.objects.get(commande_id=commande_id)
            livraison.latitude_actuelle = lat
            livraison.longitude_actuelle = lon
            livraison.save(update_fields=['latitude_actuelle', 'longitude_actuelle'])
        except Livraison.DoesNotExist:
            pass

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        
        lat = text_data_json.get('latitude')
        lon = text_data_json.get('longitude')
        
        if lat and lon:
            await self.save_livreur_position(self.commande_id, lat, lon)
        
        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'tracking_update',
                'data': text_data_json
            }
        )

    # Receive message from room group
    async def tracking_update(self, event):
        data = event['data']

        # Send message to WebSocket
        await self.send(text_data=json.dumps(data))
