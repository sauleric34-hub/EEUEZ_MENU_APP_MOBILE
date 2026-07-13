# ═══════════════════════════════════════════════════════════
#  Monetbil — Widget d'encaissement (v2.1)
#  Helper partagé : commandes ET réservations passent par ici.
#  Renvoie (payment_url, error) — l'un des deux est None.
# ═══════════════════════════════════════════════════════════

from django.conf import settings
import requests as http_requests


def initier_widget(*, amount, payment_ref, item_ref='', email='', first_name='',
                   last_name='', phone=''):
    """Appelle l'API Monetbil Widget et retourne l'URL de paiement.

    Retour : (payment_url:str|None, error:str|None)
    """
    service_key = settings.MONETBIL_SERVICE_KEY
    notify_url = f'{settings.APP_BASE_URL}/api/monetbil/notify/'

    payload = {
        'amount':      int(amount),
        'currency':    'XAF',
        'country':     'CM',
        'locale':      'fr',
        'payment_ref': payment_ref,
        'item_ref':    str(item_ref),
        'notify_url':  notify_url,
        'email':       email or '',
        'first_name':  first_name or '',
        'last_name':   last_name or '',
    }
    if phone:
        payload['phone'] = phone

    try:
        resp = http_requests.post(
            f'https://api.monetbil.com/widget/v2.1/{service_key}',
            data=payload, timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        return None, f'Impossible de contacter Monetbil : {exc}'

    if not data.get('success'):
        return None, data.get('message', 'Échec initialisation paiement Monetbil')
    return data['payment_url'], None
