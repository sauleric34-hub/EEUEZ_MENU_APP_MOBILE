"""Code d'agrégateur → adaptateur (instances partagées, sans état)."""
from .adaptateurs.a_venir import Campay, CinetPay, PawaPay
from .adaptateurs.camerpay import CamerPay

ADAPTATEURS = {a.code: a for a in (CamerPay(), CinetPay(), Campay(), PawaPay())}


def adaptateur(code):
    return ADAPTATEURS.get(code)
