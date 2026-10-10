"""Disjoncteur : un agrégateur qui enchaîne les pannes est écarté quelques
minutes, pour que les clients passent directement par le secours au lieu
d'attendre un délai d'expiration à chaque paiement.

État en cache (Redis en production, mémoire locale en dev) : aucune requête
en base sur le chemin du paiement."""
from django.core.cache import cache

SEUIL_PANNES = 3          # pannes consécutives avant ouverture
FENETRE_S = 10 * 60       # les pannes « s'oublient » après 10 min sans nouvelle
DUREE_OUVERTURE_S = 5 * 60


def _cle(code, quoi):
    return f'paiement:disjoncteur:{code}:{quoi}'


def est_ouvert(code):
    return bool(cache.get(_cle(code, 'ouvert')))


def signaler_panne(code):
    """Renvoie True si cette panne vient d'OUVRIR le disjoncteur."""
    cle = _cle(code, 'pannes')
    try:
        n = cache.incr(cle)
        cache.touch(cle, FENETRE_S)
    except ValueError:
        cache.set(cle, 1, FENETRE_S)
        n = 1
    if n >= SEUIL_PANNES and not est_ouvert(code):
        cache.set(_cle(code, 'ouvert'), True, DUREE_OUVERTURE_S)
        return True
    return False


def signaler_succes(code):
    cache.delete(_cle(code, 'pannes'))


def reinitialiser(code):
    cache.delete_many([_cle(code, 'pannes'), _cle(code, 'ouvert')])
