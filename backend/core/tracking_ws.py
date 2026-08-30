# ═══════════════════════════════════════════════════════════
#  Signal de suivi en direct — pousse un simple « ça a changé » aux
#  clients connectés au canal WebSocket d'une commande (voir consumers.py).
#  Volontairement minimal : on ne duplique pas la sérialisation de la
#  commande ici, l'app mobile recharge via l'API REST habituelle dès
#  réception du signal. Best-effort : un channel layer indisponible
#  (Redis down, WebSocket jamais configuré côté hébergeur) ne doit jamais
#  faire échouer l'action métier qui l'appelle — le polling côté client
#  reste le filet de sécurité garanti.
# ═══════════════════════════════════════════════════════════

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast_tracking(commande_id):
    if not commande_id:
        return
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(
            f'tracking_{commande_id}',
            {'type': 'tracking_update', 'data': {'event': 'update'}},
        )
    except Exception:
        pass
