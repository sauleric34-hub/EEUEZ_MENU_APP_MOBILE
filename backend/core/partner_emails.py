# ═══════════════════════════════════════════════════════════
#  Contenu des e-mails envoyés aux partenaires API — centralisé ici car
#  déclenché depuis plusieurs points d'entrée (admin ET portail self-service
#  émettent des clés/webhooks ; dupliquer le texte à chaque endroit aurait
#  fini par diverger). Utilise core/emailing.py (best-effort, jamais
#  d'exception qui remonte).
# ═══════════════════════════════════════════════════════════

from django.conf import settings

from .emailing import envoyer_email

SIGNATURE = "\n\n— EEUEZ Menu (menu@cambus.cm)"


def email_candidature_recue(partenaire):
    corps = (
        f"Bonjour {partenaire.contact_nom},\n\n"
        f"Nous avons bien reçu la candidature de « {partenaire.nom_commercial} » "
        "à l'API Partenaires EEUEZ Menu.\n"
        "Notre équipe examine votre dossier (RCCM, NIU, pièce d'identité du "
        "dirigeant) et vous recontactera à cette adresse.\n\n"
        "Un identifiant API vous sera communiqué une fois la vérification terminée."
        + SIGNATURE
    )
    return envoyer_email(partenaire.contact_email, "EEUEZ Menu — candidature reçue", corps)


def email_decision_partenaire(partenaire):
    """Notifie le partenaire de la décision qui vient d'être prise sur son
    dossier — lit partenaire.statut, donc à appeler APRÈS approuver()/
    rejeter()/suspendre()/passage en vérification."""
    doc_url = f"{settings.APP_BASE_URL}/partenaires/documentation/"

    if partenaire.statut == partenaire.STATUT_EN_VERIFICATION:
        sujet = "EEUEZ Menu — candidature en cours de vérification"
        corps = (
            f"Bonjour {partenaire.contact_nom},\n\n"
            f"La candidature de « {partenaire.nom_commercial} » est passée en vérification "
            "approfondie — nous revenons vers vous rapidement."
            + SIGNATURE
        )
    elif partenaire.statut == partenaire.STATUT_APPROUVE:
        sujet = "EEUEZ Menu — candidature approuvée"
        corps = (
            f"Bonjour {partenaire.contact_nom},\n\n"
            f"Bonne nouvelle : la candidature de « {partenaire.nom_commercial} » à l'API "
            "Partenaires EEUEZ Menu est APPROUVÉE.\n"
            "Vous allez recevoir séparément votre identifiant API et l'accès à votre "
            f"portail self-service.\n\nDocumentation : {doc_url}"
            + SIGNATURE
        )
    elif partenaire.statut == partenaire.STATUT_REJETE:
        sujet = "EEUEZ Menu — candidature non retenue"
        corps = (
            f"Bonjour {partenaire.contact_nom},\n\n"
            f"La candidature de « {partenaire.nom_commercial} » à l'API Partenaires "
            "EEUEZ Menu n'a pas été retenue.\n\n"
            f"Motif : {partenaire.motif_rejet}\n\n"
            "Vous pouvez répondre à cet e-mail pour toute question."
            + SIGNATURE
        )
    elif partenaire.statut == partenaire.STATUT_SUSPENDU:
        sujet = "EEUEZ Menu — accès API suspendu"
        corps = (
            f"Bonjour {partenaire.contact_nom},\n\n"
            f"L'accès de « {partenaire.nom_commercial} » à l'API Partenaires EEUEZ Menu "
            "est SUSPENDU.\n\n"
            f"Motif : {partenaire.motif_suspension}\n\n"
            "Toutes les clés API actives ont été révoquées. Répondez à cet e-mail pour en discuter."
            + SIGNATURE
        )
    else:
        return False
    return envoyer_email(partenaire.contact_email, sujet, corps)


def email_identifiant_api(partenaire, credential, secret_clair):
    corps = (
        f"Bonjour {partenaire.contact_nom},\n\n"
        f"Voici votre nouvel identifiant API EEUEZ Menu ({credential.get_environnement_display()}) :\n\n"
        f"  Clé    : {credential.api_key}\n"
        f"  Secret : {secret_clair}\n\n"
        "Ce secret ne sera plus jamais affiché ni renvoyé — conservez-le en lieu sûr.\n\n"
        f"Documentation : {settings.APP_BASE_URL}/partenaires/documentation/"
        + SIGNATURE
    )
    return envoyer_email(partenaire.contact_email, "EEUEZ Menu — nouvel identifiant API", corps)


def email_mot_de_passe_portail(partenaire, mot_de_passe_clair):
    corps = (
        f"Bonjour {partenaire.contact_nom},\n\n"
        "Votre accès au portail self-service EEUEZ Menu est prêt :\n\n"
        f"  URL          : {settings.APP_BASE_URL}/partenaires/portail/\n"
        f"  Identifiant  : {partenaire.contact_email}\n"
        f"  Mot de passe : {mot_de_passe_clair}\n\n"
        "Nous vous recommandons de le changer dès votre première connexion."
        + SIGNATURE
    )
    return envoyer_email(partenaire.contact_email, "EEUEZ Menu — accès à votre portail partenaire", corps)


def email_webhook_configure(partenaire, url, secret_clair):
    corps = (
        f"Bonjour {partenaire.contact_nom},\n\n"
        f"Votre webhook EEUEZ Menu a été configuré vers : {url}\n\n"
        f"Secret de signature (HMAC-SHA256) : {secret_clair}\n\n"
        f"Recette de vérification : {settings.APP_BASE_URL}/partenaires/documentation/#webhooks"
        + SIGNATURE
    )
    return envoyer_email(partenaire.contact_email, "EEUEZ Menu — secret de signature webhook", corps)
