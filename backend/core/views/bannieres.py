from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from core.models import Banniere, Plat, AuditLog
from .dashboard import admin_required


@admin_required
def banniere_list(request):
    bannieres = Banniere.objects.select_related('plat').order_by('ordre', 'id')
    return render(request, 'admin_panel/bannieres/list.html', {
        'bannieres': bannieres,
        'active_page': 'bannieres',
    })


def _appliquer_champs(banniere, donnees, fichiers):
    banniere.nom_interne = donnees.get('nom_interne', '').strip() or 'Bannière sans nom'
    banniere.badge = donnees.get('badge', '').strip()
    banniere.titre = donnees.get('titre', '').strip()
    banniere.sous_titre = donnees.get('sous_titre', '').strip()
    banniere.texte_couleur = donnees.get('texte_couleur') or banniere.texte_couleur

    plat_id = donnees.get('plat')
    banniere.plat = Plat.objects.filter(pk=plat_id).first() if plat_id else None
    banniere.bouton_texte_couleur = donnees.get('bouton_texte_couleur') or banniere.bouton_texte_couleur
    banniere.bouton_fond_couleur = donnees.get('bouton_fond_couleur') or banniere.bouton_fond_couleur

    banniere.fond_type = donnees.get('fond_type', 'image')
    banniere.fond_couleur = donnees.get('fond_couleur') or banniere.fond_couleur
    banniere.fond_degrade_debut = donnees.get('fond_degrade_debut') or banniere.fond_degrade_debut
    banniere.fond_degrade_fin = donnees.get('fond_degrade_fin') or banniere.fond_degrade_fin
    if 'fond_image' in fichiers:
        banniere.fond_image = fichiers['fond_image']
    if 'image_droite' in fichiers:
        banniere.image_droite = fichiers['image_droite']

    banniere.is_active = donnees.get('is_active') == 'on'
    return banniere


@admin_required
def banniere_form(request, pk=None):
    banniere = get_object_or_404(Banniere, pk=pk) if pk else None

    if request.method == 'POST':
        titre = request.POST.get('titre', '').strip()
        fond_type = request.POST.get('fond_type', 'image')
        manque_image_fond = fond_type == 'image' and 'fond_image' not in request.FILES and not (banniere and banniere.fond_image)
        manque_image_droite = 'image_droite' not in request.FILES and not (banniere and banniere.image_droite)

        if not titre:
            messages.error(request, 'Le texte de la bannière est obligatoire.')
        elif manque_image_fond:
            messages.error(request, "Choisissez une image de fond, ou changez le type de fond.")
        elif manque_image_droite:
            messages.error(request, "L'image de droite est obligatoire.")
        else:
            if banniere is None:
                banniere = Banniere(ordre=(Banniere.objects.count()))
            banniere = _appliquer_champs(banniere, request.POST, request.FILES)
            banniere.save()
            AuditLog.objects.create(
                user=request.user,
                action='EDIT_BANNIERE' if pk else 'CREATE_BANNIERE',
                model_name='Banniere', object_id=str(banniere.pk),
                description={'nom_interne': banniere.nom_interne},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            messages.success(request, f'Bannière « {banniere.nom_interne} » enregistrée.')
            return redirect('core:banniere_list')

    return render(request, 'admin_panel/bannieres/form.html', {
        'banniere': banniere,
        'plats': Plat.objects.select_related('restaurant').order_by('nom'),
        'active_page': 'bannieres',
    })


@admin_required
def banniere_delete(request, pk):
    banniere = get_object_or_404(Banniere, pk=pk)
    nom = banniere.nom_interne
    banniere.delete()
    AuditLog.objects.create(
        user=request.user, action='DELETE_BANNIERE',
        model_name='Banniere', object_id=str(pk),
        description={'nom_interne': nom},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    messages.success(request, f'Bannière « {nom} » supprimée.')
    return redirect('core:banniere_list')


@admin_required
def banniere_toggle(request, pk):
    banniere = get_object_or_404(Banniere, pk=pk)
    banniere.is_active = not banniere.is_active
    banniere.save(update_fields=['is_active', 'updated_at'])
    messages.success(request, f'Bannière {"activée" if banniere.is_active else "désactivée"}.')
    return redirect('core:banniere_list')


@admin_required
def banniere_move(request, pk, direction):
    banniere = get_object_or_404(Banniere, pk=pk)
    if direction == 'up':
        voisine = Banniere.objects.filter(ordre__lt=banniere.ordre).order_by('-ordre', '-id').first()
    else:
        voisine = Banniere.objects.filter(ordre__gt=banniere.ordre).order_by('ordre', 'id').first()

    if voisine:
        banniere.ordre, voisine.ordre = voisine.ordre, banniere.ordre
        banniere.save(update_fields=['ordre', 'updated_at'])
        voisine.save(update_fields=['ordre', 'updated_at'])

    return redirect('core:banniere_list')
