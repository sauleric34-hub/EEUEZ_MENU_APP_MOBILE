"""Agrégateurs déclarés mais pas encore intégrés (étapes suivantes, avec
leur documentation officielle à jour). L'admin peut déjà préparer leurs
routes ; le routeur les ignore tant que `implemente` est False."""
from ..base import Adaptateur, FLUX_PUSH, FLUX_REDIRECTION, ResultatLancement


class _AVenir(Adaptateur):
    implemente = False

    def lancer(self, demande):
        return ResultatLancement(ok=False, erreur=f'{self.nom} : intégration en cours.', panne_agregateur=True)

    def lire_webhook(self, request):
        from ..base import WebhookInvalide
        raise WebhookInvalide(f'{self.nom} : intégration en cours.', 503)

    def verifier(self, provider_reference, reference=''):
        return None


# Couvertures indicatives (à confirmer avec la documentation de chaque
# agrégateur à l'intégration) — elles guident seulement l'admin.
class CinetPay(_AVenir):
    code = 'cinetpay'
    nom = 'CinetPay'
    flux = FLUX_REDIRECTION
    variables_env = ('CINETPAY_API_KEY', 'CINETPAY_SITE_ID', 'CINETPAY_SECRET_KEY')
    couverture = {
        'CI': {'orange_money', 'mtn_momo', 'moov_money', 'wave'},
        'SN': {'orange_money', 'free_money', 'wave'},
        'CM': {'mtn_momo', 'orange_money'},
        'BF': {'orange_money', 'moov_money'},
        'ML': {'orange_money', 'moov_money'},
        'TG': {'moov_money'},
        'BJ': {'mtn_momo', 'moov_money'},
        'NE': {'airtel_money'},
        'GN': {'orange_money', 'mtn_momo'},
        'CD': {'orange_money', 'airtel_money'},
    }


class Campay(_AVenir):
    code = 'campay'
    nom = 'Campay'
    flux = FLUX_PUSH
    variables_env = ('CAMPAY_USERNAME', 'CAMPAY_PASSWORD', 'CAMPAY_WEBHOOK_KEY')
    couverture = {'CM': {'mtn_momo', 'orange_money'}}


class PawaPay(_AVenir):
    code = 'pawapay'
    nom = 'PawaPay'
    flux = FLUX_PUSH
    variables_env = ('PAWAPAY_API_TOKEN',)
    couverture = {
        'CM': {'mtn_momo', 'orange_money'},
        'CI': {'mtn_momo', 'orange_money', 'moov_money', 'wave'},
        'SN': {'orange_money', 'free_money'},
        'BJ': {'mtn_momo', 'moov_money'},
        'BF': {'orange_money', 'moov_money'},
        'CD': {'orange_money', 'airtel_money'},
        'GH': {'mtn_momo', 'airtel_money'},
        'KE': {'mpesa'},
        'UG': {'mtn_momo', 'airtel_money'},
        'ZM': {'mtn_momo', 'airtel_money'},
        'RW': {'mtn_momo', 'airtel_money'},
    }
