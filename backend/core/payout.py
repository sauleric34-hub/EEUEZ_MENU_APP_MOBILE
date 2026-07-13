# ═══════════════════════════════════════════════════════════
#  Décaissement (payout / cashout) — versement vers un bénéficiaire
#  Utilisé pour les RETRAITS de fonds des restaurants.
#
#  ⚠️ IMPORTANT : le décaissement Monetbil (ENVOYER de l'argent) est un
#  produit DISTINCT du widget d'encaissement (le client qui paie). Il doit
#  être activé côté Monetbil et sa doc obtenue.
#
#  Cette couche est PRÊTE À BRANCHER :
#   • Tant que settings.MONETBIL_PAYOUT_ENABLED est False → ManualPayoutProvider
#     (la demande est approuvée mais le versement se fait à la main, rien n'est envoyé).
#   • Dès que vous avez la doc payout Monetbil → implémentez l'appel HTTP réel
#     dans MonetbilPayoutProvider._call_api (un seul endroit marqué « TODO »),
#     puis mettez MONETBIL_PAYOUT_ENABLED=true. Rien d'autre à changer.
# ═══════════════════════════════════════════════════════════

from dataclasses import dataclass, field

from django.conf import settings
from django.utils import timezone

import requests as http_requests


# Correspondance mode de paiement interne → code opérateur Monetbil
OPERATEUR_MONETBIL = {
    'mtn_money':    'CM_MTNMOBILEMONEY',
    'orange_money': 'CM_ORANGEMONEY',
}


@dataclass
class PayoutResult:
    """Résultat normalisé d'une tentative de décaissement."""
    success: bool                 # l'opération a-t-elle été acceptée sans erreur
    status: str                   # 'paye' | 'en_attente' | 'echec'
    reference: str = ''           # identifiant du versement (côté fournisseur ou interne)
    message: str = ''
    raw: dict = field(default_factory=dict)


class PayoutProvider:
    """Interface d'un fournisseur de décaissement."""
    def send(self, *, phone, amount, operator='', reference='', reason=''):
        raise NotImplementedError


class ManualPayoutProvider(PayoutProvider):
    """Aucun versement automatique : à traiter manuellement (mode par défaut)."""
    def send(self, *, phone, amount, operator='', reference='', reason=''):
        return PayoutResult(
            success=True,
            status='en_attente',
            reference=reference,
            message="Décaissement automatique désactivé — à verser manuellement.",
        )


class MonetbilPayoutProvider(PayoutProvider):
    """Décaissement via l'API Monetbil (à câbler dès réception de la doc payout)."""

    def __init__(self, service_key, service_secret, base_url):
        self.service_key = service_key
        self.service_secret = service_secret
        self.base_url = base_url.rstrip('/')

    def send(self, *, phone, amount, operator='', reference='', reason=''):
        try:
            data = self._call_api(phone=phone, amount=amount, operator=operator,
                                   reference=reference, reason=reason)
        except NotImplementedError as exc:
            return PayoutResult(success=False, status='echec', reference=reference, message=str(exc))
        except Exception as exc:
            return PayoutResult(success=False, status='echec', reference=reference,
                                message=f'Erreur décaissement Monetbil : {exc}')
        return self._map_response(data, reference)

    def _call_api(self, *, phone, amount, operator, reference, reason):
        # ───────────────────────────────────────────────────────────────
        # TODO(Monetbil Payout) : implémenter l'appel réel avec la doc payout.
        # Forme ATTENDUE (à CONFIRMER avec la doc officielle) :
        #
        #   payload = {
        #       'service':     self.service_key,
        #       'phonenumber': phone,          # format 2376XXXXXXXX
        #       'amount':      int(amount),
        #       'operator':    operator,       # ex. CM_MTNMOBILEMONEY
        #       'currency':    'XAF',
        #       'country':     'CM',
        #       'payout_ref':  reference,
        #       # + éventuelle signature/authentification propre au payout
        #   }
        #   resp = http_requests.post(f'{self.base_url}/placePayout', data=payload, timeout=20)
        #   resp.raise_for_status()
        #   return resp.json()
        #
        # Puis adapter _map_response() aux champs réels renvoyés.
        # ───────────────────────────────────────────────────────────────
        raise NotImplementedError(
            "API de décaissement Monetbil non câblée : renseignez _call_api "
            "d'après la doc payout, puis activez MONETBIL_PAYOUT_ENABLED."
        )

    @staticmethod
    def _map_response(data, reference):
        # À ADAPTER selon la réponse réelle de l'API payout.
        status_raw = str(data.get('status', '')).upper()
        ref = data.get('payoutId') or data.get('transaction_id') or reference
        if status_raw in ('SUCCESS', 'PAID', 'COMPLETED'):
            return PayoutResult(True, 'paye', str(ref), data.get('message', 'Versé.'), data)
        if status_raw in ('REQUEST_ACCEPTED', 'PENDING', 'PROCESSING'):
            return PayoutResult(True, 'en_attente', str(ref), data.get('message', 'En cours.'), data)
        return PayoutResult(False, 'echec', str(ref), data.get('message', 'Échec du décaissement.'), data)


def get_payout_provider():
    """Retourne le provider actif selon la configuration."""
    if getattr(settings, 'MONETBIL_PAYOUT_ENABLED', False):
        return MonetbilPayoutProvider(
            settings.MONETBIL_SERVICE_KEY,
            settings.MONETBIL_SERVICE_SECRET,
            settings.MONETBIL_PAYOUT_URL,
        )
    return ManualPayoutProvider()


def executer_retrait(retrait):
    """Déclenche le versement d'une demande de retrait et met à jour son statut.

    - Décaissement activé  → tente l'envoi via Monetbil (payé / en attente / échec).
    - Décaissement désactivé → marque « approuvé » (à verser manuellement).
    Retourne le PayoutResult.
    """
    provider = get_payout_provider()
    operator = OPERATEUR_MONETBIL.get(retrait.mode_paiement, '')
    reference = retrait.payout_reference or f'PAYOUT-{retrait.pk}'

    result = provider.send(
        phone=retrait.numero_compte,
        amount=int(retrait.montant),
        operator=operator,
        reference=reference,
        reason=f'Retrait restaurant #{retrait.restaurant_id}',
    )

    retrait.payout_reference = result.reference or reference
    retrait.payout_message = (result.message or '')[:250]
    if result.status == 'paye':
        retrait.statut = 'paye'
        retrait.processed_at = timezone.now()
    elif result.status == 'en_attente':
        # Versement en cours (auto) OU à faire à la main (manuel) → « approuvé »
        retrait.statut = 'approuve'
    # 'echec' → on laisse le statut inchangé pour permettre une nouvelle tentative
    retrait.save(update_fields=['statut', 'processed_at', 'payout_reference', 'payout_message'])
    return result
