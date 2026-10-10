"""Connexion « Continuer avec Google / Apple » depuis l'app mobile.

L'app obtient un idToken (JWT signé par Google ou Apple) via le SDK natif et
nous l'envoie. On en vérifie la signature (clés publiques du fournisseur),
l'émetteur, l'audience (NOS identifiants d'app : un jeton émis pour une autre
app est refusé) et l'expiration. Le compte est ensuite retrouvé par son
e-mail vérifié, ou créé comme compte client sans mot de passe.
"""
import ssl
from dataclasses import dataclass

import certifi
import jwt
from django.conf import settings


class JetonInvalide(Exception):
    """idToken absent, mal formé, expiré, ou émis pour une autre app."""


@dataclass
class Identite:
    email: str
    prenom: str = ''
    nom: str = ''


FOURNISSEURS = {
    'google': {
        'jwks': 'https://www.googleapis.com/oauth2/v3/certs',
        'emetteurs': ('accounts.google.com', 'https://accounts.google.com'),
        'audiences': lambda: settings.GOOGLE_CLIENT_IDS,
    },
    'apple': {
        'jwks': 'https://appleid.apple.com/auth/keys',
        'emetteurs': ('https://appleid.apple.com',),
        'audiences': lambda: settings.APPLE_CLIENT_IDS,
    },
}

# Un client JWKS par fournisseur : les clés publiques sont mises en cache
# (elles tournent rarement) au lieu d'être retéléchargées à chaque connexion.
# Autorités de certifi : le serveur de prod n'a pas de magasin système
# (cf. core/mail_backend.py).
_clients_jwks = {}


def _cle_publique(fournisseur, jeton):
    client = _clients_jwks.get(fournisseur)
    if client is None:
        client = jwt.PyJWKClient(
            FOURNISSEURS[fournisseur]['jwks'], cache_keys=True, lifespan=3600, timeout=10,
            ssl_context=ssl.create_default_context(cafile=certifi.where()),
        )
        _clients_jwks[fournisseur] = client
    return client.get_signing_key_from_jwt(jeton).key


def verifier_jeton(fournisseur, jeton):
    """Renvoie l'Identite portée par un idToken valide, sinon lève JetonInvalide."""
    config = FOURNISSEURS.get(fournisseur)
    if config is None:
        raise JetonInvalide('Fournisseur inconnu.')
    audiences = [a for a in config['audiences']() if a]
    if not audiences:
        # Mauvaise configuration serveur : mieux vaut refuser que tout accepter.
        raise JetonInvalide(f'Connexion {fournisseur} non configurée sur le serveur.')
    if not isinstance(jeton, str) or not jeton:
        raise JetonInvalide('Jeton manquant.')
    try:
        claims = jwt.decode(
            jeton, _cle_publique(fournisseur, jeton), algorithms=['RS256'],
            audience=audiences, issuer=config['emetteurs'], leeway=60,
            options={'require': ['exp', 'iat', 'iss', 'aud', 'sub']},
        )
    except (jwt.PyJWTError, OSError) as e:
        raise JetonInvalide(str(e)) from e

    email = str(claims.get('email') or '').strip().lower()
    # Google renvoie un booléen, Apple parfois la chaîne « true ».
    if not email or str(claims.get('email_verified')).lower() != 'true':
        raise JetonInvalide('Adresse e-mail absente ou non vérifiée.')
    return Identite(
        email=email,
        prenom=str(claims.get('given_name') or '')[:150],
        nom=str(claims.get('family_name') or '')[:150],
    )
