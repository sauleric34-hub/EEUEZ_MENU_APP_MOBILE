# ═══════════════════════════════════════════════════════════
#  Authentification WebSocket via JWT (query string)
#  L'app mobile s'authentifie partout ailleurs avec un Bearer JWT, mais une
#  poignée de main WebSocket native ne permet pas d'y fixer un en-tête
#  Authorization — le jeton est donc passé en paramètre d'URL (?token=...),
#  seule option praticable côté client React Native.
# ═══════════════════════════════════════════════════════════

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _user_from_token(raw_token):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        validated = AccessToken(raw_token)
        return User.objects.get(pk=validated['user_id'])
    except (TokenError, InvalidToken, KeyError, User.DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        params = parse_qs((scope.get('query_string') or b'').decode())
        raw_token = (params.get('token') or [None])[0]
        scope['user'] = await _user_from_token(raw_token) if raw_token else AnonymousUser()
        return await super().__call__(scope, receive, send)
