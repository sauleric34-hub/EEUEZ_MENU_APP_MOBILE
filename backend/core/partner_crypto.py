# ═══════════════════════════════════════════════════════════
#  Chiffrement des secrets HMAC partenaires (API + webhooks sortants)
#
#  Un secret HMAC doit être RETROUVABLE en clair côté serveur (pour signer ou
#  vérifier une requête) : contrairement à un mot de passe, un hash à sens
#  unique est donc inutilisable ici. On le chiffre à la place (Fernet,
#  symétrique) avec PARTNER_SECRET_ENCRYPTION_KEY — jamais stocké en clair
#  en base. Voir settings.py pour la génération/rotation de la clé.
# ═══════════════════════════════════════════════════════════

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet():
    return Fernet(settings.PARTNER_SECRET_ENCRYPTION_KEY.encode()
                   if isinstance(settings.PARTNER_SECRET_ENCRYPTION_KEY, str)
                   else settings.PARTNER_SECRET_ENCRYPTION_KEY)


def chiffrer_secret(secret_clair):
    return _fernet().encrypt(secret_clair.encode('utf-8')).decode('ascii')


def dechiffrer_secret(secret_chiffre):
    try:
        return _fernet().decrypt(secret_chiffre.encode('ascii')).decode('utf-8')
    except (InvalidToken, ValueError):
        return None
