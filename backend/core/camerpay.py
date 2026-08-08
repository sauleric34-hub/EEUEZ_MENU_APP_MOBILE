# ═══════════════════════════════════════════════════════════
#  CamerPay — Encaissement Mobile Money / carte / PayPal
#  Flux « redirection » : le serveur crée une transaction et reçoit une
#  pay_url à afficher dans le WebView du client. CamerPay notifie ensuite
#  le résultat par webhook signé HMAC (voir _camerpay_notify dans
#  api_views.py) — c'est la source de vérité, pas la page de retour.
#
#  Doc officielle : https://camerpay.biz/docs/endpoints
#                    https://camerpay.biz/docs/webhooks
# ═══════════════════════════════════════════════════════════

import hashlib
import hmac

from django.conf import settings
import requests as http_requests

# CamerPay attend mtn_momo / orange_money ; nos modes internes utilisent
# mtn_money / orange_money (cf. Transaction.MODE_PAIEMENT_CHOICES).
PAYMENT_METHOD_PAR_MODE = {
    'mtn_money': 'mtn_momo',
    'orange_money': 'orange_money',
}

# Statuts CamerPay (pending/processing/completed/failed/cancelled/refunded) →
# statuts internes (Transaction.STATUT_CHOICES). pending/processing ne sont
# pas mappés : la transaction reste 'en_attente' sans action.
STATUT_PAR_CAMERPAY = {
    'completed': 'complete',
    'failed': 'echouee',
    'cancelled': 'echouee',
    'refunded': 'remboursee',
}


def _base_url():
    return settings.CAMERPAY_BASE_URL.rstrip('/')


def _headers():
    return {
        'Authorization': f'Bearer {settings.CAMERPAY_TOKEN}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }


def _format_phone(phone):
    """Normalise un numéro camerounais au format attendu par CamerPay : +237XXXXXXXXX."""
    digits = ''.join(c for c in str(phone) if c.isdigit())
    if digits.startswith('237'):
        return '+' + digits
    if len(digits) == 9:
        return '+237' + digits
    return '+' + digits if digits else ''


def _extract_error_message(resp):
    """Lit un message d'erreur exploitable dans une réponse CamerPay non-2xx.

    La doc distingue 3 familles de corps d'erreur (aucun champ n'est garanti
    présent sur toutes) : on lit donc chaque champ de façon défensive plutôt
    que de supposer une forme unique. Voir https://camerpay.biz/docs/errors
    """
    try:
        data = resp.json()
    except Exception:
        return f'Erreur CamerPay (HTTP {resp.status_code}).'
    # Famille C (règle métier : quota, KYC…) puis famille A/B (cadre, validation)
    message = data.get('message')
    if message:
        return message
    errors = data.get('errors')
    if isinstance(errors, dict) and errors:
        premier_champ = next(iter(errors.values()))
        if isinstance(premier_champ, list) and premier_champ:
            return str(premier_champ[0])
    return f'Erreur CamerPay (HTTP {resp.status_code}).'


def initier_paiement(*, amount, merchant_invoice_id, callback_url, return_url,
                      payment_method='', customer_phone='', customer_email='', customer_name=''):
    """Crée une transaction CamerPay et retourne l'URL de paiement à afficher.

    Retour : (transaction_uuid, pay_url, error) — les deux premiers sont None
    si `error` est renseigné.
    """
    if not settings.CAMERPAY_TOKEN:
        return None, None, "CamerPay non configuré (CAMERPAY_TOKEN manquant)."

    payload = {
        'amount': int(amount),
        'currency': 'XAF',
        'merchant_invoice_id': str(merchant_invoice_id),
        'merchant_callback_url': callback_url,
        'merchant_return_url': return_url,
        'source': 'api',
    }
    if payment_method:
        payload['payment_method'] = payment_method
    if customer_phone:
        payload['customer_phone'] = _format_phone(customer_phone)
    if customer_email:
        payload['customer_email'] = customer_email
    if customer_name:
        payload['customer_name'] = customer_name

    try:
        resp = http_requests.post(
            f'{_base_url()}/payment/initiate', json=payload, headers=_headers(), timeout=20,
        )
    except Exception as exc:
        return None, None, f'Impossible de contacter CamerPay : {exc}'

    if not resp.ok:
        return None, None, _extract_error_message(resp)

    data = resp.json()
    if not data.get('success'):
        return None, None, _extract_error_message(resp)
    return data.get('transaction_uuid'), data.get('pay_url'), None


def verifier_statut(transaction_uuid):
    """Interroge CamerPay pour le statut RÉEL d'une transaction. Sert de
    vérification complémentaire (ex. page de retour) ; le webhook reste la
    source de vérité pour confirmer un paiement.

    Retour : (status, error) — status brut CamerPay (pending/processing/
    completed/failed/cancelled/refunded) ou None si `error`.
    """
    if not settings.CAMERPAY_TOKEN:
        return None, "CamerPay non configuré (CAMERPAY_TOKEN manquant)."
    try:
        resp = http_requests.get(
            f'{_base_url()}/payment/{transaction_uuid}/status', headers=_headers(), timeout=15,
        )
    except Exception as exc:
        return None, f'Impossible de vérifier le statut CamerPay : {exc}'

    if not resp.ok:
        return None, _extract_error_message(resp)
    data = resp.json()
    return data.get('transaction', {}).get('status'), None


def verifier_signature_webhook(*, uuid, invoice_id, status, amount, signature):
    """Vérifie la signature HMAC-SHA256 d'un webhook CamerPay.

    La signature ne porte PAS sur le corps brut : elle porte sur la chaîne
    concaténée "uuid|invoice_id|status|amount" (amount à 2 décimales), signée
    avec le secret webhook (callback_secret du dashboard CamerPay).
    Voir https://camerpay.biz/docs/webhooks — piège documenté explicitement.
    """
    secret = settings.CAMERPAY_CALLBACK_SECRET
    if not secret or not signature:
        return False
    data = f'{uuid}|{invoice_id}|{status}|{amount}'
    expected = hmac.new(secret.encode('utf-8'), data.encode('utf-8'), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def initier_payout_batch(*, reference, beneficiaries):
    """Crée un batch de versements Mobile Money (décaissement).

    `beneficiaries` : liste de dicts {phone, amount, name, operator}.
    Retour : (data, error) — data est le JSON brut de la réponse si succès.

    ⚠️ Un appel réussi crée le batch mais ne garantit PAS un versement
    instantané : la doc CamerPay mentionne un « workflow d'approbation admin »
    côté plateforme. Ne jamais marquer un retrait « payé » sur la seule base
    d'un HTTP 2xx ici — voir payout.py::CamerPayPayoutProvider._map_response.
    """
    if not settings.CAMERPAY_TOKEN:
        return None, "CamerPay non configuré (CAMERPAY_TOKEN manquant)."

    payload = {
        'reference': str(reference),
        'beneficiaries': [
            {
                'phone': _format_phone(b['phone']),
                'amount': int(b['amount']),
                'name': b.get('name', ''),
                'operator': b['operator'],
            }
            for b in beneficiaries
        ],
    }
    try:
        resp = http_requests.post(
            f'{_base_url()}/payouts/batch', json=payload, headers=_headers(), timeout=20,
        )
    except Exception as exc:
        return None, f'Impossible de contacter CamerPay (payout) : {exc}'

    if not resp.ok:
        return None, _extract_error_message(resp)
    return resp.json(), None
