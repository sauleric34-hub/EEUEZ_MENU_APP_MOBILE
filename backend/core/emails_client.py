"""E-mails transactionnels envoyés aux clients (HTML soigné + version texte).

- bienvenue à l'inscription, avec une sélection de plats pour commencer ;
- code à usage unique pour changer de mot de passe ;
- confirmation après changement de mot de passe (alerte de sécurité).

Le contenu est préparé dans la requête (accès base), seul l'envoi SMTP part
en arrière-plan quand EMAIL_ASYNC est actif : une boîte mail lente ne doit
pas faire attendre l'inscription. Best-effort : jamais d'exception remontée.
"""
import logging
import threading

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import Count
from django.template.loader import render_to_string
from django.templatetags.static import static
from django.utils import timezone

from .models_otp import DUREE_VALIDITE

logger = logging.getLogger(__name__)

SUPPORT_EMAIL = 'menu@cambus.cm'
NB_PLATS_BIENVENUE = 4


def _absolu(url):
    if not url:
        return None
    return url if url.startswith('http') else f"{settings.APP_BASE_URL.rstrip('/')}{url}"


def _contexte_commun(user):
    try:
        logo = static('logo.png')
    except ValueError:  # manifeste WhiteNoise absent (dev sans collectstatic)
        logo = '/static/logo.png'
    return {
        'base_url': settings.APP_BASE_URL,
        'logo_url': _absolu(logo),
        'support_email': SUPPORT_EMAIL,
        'prenom': (user.first_name or '').strip() or 'à vous',
        'email': user.email,
    }


def _envoyer(destinataire, sujet, gabarit, contexte, texte):
    """Construit le message puis l'envoie (en arrière-plan si EMAIL_ASYNC)."""
    if not destinataire:
        return False
    try:
        html = render_to_string(gabarit, contexte)
        message = EmailMultiAlternatives(
            subject=sujet, body=texte, from_email=f'MENU <{settings.DEFAULT_FROM_EMAIL}>',
            to=[destinataire],
        )
        message.attach_alternative(html, 'text/html')
    except Exception:
        logger.exception("Préparation de l'e-mail « %s » impossible", sujet)
        return False

    def envoi():
        try:
            message.send(fail_silently=False)
            return True
        except Exception:
            logger.exception("Échec d'envoi de l'e-mail « %s » à %s", sujet, destinataire)
            return False

    if getattr(settings, 'EMAIL_ASYNC', False):
        threading.Thread(target=envoi, daemon=True).start()
        return True  # mis en file : le résultat réel est journalisé
    return envoi()


# ─── Bienvenue ───────────────────────────────────────────────
def _plats_a_decouvrir(user):
    """Plats populaires et bien notés, en priorité dans la ville du client."""
    from .models import Plat

    base = Plat.objects.filter(
        is_available=True, is_visible=True,
        restaurant__is_verified=True,
    ).select_related('restaurant').annotate(
        nb_cmd=Count('lignecommande', distinct=True),
    ).order_by('-is_popular', '-nb_cmd', '-id')

    choix = []
    if user.ville:
        choix = list(base.filter(restaurant__ville__iexact=user.ville.strip())[:NB_PLATS_BIENVENUE])
    if len(choix) < NB_PLATS_BIENVENUE:
        deja = [p.pk for p in choix]
        choix += list(base.exclude(pk__in=deja)[:NB_PLATS_BIENVENUE - len(choix)])
    return choix


def _carte_plat(p):
    from .models import Plat  # noqa: F401  (import local : évite un cycle)
    note = p.restaurant.note_moyenne if hasattr(p.restaurant, 'note_moyenne') else None
    try:
        prix = int(p.prix_client)
    except Exception:
        prix = int(p.prix)
    return {
        'nom': p.nom,
        'restaurant': p.restaurant.nom,
        'note': f'{note:.1f}' if note else None,
        'prix': f"{prix:,}".replace(',', ' ') + ' FCFA',
        'image': _absolu(p.image.url) if p.image else None,
        'lien': f"{settings.APP_BASE_URL.rstrip('/')}/plat/{p.pk}/",
    }


def email_bienvenue(user):
    try:
        cartes = [_carte_plat(p) for p in _plats_a_decouvrir(user)]
    except Exception:
        logger.exception('Sélection des plats de bienvenue impossible')
        cartes = []
    contexte = {
        **_contexte_commun(user),
        'ville': (user.ville or '').strip(),
        # Grille 2 colonnes : on regroupe par paires
        'plats': [cartes[i:i + 2] for i in range(0, len(cartes), 2)],
        'etapes': [
            ('🍽️', 'Choisissez', 'Parcourez les plats et restaurants près de chez vous.'),
            ('🛵', 'Commandez', 'Payez en mobile money ou en espèces, livraison ou à emporter.'),
            ('😋', 'Savourez', 'Suivez votre livreur en direct jusqu\'à votre porte.'),
        ],
    }
    texte = (
        f"Bienvenue sur MENU, {contexte['prenom']} !\n\n"
        "Votre compte est prêt. Découvrez les meilleurs plats africains près de chez vous :\n"
        + ''.join(f"- {c['nom']} ({c['restaurant']}) — {c['prix']}\n" for c in cartes)
        + f"\nCommander : {settings.APP_BASE_URL}\n\n— L'équipe MENU"
    )
    return _envoyer(user.email, f"Bienvenue sur MENU, {contexte['prenom']} ! 🎉", 'emails/bienvenue.html', contexte, texte)


# ─── Mot de passe ────────────────────────────────────────────
def email_code_mot_de_passe(user, code):
    minutes = int(DUREE_VALIDITE.total_seconds() // 60)
    contexte = {
        **_contexte_commun(user),
        'code': code,
        'chiffres': list(code),
        'validite_minutes': minutes,
        'date': timezone.localtime(),
    }
    texte = (
        f"Bonjour {contexte['prenom']},\n\n"
        f"Votre code pour changer votre mot de passe MENU : {code}\n"
        f"Il est valable {minutes} minutes et ne peut servir qu'une fois.\n\n"
        "Ce n'est pas vous ? Ignorez cet e-mail : votre mot de passe reste inchangé.\n\n— L'équipe MENU"
    )
    return _envoyer(user.email, f'{code} — votre code de vérification MENU', 'emails/code_mot_de_passe.html', contexte, texte)


def email_mot_de_passe_modifie(user):
    contexte = {**_contexte_commun(user), 'date': timezone.localtime()}
    texte = (
        f"Bonjour {contexte['prenom']},\n\n"
        f"Le mot de passe de votre compte MENU a été modifié le {contexte['date']:%d/%m/%Y à %H:%M}.\n"
        f"Si vous n'êtes pas à l'origine de ce changement, écrivez-nous vite à {SUPPORT_EMAIL}.\n\n— L'équipe MENU"
    )
    return _envoyer(user.email, 'Votre mot de passe MENU a été modifié', 'emails/mot_de_passe_modifie.html', contexte, texte)
