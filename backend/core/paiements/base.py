"""Contrat commun des adaptateurs d'agrégateurs de paiement."""
from dataclasses import dataclass, field
from typing import Optional

# Statuts internes, communs à tous les agrégateurs (cf. Transaction.STATUT_CHOICES)
COMPLETE = 'complete'
ECHOUEE = 'echouee'
REMBOURSEE = 'remboursee'
EN_ATTENTE = None  # rien à faire : on attend la suite

FLUX_REDIRECTION = 'redirection'  # page de paiement hébergée (WebView)
FLUX_PUSH = 'push'                # demande envoyée sur le téléphone (USSD / appli)


@dataclass
class DemandePaiement:
    """Tout ce qu'un adaptateur peut utiliser pour lancer un paiement."""
    reference: str             # notre référence unique (EEUEZ-…, EEUEZG-…, RESA-…)
    montant: int               # montant entier dans la devise
    devise: str                # XAF, XOF…
    pays_code: str             # CM, CI, SN…
    operateur: str             # mtn_momo, orange_money, wave… (peut être vide)
    telephone: str = ''        # numéro du payeur (format libre, normalisé par l'adaptateur)
    email: str = ''
    nom_client: str = ''
    description: str = ''
    url_notification: str = ''  # webhook de CET agrégateur
    url_retour: str = ''        # page de fin de paiement surveillée par l'app


@dataclass
class ResultatLancement:
    ok: bool
    provider_reference: str = ''
    payment_url: str = ''
    flux: str = FLUX_REDIRECTION
    message: str = ''            # pour le client (flux push : « Validez sur votre téléphone… »)
    erreur: str = ''             # message d'erreur lisible
    # True si l'échec vient de l'agrégateur lui-même (réseau, 5xx, service
    # indisponible) : on peut alors basculer sur un autre. False si la
    # demande est invalide (numéro, montant…) : basculer ne servirait à rien.
    panne_agregateur: bool = False
    brut: dict = field(default_factory=dict)


@dataclass
class EvenementPaiement:
    """Résultat normalisé d'un webhook ou d'une vérification de statut."""
    reference: str
    provider_reference: str
    statut: Optional[str]        # COMPLETE / ECHOUEE / REMBOURSEE / None (en cours)
    montant: Optional[str] = None
    brut: dict = field(default_factory=dict)


class WebhookInvalide(Exception):
    """Signature absente/incorrecte ou corps illisible : réponse 400/403."""

    def __init__(self, message, code_http=403):
        super().__init__(message)
        self.code_http = code_http


class Adaptateur:
    code = ''
    nom = ''
    flux = FLUX_REDIRECTION
    # Opérateurs pris en charge par pays : {'CM': {'mtn_momo', 'orange_money'}, …}
    couverture: dict = {}
    # Variables .env requises pour fonctionner
    variables_env: tuple = ()
    implemente = True

    def est_configure(self):
        from django.conf import settings
        return all(getattr(settings, v, '') for v in self.variables_env)

    def couvre(self, pays_code, operateur):
        ops = self.couverture.get(pays_code)
        return ops is not None and (not operateur or operateur in ops)

    def lancer(self, demande: DemandePaiement) -> ResultatLancement:
        raise NotImplementedError

    def lire_webhook(self, request) -> EvenementPaiement:
        raise NotImplementedError

    def verifier(self, provider_reference: str, reference: str = '') -> Optional[EvenementPaiement]:
        """Statut réel chez l'agrégateur (None si injoignable)."""
        raise NotImplementedError

    def reponse_webhook(self):
        """Réponse HTTP attendue par l'agrégateur une fois le webhook traité."""
        from django.http import HttpResponse
        return HttpResponse('OK')
