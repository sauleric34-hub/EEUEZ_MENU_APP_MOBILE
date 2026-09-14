# ═══════════════════════════════════════════════════════════
#  Authentification des partenaires API : clé + signature HMAC de requête.
#
#  Choisi plutôt qu'OAuth2 ou un rôle JWT de plus : voir la discussion dans
#  le plan d'architecture (aucune infra OAuth2 n'existe dans ce repo, et un
#  partenaire n'est pas un compte humain qui se logue). Reprend le PATRON
#  déjà en production pour le webhook CamerPay (core/camerpay.py
#  verifier_signature_webhook) : HMAC-SHA256 sur une chaîne de champs
#  pipe-joints, jamais sur le corps brut directement.
#
#  Requête attendue :
#    X-EEUEZ-Key       : api_key du credential (identifiant, pas secret)
#    X-EEUEZ-Timestamp : epoch secondes (anti-rejeu, tolérance ci-dessous)
#    X-EEUEZ-Signature : HMAC-SHA256(secret, "timestamp|method|full_path|sha256(body)")
# ═══════════════════════════════════════════════════════════

import hashlib
import hmac
import time

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models_partenaire import APICredential


def _hash_body(request):
    corps = request.body or b''
    return hashlib.sha256(corps).hexdigest()


def construire_message_signature(*, timestamp, method, full_path, body_hash):
    return f'{timestamp}|{method.upper()}|{full_path}|{body_hash}'


class PartnerAPIKeyAuthentication(BaseAuthentication):
    www_authenticate_realm = 'partner-api'

    def authenticate(self, request):
        api_key = request.headers.get('X-EEUEZ-Key')
        signature = request.headers.get('X-EEUEZ-Signature')
        timestamp = request.headers.get('X-EEUEZ-Timestamp')

        if not api_key and not signature and not timestamp:
            # Pas une requête partenaire : laisse la place à un autre schéma
            # d'authentification (ou à l'anonymat, géré ensuite par la permission).
            return None

        if not (api_key and signature and timestamp):
            raise AuthenticationFailed("En-têtes de signature partenaire incomplets.")

        try:
            timestamp_int = int(timestamp)
        except ValueError:
            raise AuthenticationFailed("Horodatage invalide.")

        tolerance = settings.PARTNER_REQUEST_TIMESTAMP_TOLERANCE
        if abs(time.time() - timestamp_int) > tolerance:
            raise AuthenticationFailed("Requête expirée ou horodatage hors tolérance.")

        try:
            credential = APICredential.objects.select_related('partenaire').get(
                api_key=api_key, statut=APICredential.STATUT_ACTIVE,
            )
        except APICredential.DoesNotExist:
            raise AuthenticationFailed("Clé API inconnue ou révoquée.")

        secret = credential.obtenir_secret()
        if not secret:
            # Secret indéchiffrable (clé de chiffrement changée sans migration
            # des credentials) : à traiter comme une révocation, pas un 500.
            raise AuthenticationFailed("Identifiant partenaire invalide.")

        message = construire_message_signature(
            timestamp=timestamp_int, method=request.method,
            full_path=request.get_full_path(), body_hash=_hash_body(request),
        )
        attendu = hmac.new(secret.encode('utf-8'), message.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(attendu, signature):
            raise AuthenticationFailed("Signature invalide.")

        # Un partenaire suspendu/rejeté perd l'accès immédiatement même si sa
        # clé n'a pas été révoquée individuellement (double verrou).
        if not credential.partenaire.est_actif:
            raise AuthenticationFailed("Ce partenaire n'est plus autorisé.")

        # Second verrou pour le live : si le plan a été rétrogradé APRÈS
        # l'émission d'une clé live, elle ne doit pas rester utilisable —
        # l'émission (voir partenaires_admin.credential_emettre) est la
        # première ligne de défense, celle-ci couvre le cas d'un changement
        # de plan a posteriori.
        if credential.environnement == APICredential.ENV_LIVE and not credential.partenaire.plan_config['environnement_live']:
            raise AuthenticationFailed("Le plan de ce partenaire ne permet plus l'environnement live.")

        credential.enregistrer_utilisation()

        # Posé pour la permission EstPartenaireActif et les vues partenaire.
        request.partenaire = credential.partenaire
        request.api_credential = credential
        return (None, credential)

    def authenticate_header(self, request):
        return f'Signature realm="{self.www_authenticate_realm}"'
