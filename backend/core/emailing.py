# ═══════════════════════════════════════════════════════════
#  Envoi d'e-mails sortants (boîte menu@cambus.cm — voir settings.py).
#
#  Best-effort partout où c'est appelé : un SMTP indisponible ou mal
#  configuré ne doit jamais casser le flux qui déclenche l'envoi (candidature,
#  décision admin, émission de clé…) — la donnée est de toute façon aussi
#  affichée à l'écran (secret une seule fois, décision en message flash).
#  Même principe défensif que core/payout_livreur.py::_notifier (push).
# ═══════════════════════════════════════════════════════════

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def envoyer_email(destinataire, sujet, corps):
    """Renvoie True si l'envoi a réussi (ou a été accepté par le serveur SMTP),
    False sinon — jamais d'exception qui remonte à l'appelant."""
    if not destinataire:
        return False
    try:
        send_mail(
            subject=sujet, message=corps, from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[destinataire], fail_silently=False,
        )
        return True
    except Exception:
        logger.exception("Échec d'envoi d'e-mail à %s (sujet : %s)", destinataire, sujet)
        return False
