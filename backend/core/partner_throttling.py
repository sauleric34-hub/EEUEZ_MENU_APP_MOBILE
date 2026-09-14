# ═══════════════════════════════════════════════════════════
#  Limitation de débit par PARTENAIRE (pas par IP ni par utilisateur).
#
#  ScopedRateThrottle clé par défaut sur l'IP (anonyme) ou le user.pk
#  (authentifié) — un partenaire n'est ni l'un ni l'autre : sans ce
#  correctif, tous les partenaires derrière la même passerelle sortante
#  partageraient un seul compteur, ou verraient leur trafic confondu avec
#  celui d'autres appelants anonymes.
# ═══════════════════════════════════════════════════════════

from rest_framework.throttling import ScopedRateThrottle


class PartnerRateThrottle(ScopedRateThrottle):
    def get_cache_key(self, request, view):
        partenaire = getattr(request, 'partenaire', None)
        if not partenaire:
            # Pas encore authentifié (ex. clé invalide) : repli sur l'IP,
            # pour qu'une avalanche de requêtes non authentifiées reste limitée.
            ident = self.get_ident(request)
        else:
            ident = f'partenaire:{partenaire.pk}'
        return self.cache_format % {'scope': self.scope, 'ident': ident}

    def allow_request(self, request, view):
        """Ajoute, par-dessus le débit court terme (scope), le quota MENSUEL
        du plan du partenaire — deux fenêtres différentes, deux raisons de
        refuser différentes, mais un seul throttle à déclarer par vue."""
        if not super().allow_request(request, view):
            return False
        credential = getattr(request, 'api_credential', None)
        if credential and not credential.quota_disponible():
            return False
        return True

    def wait(self):
        # DRF appelle wait() (pour le header Retry-After) dès qu'une requête
        # est refusée — y compris par NOTRE refus quota, indépendant du
        # système de rate/history de ScopedRateThrottle. Si le scope n'a pas
        # de rate configuré (self.rate is None, ex. tests), self.num_requests
        # vaut None et le calcul de la classe mère plante : rien de précis à
        # annoncer dans ce cas, donc pas de Retry-After plutôt qu'une erreur.
        if self.rate is None:
            return None
        return super().wait()
