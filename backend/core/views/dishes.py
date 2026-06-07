from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q, Count
from django.core.paginator import Paginator
from core.models import Plat, Categorie, AuditLog
from .dashboard import admin_required


@admin_required
def dish_list(request):
    qs = Plat.objects.select_related('restaurant', 'categorie')
    q = request.GET.get('q', '')
    restaurant_id = request.GET.get('restaurant', '')
    categorie_id = request.GET.get('categorie', '')
    dispo = request.GET.get('dispo', '')

    if q:
        qs = qs.filter(Q(nom__icontains=q) | Q(restaurant__nom__icontains=q))
    if restaurant_id:
        qs = qs.filter(restaurant_id=restaurant_id)
    if categorie_id:
        qs = qs.filter(categorie_id=categorie_id)
    if dispo == '1':
        qs = qs.filter(is_available=True)
    elif dispo == '0':
        qs = qs.filter(is_available=False)

    paginator = Paginator(qs.order_by('-created_at'), 20)
    page = paginator.get_page(request.GET.get('page', 1))
    categories = Categorie.objects.all()

    return render(request, 'admin_panel/dishes/list.html', {
        'page_obj': page,
        'q': q,
        'categories': categories,
        'active_page': 'dishes',
    })


@admin_required
def dish_detail(request, pk):
    plat = get_object_or_404(Plat.objects.select_related('restaurant', 'categorie'), pk=pk)
    nb_commandes = plat.lignecommande_set.count()
    return render(request, 'admin_panel/dishes/detail.html', {
        'plat': plat,
        'nb_commandes': nb_commandes,
        'active_page': 'dishes',
    })


@admin_required
def dish_toggle(request, pk):
    plat = get_object_or_404(Plat, pk=pk)
    plat.is_visible = not plat.is_visible
    plat.save()
    AuditLog.objects.create(
        user=request.user, action='TOGGLE_DISH_VISIBILITY',
        model_name='Plat', object_id=str(pk),
        description={'nom': plat.nom, 'visible': plat.is_visible},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    status = 'visible' if plat.is_visible else 'masqué'
    messages.success(request, f'Plat {status}.')
    return redirect('core:dish_detail', pk=pk)
