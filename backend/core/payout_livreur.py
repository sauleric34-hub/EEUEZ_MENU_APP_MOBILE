# ═══════════════════════════════════════════════════════════
#  Paiement automatique des livreurs indépendants
#
#  Dès que le solde d'un livreur atteint ParametrageLivraison.
#  seuil_paiement_auto, on émet un PaiementLivreur et on tente
#  le décaissement via le même fournisseur que les retraits
#  restaurant (core.payout). Tant que le livreur n'a pas
#  renseigné son numéro mobile money, rien n'est déclenché.
# ═══════════════════════════════════════════════════════════

from django.db import transaction
from django.utils import timezone

from .payout import get_payout_provider, OPERATEUR_CAMERPAY


def verser_si_seuil_atteint(livreur):
    """Déclenche un versement si le solde du livreur dépasse le seuil configuré.
    Renvoie le PaiementLivreur créé, ou None."""
    from .models_livraison import ParametrageLivraison

    if not livreur or not livreur.paiement_numero:
        return None

    seuil = ParametrageLivraison.get_solo().seuil_paiement_auto
    if livreur.solde_livreur < seuil:
        return None
    return declencher_paiement_livreur(livreur, auto=True)


def declencher_paiement_livreur(livreur, *, auto=True):
    """Crée un PaiementLivreur pour la totalité du solde courant et tente le
    décaissement. Idempotence légère : on ne relance pas s'il existe déjà un
    paiement en cours (en_attente / approuvé)."""
    from .models_livraison import PaiementLivreur

    if not livreur.paiement_numero:
        return None

    with transaction.atomic():
        en_cours = PaiementLivreur.objects.select_for_update().filter(
            livreur=livreur, statut__in=['en_attente', 'approuve'],
        ).exists()
        if en_cours:
            return None

        montant = int(livreur.solde_livreur)
        if montant <= 0:
            return None

        operateur = livreur.paiement_operateur or 'mtn_money'
        paiement = PaiementLivreur.objects.create(
            livreur=livreur, montant=montant, operateur=operateur,
            numero=livreur.paiement_numero, auto=auto,
        )

    provider = get_payout_provider()
    reference = f'PAYLIV-{paiement.pk}'
    result = provider.send(
        phone=paiement.numero,
        amount=int(paiement.montant),
        operator=OPERATEUR_CAMERPAY.get(operateur, ''),
        reference=reference,
        reason=f'Gains livreur #{livreur.pk}',
    )

    paiement.payout_reference = result.reference or reference
    paiement.payout_message = (result.message or '')[:250]
    if result.status == 'paye':
        paiement.statut = 'paye'
        paiement.processed_at = timezone.now()
    elif result.status == 'en_attente':
        paiement.statut = 'approuve'
    else:  # 'echec' — on annule la demande pour ne pas geler le solde
        paiement.statut = 'refuse'
        paiement.processed_at = timezone.now()
    paiement.save(update_fields=['statut', 'processed_at', 'payout_reference', 'payout_message'])

    _notifier(livreur, paiement)
    return paiement


def _notifier(livreur, paiement):
    if paiement.statut == 'refuse':
        return
    try:
        from .push import envoyer_push
        envoyer_push(
            [livreur], 'Paiement en route',
            f'{int(paiement.montant)} F envoyés vers votre {paiement.get_operateur_display()}.',
            data={'type': 'paiement', 'paiement_id': paiement.pk},
        )
    except Exception:
        pass
