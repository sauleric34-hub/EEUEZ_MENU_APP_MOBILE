# ═══════════════════════════════════════════════════════════
#  Authentification du portail self-service partenaire (session, humain).
#
#  DISTINCTE de PartnerAPIKeyAuthentication (clé + HMAC, machine-à-machine) :
#  un partenaire qui se connecte au portail depuis son navigateur est une
#  PERSONNE (le contact déclaré) qui consulte/gère son compte, pas un serveur
#  qui appelle l'API. Django `contrib.auth` n'est pas réutilisable ici (un
#  Partenaire n'est pas un `User` — voir models_partenaire.py) : session
#  maison, volontairement minimale.
# ═══════════════════════════════════════════════════════════

from functools import wraps

from django.core.cache import cache
from django.shortcuts import redirect

from .models_partenaire import Partenaire

SESSION_KEY = 'partenaire_portail_id'
LIMITE_TENTATIVES_PAR_HEURE = 10


def partenaire_connecte(request):
    pid = request.session.get(SESSION_KEY)
    if not pid:
        return None
    return Partenaire.objects.filter(pk=pid, statut=Partenaire.STATUT_APPROUVE).first()


def partenaire_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        partenaire = partenaire_connecte(request)
        if not partenaire:
            return redirect('partner_portal:login')
        request.partenaire_courant = partenaire
        return view_func(request, *args, **kwargs)
    return wrapper


def cle_limite_connexion(request):
    return f"partenaire-portail-login:{request.META.get('REMOTE_ADDR', 'inconnue')}"


def connexion_limitee(request):
    """Anti-brute-force, même principe que la candidature (compteur cache
    par IP) : un mot de passe se devine, une IP qui insiste ne doit pas
    pouvoir enchaîner les essais indéfiniment."""
    return cache.get(cle_limite_connexion(request), 0) >= LIMITE_TENTATIVES_PAR_HEURE


def enregistrer_tentative_connexion(request):
    cle = cle_limite_connexion(request)
    cache.set(cle, cache.get(cle, 0) + 1, timeout=3600)
