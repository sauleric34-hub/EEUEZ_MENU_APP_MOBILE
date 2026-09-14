# ═══════════════════════════════════════════════════════════
#  Description du schéma d'auth PartnerAPIKeyAuthentication pour
#  drf-spectacular — sans ça, Swagger/Redoc ignorent silencieusement notre
#  schéma d'authentification maison (clé + HMAC), absent de la spec OpenAPI
#  par défaut. Importé depuis core/apps.py::ready() pour que la classe
#  s'enregistre avant toute génération de schéma.
# ═══════════════════════════════════════════════════════════

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class PartnerHmacAuthScheme(OpenApiAuthenticationExtension):
    target_class = 'core.partner_auth.PartnerAPIKeyAuthentication'
    name = 'PartnerHmacAuth'

    def get_security_definition(self, auto_schema):
        # OpenAPI ne modélise pas nativement une auth à 3 en-têtes composites :
        # on documente l'en-tête d'identification ici, le reste (Timestamp,
        # Signature, recette HMAC) dans la description — voir la doc complète.
        return {
            'type': 'apiKey',
            'in': 'header',
            'name': 'X-EEUEZ-Key',
            'description': (
                "Authentification par clé + signature HMAC-SHA256. En plus de "
                "X-EEUEZ-Key, CHAQUE requête doit aussi inclure X-EEUEZ-Timestamp "
                "(epoch secondes) et X-EEUEZ-Signature "
                "(HMAC-SHA256(secret, \"timestamp|method|full_path|sha256(body)\")). "
                "Recette complète et exemples : /partenaires/documentation/#auth"
            ),
        }
