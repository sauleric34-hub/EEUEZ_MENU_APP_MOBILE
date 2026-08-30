# ═══════════════════════════════════════════════════════════
#  Notifications push (Expo)
#
#  On POST directement sur l'API Expo (pas de SDK) : simple, sans
#  dépendance nouvelle. Les jetons invalides sont purgés au retour.
#  Toute erreur réseau est avalée — une notif ratée ne doit jamais
#  faire échouer une transaction métier.
# ═══════════════════════════════════════════════════════════

import logging

import requests as http_requests

from .models_livraison import AppareilPush

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
_LOT = 100


def _tokens_pour(cibles):
    """cibles : liste d'utilisateurs, d'ids ou de jetons Expo bruts."""
    users, tokens = [], []
    for c in cibles or []:
        if isinstance(c, str):
            tokens.append(c)
        elif isinstance(c, int):
            users.append(c)
        else:
            users.append(getattr(c, 'pk', None))
    users = [u for u in users if u]
    if users:
        tokens += list(
            AppareilPush.objects.filter(user_id__in=users)
            .values_list('expo_token', flat=True)
        )
    # Dédoublonne en gardant l'ordre.
    return list(dict.fromkeys(t for t in tokens if t))


def envoyer_push(cibles, titre, corps, data=None):
    """Envoie une notification à des utilisateurs (ou jetons). Best-effort."""
    tokens = _tokens_pour(cibles)
    if not tokens:
        return

    messages = [
        {'to': t, 'title': titre, 'body': corps, 'data': data or {}, 'sound': 'default'}
        for t in tokens
    ]
    for i in range(0, len(messages), _LOT):
        lot = messages[i:i + _LOT]
        try:
            rep = http_requests.post(EXPO_PUSH_URL, json=lot, timeout=10)
            _purger_jetons_morts(lot, rep)
        except http_requests.RequestException as exc:
            logger.warning('Push Expo échoué : %s', exc)


def _purger_jetons_morts(lot, reponse):
    try:
        resultats = reponse.json().get('data', [])
    except ValueError:
        return
    morts = []
    for msg, res in zip(lot, resultats):
        if isinstance(res, dict) and res.get('status') == 'error':
            details = res.get('details') or {}
            if details.get('error') in ('DeviceNotRegistered', 'InvalidCredentials'):
                morts.append(msg['to'])
    if morts:
        AppareilPush.objects.filter(expo_token__in=morts).delete()


def livreurs_independants_actifs():
    """Utilisateurs à notifier d'une nouvelle mission libre."""
    from .models import User
    return list(
        User.objects.filter(
            role='livreur', is_active=True, restaurant_attache__isnull=True,
        )
    )
