"""Adaptateur CamerPay — enveloppe le client historique core/camerpay.py
(inchangé) dans le contrat commun. Flux « redirection » : pay_url affichée
dans le WebView ; résultat par webhook signé HMAC."""
import json

from django.conf import settings

from core import camerpay as api  # appels via le module : les tests peuvent le simuler
from ..base import (
    Adaptateur, DemandePaiement, EvenementPaiement, FLUX_REDIRECTION, ResultatLancement, WebhookInvalide,
)

# Opérateur interne → payment_method CamerPay
METHODE = {'mtn_momo': 'mtn_momo', 'orange_money': 'orange_money'}

# Messages d'erreur qui trahissent une panne de CamerPay (bascule utile)
SIGNES_DE_PANNE = ('contacter', 'illisible', 'non configuré', 'HTTP 5')


class CamerPay(Adaptateur):
    code = 'camerpay'
    nom = 'CamerPay'
    flux = FLUX_REDIRECTION
    couverture = {'CM': {'mtn_momo', 'orange_money'}}
    variables_env = ('CAMERPAY_TOKEN', 'CAMERPAY_CALLBACK_SECRET')

    def lancer(self, demande: DemandePaiement) -> ResultatLancement:
        uuid, url, erreur = api.initier_paiement(
            amount=demande.montant, merchant_invoice_id=demande.reference,
            payment_method=METHODE.get(demande.operateur, ''),
            customer_phone=demande.telephone, customer_email=demande.email,
            customer_name=demande.nom_client,
            callback_url=demande.url_notification, return_url=demande.url_retour,
        )
        if erreur:
            return ResultatLancement(
                ok=False, erreur=erreur,
                panne_agregateur=any(signe in erreur for signe in SIGNES_DE_PANNE),
            )
        return ResultatLancement(ok=True, provider_reference=uuid or '', payment_url=url or '', flux=FLUX_REDIRECTION)

    def lire_webhook(self, request) -> EvenementPaiement:
        # La doc CamerPay hésite entre form-urlencoded (`uuid`) et JSON
        # (`transaction_uuid`) : on accepte délibérément les deux.
        if 'application/json' in (request.content_type or ''):
            try:
                params = json.loads(request.body.decode('utf-8') or '{}')
            except (ValueError, UnicodeDecodeError):
                raise WebhookInvalide('JSON invalide', 400)
        else:
            params = request.POST

        def champ(*noms):
            for nom in noms:
                valeur = params.get(nom)
                if valeur not in (None, ''):
                    return str(valeur)
            return ''

        uuid = champ('uuid', 'transaction_uuid')
        reference = champ('invoice_id')
        statut = champ('status')
        montant = champ('amount')
        signature = champ('signature') or request.headers.get('X-CamerPay-Signature', '')
        if not reference:
            raise WebhookInvalide('invoice_id manquant', 400)
        # Signature TOUJOURS vérifiée : sans elle, une référence devinable
        # suffirait à faire passer une commande pour payée.
        if not api.verifier_signature_webhook(uuid=uuid, invoice_id=reference, status=statut,
                                              amount=montant, signature=signature):
            raise WebhookInvalide('Signature invalide ou absente', 403)
        return EvenementPaiement(
            reference=reference, provider_reference=uuid,
            statut=api.STATUT_PAR_CAMERPAY.get(statut), montant=montant, brut=dict(params.items()),
        )

    def verifier(self, provider_reference, reference=''):
        if not provider_reference:
            return None
        statut, erreur = api.verifier_statut(provider_reference)
        if erreur or statut is None:
            return None
        return EvenementPaiement(reference=reference, provider_reference=provider_reference,
                                 statut=api.STATUT_PAR_CAMERPAY.get(statut), brut={'status': statut})
