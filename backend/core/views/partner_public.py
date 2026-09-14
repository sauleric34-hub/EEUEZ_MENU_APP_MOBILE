# ═══════════════════════════════════════════════════════════
#  Formulaire web public de candidature à l'API Partenaires — porte d'entrée
#  humaine, équivalente à POST /api/partners/v1/apply (core/partner_views.py)
#  mais pour une entreprise qui candidate depuis son navigateur plutôt que
#  via une intégration technique. Aucun compte, aucune clé requise.
# ═══════════════════════════════════════════════════════════

from django.contrib import messages
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction
from django.shortcuts import render

from core.models import DocumentKYB, Partenaire
from core.models_partenaire import PLANS, valider_document_kyb
from core.partner_emails import email_candidature_recue

CHAMPS_DOCUMENTS = {
    'fichier_rccm': DocumentKYB.TYPE_RCCM,
    'fichier_niu': DocumentKYB.TYPE_NIU,
    'fichier_piece_identite': DocumentKYB.TYPE_PIECE_IDENTITE,
    'fichier_autre': DocumentKYB.TYPE_AUTRE,
}

LIMITE_PAR_HEURE = 5


def partenaire_candidature(request):
    if request.method != 'POST':
        return render(request, 'partenaires/candidature.html', {})

    cache_key = f"partenaire-candidature:{request.META.get('REMOTE_ADDR', 'inconnue')}"
    tentatives = cache.get(cache_key, 0)
    if tentatives >= LIMITE_PAR_HEURE:
        messages.error(request, "Trop de candidatures envoyées récemment depuis cette adresse. Réessayez plus tard.")
        return render(request, 'partenaires/candidature.html', {'donnees': request.POST})

    donnees = {
        'nom_commercial': request.POST.get('nom_commercial', '').strip(),
        'raison_sociale': request.POST.get('raison_sociale', '').strip(),
        'pays': request.POST.get('pays', '').strip() or 'Cameroun',
        'numero_rccm': request.POST.get('numero_rccm', '').strip(),
        'numero_contribuable': request.POST.get('numero_contribuable', '').strip(),
        'secteur': request.POST.get('secteur', '').strip(),
        'site_web': request.POST.get('site_web', '').strip(),
        'app_url': request.POST.get('app_url', '').strip(),
        'contact_nom': request.POST.get('contact_nom', '').strip(),
        'contact_email': request.POST.get('contact_email', '').strip(),
        'contact_telephone': request.POST.get('contact_telephone', '').strip(),
        'adresse': request.POST.get('adresse', '').strip(),
        'description_cas_usage': request.POST.get('description_cas_usage', '').strip(),
    }

    erreurs = []
    for champ in ('nom_commercial', 'contact_nom', 'contact_email', 'description_cas_usage'):
        if not donnees[champ]:
            erreurs.append("Merci de compléter tous les champs obligatoires (*).")
            break

    fichiers_valides = {}
    for champ, type_document in CHAMPS_DOCUMENTS.items():
        fichier = request.FILES.get(champ)
        if fichier:
            try:
                valider_document_kyb(fichier)
            except ValidationError as e:
                erreurs.append(e.messages[0])
            else:
                fichiers_valides[type_document] = fichier

    cache.set(cache_key, tentatives + 1, timeout=3600)

    if erreurs:
        for e in erreurs:
            messages.error(request, e)
        return render(request, 'partenaires/candidature.html', {'donnees': donnees})

    with transaction.atomic():
        partenaire = Partenaire.objects.create(**donnees)
        for type_document, fichier in fichiers_valides.items():
            DocumentKYB.objects.create(partenaire=partenaire, type_document=type_document, fichier=fichier)

    email_candidature_recue(partenaire)

    return render(request, 'partenaires/candidature.html', {'succes': True})


def documentation(request):
    """Doc développeur publique de l'API Partenaires — auth HMAC, endpoints,
    webhooks, plans. Pas de compte/clé requis pour la consulter."""
    return render(request, 'partenaires/documentation.html', {'plans': PLANS})
