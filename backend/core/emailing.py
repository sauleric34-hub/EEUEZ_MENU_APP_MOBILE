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
from django.utils import timezone

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


def alerter_livraison_en_retard(livraison):
    """Prévient l'équipe admin (settings.ADMIN_ALERT_EMAILS) qu'une livraison
    dépasse 1h sans confirmation, pour qu'elle appelle le restaurant.

    Best-effort comme le reste de ce module : ne lève jamais, ne bloque jamais
    l'appelant (la commande alerter_livraisons_en_retard marque la livraison
    comme alertée qu'un destinataire soit configuré ou non, et que l'envoi
    réussisse ou échoue — pour ne pas ré-essayer en boucle)."""
    destinataires = getattr(settings, 'ADMIN_ALERT_EMAILS', [])
    if not destinataires:
        return False

    commande = livraison.commande
    restaurant = commande.restaurant if commande else None
    attente = timezone.now() - livraison.created_at
    minutes = int(attente.total_seconds() // 60)

    sujet = f"⚠ Livraison en retard — commande #{commande.pk if commande else livraison.pk}"
    corps = (
        f"La livraison de la commande #{commande.pk if commande else livraison.pk} "
        f"n'est pas confirmée depuis {minutes} minutes.\n\n"
        f"Restaurant : {restaurant.nom if restaurant else '—'}\n"
        f"Téléphone restaurant : {restaurant.user.telephone if restaurant and restaurant.user else '—'}\n"
        f"Client : {(commande.client.get_full_name() or commande.client.username) if commande and commande.client else '—'}\n"
        f"Statut livraison : {livraison.get_statut_display()}\n"
        f"Créée le : {livraison.created_at.strftime('%d/%m/%Y %H:%M')}\n\n"
        "Merci d'appeler le restaurant pour comprendre le blocage et, au besoin, "
        "intervenir depuis l'espace admin (Livraisons)."
    )

    ok = True
    for destinataire in destinataires:
        ok = envoyer_email(destinataire, sujet, corps) and ok
    return ok
