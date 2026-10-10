"""CRUD des catégories de plats (espace admin).

Une catégorie a un nom, une icône (icône Lucide de la liste prédéfinie OU
image téléversée) et une image de présentation affichée en tête de la page
de la catégorie dans l'app mobile.
"""
from django.contrib import messages
from django.db.models import Count, Max
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from core.categories_icones import CLES_ICONES, ICONE_PAR_DEFAUT, ICONES
from core.models import AuditLog, Categorie
from .dashboard import admin_required


def _journal(request, action, cat_id, nom):
    AuditLog.objects.create(
        user=request.user, action=action,
        model_name='Categorie', object_id=str(cat_id),
        description={'nom': nom},
        ip_address=request.META.get('REMOTE_ADDR'),
    )


@admin_required
def categorie_list(request):
    categories = Categorie.objects.annotate(nb_plats=Count('plat', distinct=True)).order_by('ordre', 'id')
    return render(request, 'admin_panel/categories/list.html', {
        'categories': categories,
        'active_page': 'categories',
    })


@admin_required
def categorie_form(request, pk=None):
    categorie = get_object_or_404(Categorie, pk=pk) if pk else None

    if request.method == 'POST':
        nom = request.POST.get('nom', '').strip()[:100]
        icone_type = 'image' if request.POST.get('icone_type') == 'image' else 'icone'
        icone = request.POST.get('icone', '')
        a_deja_image = bool(categorie and categorie.icone_image)
        doublon = Categorie.objects.filter(nom__iexact=nom).exclude(pk=pk).exists()

        if not nom:
            messages.error(request, 'Le nom de la catégorie est obligatoire.')
        elif doublon:
            messages.error(request, f'Une catégorie « {nom} » existe déjà.')
        elif icone_type == 'image' and 'icone_image' not in request.FILES and not a_deja_image:
            messages.error(request, "Choisissez une image pour l'icône, ou sélectionnez une icône de la liste.")
        else:
            if categorie is None:
                ordre_max = Categorie.objects.aggregate(m=Max('ordre'))['m']
                categorie = Categorie(ordre=0 if ordre_max is None else ordre_max + 1)
            categorie.nom = nom
            categorie.description = request.POST.get('description', '').strip()
            categorie.icone_type = icone_type
            categorie.icone = icone if icone in CLES_ICONES else (categorie.icone or ICONE_PAR_DEFAUT)
            if 'icone_image' in request.FILES:
                categorie.icone_image = request.FILES['icone_image']
            if 'image_presentation' in request.FILES:
                categorie.image_presentation = request.FILES['image_presentation']
            elif request.POST.get('retirer_presentation') == 'on':
                categorie.image_presentation = None
            categorie.is_active = request.POST.get('is_active') == 'on'
            categorie.save()
            _journal(request, 'EDIT_CATEGORIE' if pk else 'CREATE_CATEGORIE', categorie.pk, categorie.nom)
            messages.success(request, f'Catégorie « {categorie.nom} » enregistrée.')
            return redirect('core:categorie_list')

    return render(request, 'admin_panel/categories/form.html', {
        'categorie': categorie,
        'icones': ICONES,
        'icone_choisie': (categorie.icone if categorie and categorie.icone in CLES_ICONES else ICONE_PAR_DEFAUT),
        'active_page': 'categories',
    })


@admin_required
@require_POST
def categorie_delete(request, pk):
    categorie = get_object_or_404(Categorie, pk=pk)
    nom = categorie.nom
    nb = categorie.plat_set.count()
    categorie.delete()  # les plats liés passent « sans catégorie » (SET_NULL)
    _journal(request, 'DELETE_CATEGORIE', pk, nom)
    suite = f' {nb} plat{"s" if nb > 1 else ""} sont désormais sans catégorie.' if nb else ''
    messages.success(request, f'Catégorie « {nom} » supprimée.{suite}')
    return redirect('core:categorie_list')


@admin_required
@require_POST
def categorie_toggle(request, pk):
    categorie = get_object_or_404(Categorie, pk=pk)
    categorie.is_active = not categorie.is_active
    categorie.save(update_fields=['is_active', 'updated_at'])
    messages.success(request, f'Catégorie « {categorie.nom} » {"affichée" if categorie.is_active else "masquée"} dans l\'app.')
    return redirect('core:categorie_list')


@admin_required
@require_POST
def categorie_move(request, pk, direction):
    categorie = get_object_or_404(Categorie, pk=pk)
    if direction == 'up':
        voisine = Categorie.objects.filter(ordre__lt=categorie.ordre).order_by('-ordre', '-id').first()
    else:
        voisine = Categorie.objects.filter(ordre__gt=categorie.ordre).order_by('ordre', 'id').first()
    if voisine:
        categorie.ordre, voisine.ordre = voisine.ordre, categorie.ordre
        categorie.save(update_fields=['ordre', 'updated_at'])
        voisine.save(update_fields=['ordre', 'updated_at'])
    return redirect('core:categorie_list')
