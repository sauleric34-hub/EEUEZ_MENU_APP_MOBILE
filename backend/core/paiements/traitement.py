"""Application d'un résultat de paiement, quel que soit l'agrégateur.

La logique métier (verrous de ligne, contrôle du montant, idempotence,
double paiement, confirmation des commandes) reste celle, éprouvée, de
core/api_views.py : ce module l'aiguille simplement selon la référence.
"""
import logging

from django.db import transaction
from django.utils import timezone

from .base import COMPLETE, ECHOUEE, REMBOURSEE
from .registre import adaptateur

logger = logging.getLogger(__name__)


def appliquer(evenement, agregateur_code):
    """Applique un EvenementPaiement. Renvoie la réponse HTTP du traitement."""
    from core import api_views as av

    ref = evenement.reference
    if ref.startswith('RESA-'):
        reponse = av._camerpay_notify_reservation(ref, evenement.statut)
    elif ref.startswith('EEUEZG-'):
        reponse = av._camerpay_notify_groupe(ref, evenement.statut, evenement.montant, evenement.provider_reference)
    else:
        with transaction.atomic():
            reponse = av._camerpay_notify_commande(ref, evenement.statut, evenement.montant, evenement.provider_reference)
    if reponse.status_code < 300:
        _maj_journal(evenement, agregateur_code)
    return reponse


def _maj_journal(evenement, agregateur_code):
    """Reporte le statut final sur la tentative correspondante (statistiques)."""
    if evenement.statut not in (COMPLETE, ECHOUEE, REMBOURSEE):
        return
    from core.models import TentativePaiement
    try:
        qs = TentativePaiement.objects.filter(reference=evenement.reference, agregateur=agregateur_code)
        if evenement.provider_reference:
            exacte = qs.filter(provider_reference=evenement.provider_reference)
            qs = exacte if exacte.exists() else qs
        qs.exclude(statut='echec_lancement').update(statut=evenement.statut, updated_at=timezone.now())
    except Exception:
        logger.exception('Paiement : mise à jour du journal impossible (%s)', evenement.reference)


def paiement_annulable(agregateur_code, provider_reference):
    """(annulable, message) — même règle que pour CamerPay : on n'annule une
    commande dont le paiement a été lancé que si l'agrégateur confirme
    EXPLICITEMENT l'échec (Mobile Money est asynchrone : le client peut
    valider son code bien après avoir fermé la page)."""
    if not provider_reference:
        return True, ''
    code = agregateur_code or 'camerpay'  # paiements antérieurs : CamerPay
    if code == 'camerpay':
        from core import camerpay
        return camerpay.paiement_annulable(provider_reference)
    ad = adaptateur(code)
    evenement = ad.verifier(provider_reference) if ad else None
    if evenement and evenement.statut == ECHOUEE:
        return True, ''
    if evenement and evenement.statut in (COMPLETE, REMBOURSEE):
        return False, 'Paiement déjà reçu — votre commande va être confirmée.'
    return False, (
        "Paiement en cours de validation par l'opérateur. Si vous l'avez validé "
        "sur votre téléphone, la commande sera confirmée automatiquement ; sinon "
        "réessayez d'annuler dans quelques minutes."
    )


def verifier_tentative(tentative):
    """Interroge l'agrégateur pour une tentative en attente et applique le
    résultat s'il est définitif (filet de sécurité si un webhook se perd).
    Renvoie le statut obtenu (ou None)."""
    ad = adaptateur(tentative.agregateur)
    if not ad or not ad.implemente:
        return None
    try:
        evenement = ad.verifier(tentative.provider_reference, tentative.reference)
    except Exception:
        logger.exception('Paiement : vérification impossible (%s)', tentative.reference)
        evenement = None
    tentative.derniere_verification = timezone.now()
    tentative.save(update_fields=['derniere_verification'])
    if not evenement or evenement.statut is None:
        return None
    evenement.reference = evenement.reference or tentative.reference
    if not evenement.montant:
        evenement.montant = str(int(tentative.montant))
    appliquer(evenement, tentative.agregateur)
    return evenement.statut
