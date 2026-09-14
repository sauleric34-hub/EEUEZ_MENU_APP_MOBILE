# ═══════════════════════════════════════════════════════════
#  Revue KYB des partenaires API — admin-panel (session, pas DRF).
#
#  Un partenaire n'obtient un identifiant API qu'à l'approbation manuelle
#  d'un admin, après examen des pièces jointes (RCCM, NIU, pièce d'identité
#  du dirigeant…). Le secret n'est JAMAIS stocké en clair : il n'est visible
#  qu'une seule fois, juste après son émission (voir credential_emettre).
# ═══════════════════════════════════════════════════════════

import secrets

from django.contrib import messages
from django.db.models import Sum
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from core.models import AuditLog, DocumentKYB, Partenaire, PartenaireWebhookConfig
from core.models_partenaire import APICredential, PLAN_CHOICES, PLANS
from core.partner_emails import (
    email_decision_partenaire, email_identifiant_api, email_mot_de_passe_portail,
    email_webhook_configure,
)
from .dashboard import admin_required


@admin_required
def partenaires_list(request):
    statut = request.GET.get('statut', '')
    qs = Partenaire.objects.all()
    if statut:
        qs = qs.filter(statut=statut)
    filtres = [
        {'code': code, 'label': label, 'count': Partenaire.objects.filter(statut=code).count()}
        for code, label in Partenaire.STATUT_CHOICES
    ]
    return render(request, 'admin_panel/partenaires/list.html', {
        'partenaires': qs,
        'statut_filtre': statut,
        'filtres': filtres,
        'active_page': 'partenaires',
    })


@admin_required
def partenaire_detail(request, pk):
    partenaire = get_object_or_404(Partenaire, pk=pk)
    debut_mois = timezone.now().date().replace(day=1)
    commission_ce_mois = partenaire.commandes.filter(
        created_at__date__gte=debut_mois,
    ).aggregate(total=Sum('commission_partenaire'))['total'] or 0
    return render(request, 'admin_panel/partenaires/detail.html', {
        'partenaire': partenaire,
        'plan_config': partenaire.plan_config,
        'plans': PLAN_CHOICES,
        'commission_ce_mois': int(commission_ce_mois),
        'documents': partenaire.documents.all(),
        'credentials': partenaire.credentials.all(),
        'webhook': getattr(partenaire, 'webhook', None),
        'active_page': 'partenaires',
    })


