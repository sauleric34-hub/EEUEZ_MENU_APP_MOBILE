# ═══════════════════════════════════════════════════════════
#  Portail self-service partenaire — le partenaire gère lui-même ses clés,
#  son webhook et consulte ses commandes, sans passer par un admin EEUEZ à
#  chaque fois (seule la candidature KYB initiale reste une revue manuelle).
# ═══════════════════════════════════════════════════════════

from django.contrib import messages
from django.db.models import Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from core.models import AuditLog, Partenaire
from core.models_partenaire import APICredential, PartenaireWebhookConfig
from core.partner_portal_auth import (
    connexion_limitee, enregistrer_tentative_connexion, partenaire_connecte,
    partenaire_required, SESSION_KEY,
)


def login_view(request):
    if partenaire_connecte(request):
        return redirect('partner_portal:dashboard')

    if request.method == 'POST':
        if connexion_limitee(request):
            messages.error(request, "Trop de tentatives — réessayez dans un moment.")
            return render(request, 'partenaire_portal/login.html')

        email = request.POST.get('email', '').strip().lower()
        mot_de_passe = request.POST.get('password', '')
        partenaire = Partenaire.objects.filter(contact_email__iexact=email).first()
        enregistrer_tentative_connexion(request)

        if not partenaire or not partenaire.verifier_mot_de_passe(mot_de_passe):
            messages.error(request, "Identifiants invalides.")
        elif not partenaire.est_actif:
            messages.error(request, "Ce compte partenaire n'est plus actif (suspendu, rejeté, ou en attente d'approbation).")
        else:
            request.session[SESSION_KEY] = partenaire.pk
            return redirect('partner_portal:dashboard')

    return render(request, 'partenaire_portal/login.html')


def logout_view(request):
    request.session.pop(SESSION_KEY, None)
    return redirect('partner_portal:login')


@partenaire_required
def dashboard(request):
    partenaire = request.partenaire_courant
    debut_mois = timezone.now().date().replace(day=1)
    commandes_ce_mois = partenaire.commandes.filter(created_at__date__gte=debut_mois)
    commission_ce_mois = commandes_ce_mois.aggregate(total=Sum('commission_partenaire'))['total'] or 0

    return render(request, 'partenaire_portal/dashboard.html', {
        'active': 'dashboard',
        'partenaire': partenaire,
        'plan_config': partenaire.plan_config,
        'credentials': partenaire.credentials.all(),
        'webhook': getattr(partenaire, 'webhook', None),
        'nb_commandes_mois': commandes_ce_mois.count(),
        'commission_ce_mois': int(commission_ce_mois),
    })


@partenaire_required
def commandes(request):
    partenaire = request.partenaire_courant
    qs = partenaire.commandes.select_related('restaurant').order_by('-created_at')[:200]
    return render(request, 'partenaire_portal/commandes.html', {'active': 'commandes', 'partenaire': partenaire, 'commandes': qs})


@partenaire_required
def cles(request):
    partenaire = request.partenaire_courant

    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'emettre':
            environnement = request.POST.get('environnement', APICredential.ENV_SANDBOX)
            if environnement == APICredential.ENV_LIVE and not partenaire.plan_config['environnement_live']:
                messages.error(request, f"Le plan « {partenaire.plan_config['label']} » ne permet pas l'environnement live.")
            else:
                credential, secret_clair = APICredential.emettre(partenaire, environnement=environnement)
                AuditLog.objects.create(
                    action='PARTENAIRE_CREDENTIAL_EMIS_PORTAIL', model_name='Partenaire',
                    object_id=str(partenaire.pk),
                    description={'api_key': credential.api_key, 'environnement': environnement},
                    ip_address=request.META.get('REMOTE_ADDR'),
                )
                messages.success(
                    request,
                    f"Identifiant émis — à noter MAINTENANT, il ne sera plus jamais affiché : "
                    f"clé « {credential.api_key} », secret « {secret_clair} ».",
                )
        elif action == 'revoquer':
            credential = get_object_or_404(APICredential, pk=request.POST.get('credential_id'), partenaire=partenaire)
            credential.revoquer()
            AuditLog.objects.create(
                action='PARTENAIRE_CREDENTIAL_REVOQUE_PORTAIL', model_name='Partenaire',
                object_id=str(partenaire.pk), description={'api_key': credential.api_key},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            messages.success(request, f"Clé « {credential.api_key} » révoquée.")
        return redirect('partner_portal:cles')

    return render(request, 'partenaire_portal/cles.html', {
        'active': 'cles', 'partenaire': partenaire, 'credentials': partenaire.credentials.all(),
    })


@partenaire_required
def webhook(request):
    partenaire = request.partenaire_courant

    if request.method == 'POST':
        if not partenaire.plan_config['webhooks']:
            messages.error(request, f"Le plan « {partenaire.plan_config['label']} » n'inclut pas les webhooks.")
            return redirect('partner_portal:webhook')

        url = request.POST.get('url', '').strip()
        if not url:
            messages.error(request, "URL requise.")
            return redirect('partner_portal:webhook')

        config, secret_clair = PartenaireWebhookConfig.configurer(partenaire, url)
        AuditLog.objects.create(
            action='PARTENAIRE_WEBHOOK_CONFIGURE_PORTAIL', model_name='Partenaire',
            object_id=str(partenaire.pk), description={'url': url},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        messages.success(request, f"Webhook enregistré — secret de signature (à noter MAINTENANT) : « {secret_clair} ».")
        return redirect('partner_portal:webhook')

    return render(request, 'partenaire_portal/webhook.html', {
        'active': 'webhook', 'partenaire': partenaire, 'webhook': getattr(partenaire, 'webhook', None),
    })


@partenaire_required
def changer_mot_de_passe(request):
    partenaire = request.partenaire_courant

    if request.method == 'POST':
        actuel = request.POST.get('actuel', '')
        nouveau = request.POST.get('nouveau', '')
        confirmation = request.POST.get('confirmation', '')

        if not partenaire.verifier_mot_de_passe(actuel):
            messages.error(request, "Mot de passe actuel incorrect.")
        elif len(nouveau) < 8:
            messages.error(request, "Le nouveau mot de passe doit faire au moins 8 caractères.")
        elif nouveau != confirmation:
            messages.error(request, "La confirmation ne correspond pas.")
        else:
            partenaire.definir_mot_de_passe(nouveau)
            messages.success(request, "Mot de passe changé.")
        return redirect('partner_portal:changer_mot_de_passe')

    return render(request, 'partenaire_portal/mot_de_passe.html', {'active': 'mdp', 'partenaire': partenaire})
