"""Alertes de l'espace admin + e-mails d'urgence.

Chaque alerte est enregistrée (cloche de l'admin). Les e-mails partent vers
les destinataires configurés dans l'admin (page « Alertes & destinataires »)
et ceux de ADMIN_ALERT_EMAILS (.env), avec un anti-rafale : une même alerte
n'est envoyée qu'une fois par période, pour ne pas inonder les boîtes en
pleine panne."""
import logging

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

ANTI_RAFALE_S = 15 * 60


def destinataires(categorie, niveau):
    from core.models import DestinataireAlerte
    emails = {d.email.lower() for d in DestinataireAlerte.objects.filter(actif=True) if d.recoit(categorie, niveau)}
    emails |= {e.lower() for e in getattr(settings, 'ADMIN_ALERT_EMAILS', [])}
    return sorted(emails)


def alerter(*, titre, message='', niveau='avertissement', categorie='paiement', details=None,
            cle_anti_rafale=None, email=True):
    """Crée l'alerte admin et, si besoin, envoie l'e-mail d'urgence.
    Ne lève jamais : une alerte ne doit pas casser le paiement qui la déclenche."""
    from core.models import AlerteAdmin
    details = details or {}
    try:
        alerte = AlerteAdmin.objects.create(
            niveau=niveau, categorie=categorie, titre=titre[:160], message=message, donnees=details,
        )
    except Exception:
        logger.exception('Alerte admin impossible à enregistrer : %s', titre)
        alerte = None

    if not email:
        return alerte
    if cle_anti_rafale and not cache.add(f'alerte:email:{cle_anti_rafale}', 1, ANTI_RAFALE_S):
        return alerte  # déjà envoyée récemment
    try:
        envoyer_email_alerte(titre=titre, message=message, niveau=niveau, categorie=categorie, details=details)
    except Exception:
        logger.exception("E-mail d'alerte impossible : %s", titre)
    return alerte


def envoyer_email_alerte(*, titre, message, niveau, categorie, details):
    from core.emails_client import envoyer_email_admin
    a_qui = destinataires(categorie, niveau)
    if not a_qui:
        logger.warning("Alerte « %s » : aucun destinataire d'e-mail configuré.", titre)
        return
    envoyer_email_admin(
        destinataires=a_qui,
        sujet=f"{'🚨' if niveau == 'critique' else '⚠️'} [MENU] {titre}",
        contexte={
            'titre': titre, 'message': message, 'niveau': niveau, 'categorie': categorie,
            'details': details, 'date': timezone.localtime(),
            'lien_admin': f"{settings.APP_BASE_URL.rstrip('/')}/admin-panel/paiements/",
        },
    )