@admin_required
def partenaire_plan_changer(request, pk):
    partenaire = get_object_or_404(Partenaire, pk=pk)
    if request.method != 'POST':
        return redirect('core:partenaire_detail', pk=pk)

    nouveau_plan = request.POST.get('plan')
    if nouveau_plan not in PLANS:
        messages.error(request, "Plan inconnu.")
        return redirect('core:partenaire_detail', pk=pk)

    ancien_plan = partenaire.plan
    partenaire.plan = nouveau_plan
    partenaire.save(update_fields=['plan', 'updated_at'])

    # Une clé live déjà émise devient inutilisable dès la prochaine requête si
    # le nouveau plan n'autorise plus le live (revérifié dans partner_auth.py)
    # — pas besoin de la révoquer ici, mais on prévient l'admin.
    if not PLANS[nouveau_plan]['environnement_live']:
        nb_live = partenaire.credentials.filter(
            environnement=APICredential.ENV_LIVE, statut=APICredential.STATUT_ACTIVE,
        ).count()
        if nb_live:
            messages.warning(request, f"{nb_live} clé(s) live existante(s) cesseront de fonctionner (plan sans accès live).")

    AuditLog.objects.create(
        user=request.user, action='PARTENAIRE_PLAN_CHANGE',
        model_name='Partenaire', object_id=str(partenaire.pk),
        description={'ancien_plan': ancien_plan, 'nouveau_plan': nouveau_plan},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    messages.success(request, f"Plan changé : « {PLANS[nouveau_plan]['label']} ».")
    return redirect('core:partenaire_detail', pk=pk)


@admin_required
def partenaire_decider(request, pk):
    if request.method != 'POST':
        return redirect('core:partenaire_detail', pk=pk)

    partenaire = get_object_or_404(Partenaire, pk=pk)
    action = request.POST.get('action')
    motif = request.POST.get('motif', '').strip()

    if action == 'en_verification':
        from django.utils import timezone
        partenaire.statut = Partenaire.STATUT_EN_VERIFICATION
        partenaire.verifie_le = timezone.now()
        partenaire.save(update_fields=['statut', 'verifie_le', 'updated_at'])
        messages.success(request, "Candidature passée en vérification.")
    elif action == 'approuver':
        partenaire.approuver(request.user)
        messages.success(request, f"« {partenaire.nom_commercial} » est approuvé — émettez son identifiant API ci-dessous.")
    elif action == 'rejeter':
        if not motif:
            messages.error(request, "Un motif de rejet est requis.")
            return redirect('core:partenaire_detail', pk=pk)
        partenaire.rejeter(request.user, motif)
        messages.success(request, f"« {partenaire.nom_commercial} » rejeté.")
    elif action == 'suspendre':
        if not motif:
            messages.error(request, "Un motif de suspension est requis.")
            return redirect('core:partenaire_detail', pk=pk)
        partenaire.suspendre(request.user, motif)
        # Toute clé active de ce partenaire est coupée dès la suspension —
        # PartnerAPIKeyAuthentication revérifie déjà partenaire.est_actif à
        # chaque requête, mais révoquer explicitement évite toute ambiguïté
        # si le statut est un jour restauré sans repasser par une revue.
        partenaire.credentials.filter(statut=APICredential.STATUT_ACTIVE).update(statut=APICredential.STATUT_REVOQUEE)
        messages.success(request, f"« {partenaire.nom_commercial} » suspendu, ses clés API révoquées.")
    else:
        messages.error(request, "Action inconnue.")
        return redirect('core:partenaire_detail', pk=pk)

    if not email_decision_partenaire(partenaire):
        messages.warning(request, "La notification par e-mail n'a pas pu être envoyée (SMTP) — prévenez le partenaire vous-même.")

    AuditLog.objects.create(
        user=request.user, action=f'PARTENAIRE_{action.upper()}',
        model_name='Partenaire', object_id=str(partenaire.pk),
        description={'motif': motif} if motif else {},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return redirect('core:partenaire_detail', pk=pk)


@admin_required
def document_decider(request, pk):
    document = get_object_or_404(DocumentKYB, pk=pk)
    if request.method == 'POST':
        action = request.POST.get('action')
        if action in (DocumentKYB.STATUT_VALIDE, DocumentKYB.STATUT_REJETE):
            document.statut = action
            document.commentaire = request.POST.get('commentaire', '').strip()
            document.save(update_fields=['statut', 'commentaire'])
            messages.success(request, "Document mis à jour.")
    return redirect('core:partenaire_detail', pk=document.partenaire_id)


@admin_required
def document_telecharger(request, pk):
    """Seul point d'accès aux pièces KYB : jamais via /media/ (voir
    core/storage.py DocumentKYBStorage — stockage hors MEDIA_ROOT exprès)."""
    document = get_object_or_404(DocumentKYB, pk=pk)
    try:
        fichier = document.fichier.open('rb')
    except (FileNotFoundError, ValueError):
        raise Http404("Fichier introuvable.")
    return FileResponse(fichier, as_attachment=True, filename=document.fichier.name.rsplit('/', 1)[-1])


@admin_required
def credential_emettre(request, pk):
    partenaire = get_object_or_404(Partenaire, pk=pk)
    if request.method != 'POST':
        return redirect('core:partenaire_detail', pk=pk)
    if not partenaire.est_actif:
        messages.error(request, "Le partenaire doit être approuvé avant d'émettre une clé.")
        return redirect('core:partenaire_detail', pk=pk)

    environnement = request.POST.get('environnement', APICredential.ENV_SANDBOX)
    if environnement == APICredential.ENV_LIVE and not partenaire.plan_config['environnement_live']:
        messages.error(request, f"Le plan « {partenaire.plan_config['label']} » ne permet pas l'environnement live.")
        return redirect('core:partenaire_detail', pk=pk)

    credential, secret_clair = APICredential.emettre(partenaire, environnement=environnement)
    AuditLog.objects.create(
        user=request.user, action='PARTENAIRE_CREDENTIAL_EMIS',
        model_name='Partenaire', object_id=str(partenaire.pk),
        description={'api_key': credential.api_key, 'environnement': environnement},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    envoye = email_identifiant_api(partenaire, credential, secret_clair)
    messages.success(
        request,
        f"Identifiant émis{' et envoyé par e-mail à ' + partenaire.contact_email if envoye else ''} — "
        f"à noter MAINTENANT, il ne sera plus jamais affiché : "
        f"clé « {credential.api_key} », secret « {secret_clair} ».",
    )
    return redirect('core:partenaire_detail', pk=pk)


@admin_required
def api_keys_list(request):
    """Vue transversale de TOUS les identifiants API, tous partenaires
    confondus — pour gérer « les utilisateurs des clés » sans naviguer
    partenaire par partenaire (suivi d'usage, révocation rapide)."""
    qs = APICredential.objects.select_related('partenaire').order_by('-created_at')

    statut = request.GET.get('statut', '')
    if statut:
        qs = qs.filter(statut=statut)
    environnement = request.GET.get('environnement', '')
    if environnement:
        qs = qs.filter(environnement=environnement)

    credentials = []
    for c in qs:
        quota = c.quota_mensuel()
        credentials.append({
            'obj': c,
            'quota': quota,
            'pourcentage': min(100, round(100 * c.requetes_mois_courant / quota)) if quota else None,
        })

    return render(request, 'admin_panel/partenaires/cles.html', {
        'credentials': credentials,
        'statut_filtre': statut,
        'environnement_filtre': environnement,
        'active_page': 'partenaires',
    })


@admin_required
def mot_de_passe_generer(request, pk):
    """Génère (ou régénère) le mot de passe du portail self-service — affiché
    une seule fois, à relayer au partenaire hors-bande, exactement comme un
    secret API. Le partenaire le change ensuite lui-même depuis le portail."""
    partenaire = get_object_or_404(Partenaire, pk=pk)
    if request.method != 'POST':
        return redirect('core:partenaire_detail', pk=pk)
    if not partenaire.est_actif:
        messages.error(request, "Le partenaire doit être approuvé avant d'activer son accès portail.")
        return redirect('core:partenaire_detail', pk=pk)

    mot_de_passe = secrets.token_urlsafe(9)
    partenaire.definir_mot_de_passe(mot_de_passe)
    AuditLog.objects.create(
        user=request.user, action='PARTENAIRE_MDP_PORTAIL_GENERE',
        model_name='Partenaire', object_id=str(partenaire.pk), description={},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    envoye = email_mot_de_passe_portail(partenaire, mot_de_passe)
    messages.success(
        request,
        f"Accès portail activé{' et envoyé par e-mail à ' + partenaire.contact_email if envoye else ''} — "
        f"mot de passe (à noter MAINTENANT) : « {mot_de_passe} ».",
    )
    return redirect('core:partenaire_detail', pk=pk)


@admin_required
def credential_revoquer(request, pk):
    credential = get_object_or_404(APICredential, pk=pk)
    if request.method == 'POST':
        credential.revoquer()
        AuditLog.objects.create(
            user=request.user, action='PARTENAIRE_CREDENTIAL_REVOQUE',
            model_name='Partenaire', object_id=str(credential.partenaire_id),
            description={'api_key': credential.api_key},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        messages.success(request, f"Clé « {credential.api_key} » révoquée.")
    return redirect('core:partenaire_detail', pk=credential.partenaire_id)


@admin_required
def webhook_configurer(request, pk):
    partenaire = get_object_or_404(Partenaire, pk=pk)
    if request.method != 'POST':
        return redirect('core:partenaire_detail', pk=pk)

    if not partenaire.plan_config['webhooks']:
        messages.error(request, f"Le plan « {partenaire.plan_config['label']} » n'inclut pas les webhooks.")
        return redirect('core:partenaire_detail', pk=pk)

    url = request.POST.get('url', '').strip()
    if not url:
        messages.error(request, "URL de webhook requise.")
        return redirect('core:partenaire_detail', pk=pk)

    config, secret_clair = PartenaireWebhookConfig.configurer(partenaire, url)
    AuditLog.objects.create(
        user=request.user, action='PARTENAIRE_WEBHOOK_CONFIGURE',
        model_name='Partenaire', object_id=str(partenaire.pk),
        description={'url': url},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    envoye = email_webhook_configure(partenaire, url, secret_clair)
    messages.success(
        request,
        f"Webhook enregistré{' et secret envoyé par e-mail à ' + partenaire.contact_email if envoye else ''} — "
        f"secret de signature (à noter MAINTENANT) : « {secret_clair} ».",
    )
    return redirect('core:partenaire_detail', pk=pk)
