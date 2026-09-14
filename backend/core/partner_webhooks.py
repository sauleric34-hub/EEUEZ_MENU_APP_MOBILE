# ═══════════════════════════════════════════════════════════
#  Webhooks sortants : notifie un partenaire du changement de statut d'UNE
#  de ses commandes. Signature HMAC-SHA256, même schéma que la vérification
#  du webhook CamerPay (core/camerpay.py verifier_signature_webhook) mais
#  côté émission : le partenaire vérifiera avec la même recette qu'EEUEZ
#  applique déjà pour CamerPay.
#
#  V1 : appel HTTP synchrone à timeout court, best-effort. Un échec est
#  journalisé (WebhookDelivery) pour reprise manuelle — pas de file de
#  tâches asynchrones dans ce repo pour l'instant.
# ═══════════════════════════════════════════════════════════

import hashlib
import hmac
import time

import requests as http_requests
from django.conf import settings

from .models_partenaire import WebhookDelivery


def _signer(secret, commande_id, reference_externe, statut, timestamp):
    message = f'{commande_id}|{reference_externe}|{statut}|{timestamp}'
    return hmac.new(secret.encode('utf-8'), message.encode('utf-8'), hashlib.sha256).hexdigest()


def envoyer_webhook_commande(commande):
    """Notifie le partenaire propriétaire de `commande` de son statut actuel.

    Ne fait rien si la commande n'est pas partenaire, ou si son partenaire
    n'a pas (ou plus) de webhook actif configuré. N'échoue jamais bruyamment :
    une commande dont le statut vient de changer doit rester enregistrée
    même si le partenaire est injoignable.
    """
    partenaire = commande.partenaire
    if not partenaire:
        return

    config = getattr(partenaire, 'webhook', None)
    if not config or not config.actif:
        return

    secret = config.obtenir_secret()
    if not secret:
        return

    timestamp = int(time.time())
    payload = {
        'commande_id': commande.id,
        'reference_externe': commande.reference_externe,
        'statut': commande.statut,
        'montant_total': int(commande.montant_total),
        'timestamp': timestamp,
    }
    signature = _signer(secret, commande.id, commande.reference_externe, commande.statut, timestamp)

    delivery = WebhookDelivery.objects.create(
        partenaire=partenaire, commande=commande, evenement='commande.statut_change', payload=payload,
    )

    try:
        resp = http_requests.post(
            config.url, json=payload, timeout=settings.PARTNER_WEBHOOK_TIMEOUT,
            headers={'X-EEUEZ-Signature': signature, 'Content-Type': 'application/json'},
        )
        delivery.tentative += 1
        delivery.dernier_code_http = resp.status_code
        delivery.statut_envoi = WebhookDelivery.STATUT_ENVOYE if resp.ok else WebhookDelivery.STATUT_ECHEC
        if not resp.ok:
            delivery.derniere_erreur = f'HTTP {resp.status_code}'
        delivery.save(update_fields=['tentative', 'dernier_code_http', 'statut_envoi', 'derniere_erreur', 'updated_at'])
    except Exception as exc:
        delivery.tentative += 1
        delivery.statut_envoi = WebhookDelivery.STATUT_ECHEC
        delivery.derniere_erreur = str(exc)[:300]
        delivery.save(update_fields=['tentative', 'statut_envoi', 'derniere_erreur', 'updated_at'])
