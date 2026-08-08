# ═══════════════════════════════════════════════════════════
#  Décaissement (payout / cashout) — versement vers un bénéficiaire
#  Utilisé pour les RETRAITS de fonds des restaurants.
#
#  Via CamerPay POST /payouts/batch (un seul bénéficiaire par appel ici).
#  ⚠️ La doc CamerPay mentionne un « workflow d'approbation admin » côté
#  plateforme pour les batches de versement : un HTTP 2xx signifie que la
#  demande a été ACCEPTÉE, pas que l'argent est déjà versé. On ne marque donc
#  jamais un retrait « payé » sur cette seule base — voir _map_response.
#
#  Tant que settings.CAMERPAY_PAYOUT_ENABLED est False → ManualPayoutProvider
#  (la demande est approuvée mais le versement se fait à la main).
# ═══════════════════════════════════════════════════════════

from dataclasses import dataclass, field

from django.conf import settings
from django.utils import timezone

from .camerpay import initier_payout_batch

# Correspondance mode de paiement interne → opérateur attendu par CamerPay
# (mêmes valeurs que payment_method sur /payment/initiate).
OPERATEUR_CAMERPAY = {
    'mtn_money':    'mtn_momo',
    'orange_money': 'orange_money',
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


class CamerPayPayoutProvider(PayoutProvider):
    """Décaissement via l'API CamerPay (POST /payouts/batch, 1 bénéficiaire)."""

    def send(self, *, phone, amount, operator='', reference='', reason=''):
        data, error = initier_payout_batch(
            reference=reference,
            beneficiaries=[{'phone': phone, 'amount': amount, 'name': reason, 'operator': operator}],
        )
        if error:
            return PayoutResult(success=False, status='echec', reference=reference, message=error)
        return self._map_response(data, reference)

    @staticmethod
    def _map_response(data, reference):
        # Le batch a été accepté par l'API : il attend l'approbation admin côté
        # CamerPay avant versement effectif (workflow non documenté publiquement
        # au-delà de cette mention). On reste donc prudent : 'en_attente' plutôt
        # que 'paye', même en cas de succès HTTP. À affiner dès confirmation du
        # format exact des statuts de batch (dashboard CamerPay / webhook payout).
        ref = data.get('batch_id') or data.get('reference') or reference
        return PayoutResult(True, 'en_attente', str(ref), 'Versement soumis à CamerPay — en attente de traitement.', data)


def get_payout_provider():
    """Retourne le provider actif selon la configuration."""
    if getattr(settings, 'CAMERPAY_PAYOUT_ENABLED', False):
        return CamerPayPayoutProvider()
    return ManualPayoutProvider()


def executer_retrait(retrait):
    """Déclenche le versement d'une demande de retrait et met à jour son statut.

    - Décaissement activé  → tente l'envoi via CamerPay (soumis / échec).
    - Décaissement désactivé → marque « approuvé » (à verser manuellement).
    Retourne le PayoutResult.
    """
    provider = get_payout_provider()
    operator = OPERATEUR_CAMERPAY.get(retrait.mode_paiement, '')
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
