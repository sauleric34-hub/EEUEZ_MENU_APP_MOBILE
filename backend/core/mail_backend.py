"""Backend SMTP qui vérifie le certificat du serveur avec les autorités de
certifi, au lieu du magasin système.

Pourquoi : le Python de python.org sur macOS (et certaines images Docker
minimales) n'a aucun certificat racine installé → toute connexion SMTP SSL
échoue avec CERTIFICATE_VERIFY_FAILED, et aucun e-mail ne part. certifi est
déjà une dépendance (via requests) et reste à jour avec pip.
"""
import ssl

import certifi
from django.core.mail.backends.smtp import EmailBackend as SMTPBackend
from django.utils.functional import cached_property


class EmailBackend(SMTPBackend):
    @cached_property
    def ssl_context(self):
        contexte = ssl.create_default_context(cafile=certifi.where())
        if self.ssl_certfile or self.ssl_keyfile:
            contexte.load_cert_chain(self.ssl_certfile, self.ssl_keyfile)
        return contexte
