from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q, Sum, Count
from django.core.paginator import Paginator
from core.models import User, AuditLog
from .dashboard import admin_required


@admin_required
def user_list(request):
    qs = User.objects.all()
    q = request.GET.get('q', '')
    role = request.GET.get('role', '')
    statut = request.GET.get('statut', '')

    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
    if role:
        qs = qs.filter(role=role)
    if statut == 'actif':
        qs = qs.filter(is_active=True)
    elif statut == 'inactif':
        qs = qs.filter(is_active=False)

    paginator = Paginator(qs.order_by('-date_joined'), 20)
    page = paginator.get_page(request.GET.get('page', 1))

    return render(request, 'admin_panel/users/list.html', {
        'page_obj': page,
        'q': q,
        'role': role,
        'statut': statut,
        'active_page': 'users',
    })


@admin_required
def user_detail(request, pk):
    user = get_object_or_404(User, pk=pk)
    commandes = user.commandes_client.select_related('restaurant').order_by('-created_at')[:10] if user.role == 'client' else []
    avis = user.avis_client.select_related('restaurant').order_by('-created_at')[:5] if user.role == 'client' else []
    total_depense = user.commandes_client.filter(statut='livree').aggregate(s=Sum('montant_total'))['s'] or 0 if user.role == 'client' else 0

    return render(request, 'admin_panel/users/detail.html', {
        'user_obj': user,
        'commandes': commandes,
        'avis': avis,
        'total_depense': total_depense,
        'active_page': 'users',
    })


@admin_required
def user_toggle(request, pk):
    user = get_object_or_404(User, pk=pk)
    if user == request.user:
        messages.error(request, 'Vous ne pouvez pas vous désactiver vous-même.')
        return redirect('core:user_detail', pk=pk)
    user.is_active = not user.is_active
    user.save()
    action = 'ACTIVATE_USER' if user.is_active else 'SUSPEND_USER'
    AuditLog.objects.create(
        user=request.user, action=action,
        model_name='User', object_id=str(pk),
        description={'username': user.username},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    status = 'activé' if user.is_active else 'suspendu'
    messages.success(request, f'Utilisateur {status}.')
    return redirect('core:user_detail', pk=pk)


@admin_required
def user_delete(request, pk):
    user = get_object_or_404(User, pk=pk)
    if user == request.user:
        messages.error(request, 'Impossible de supprimer votre propre compte.')
        return redirect('core:user_detail', pk=pk)
    if request.method == 'POST':
        AuditLog.objects.create(
            user=request.user, action='DELETE_USER',
            model_name='User', object_id=str(pk),
            description={'username': user.username, 'role': user.role},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        user.delete()
        messages.success(request, 'Utilisateur supprimé.')
        return redirect('core:user_list')
    return redirect('core:user_detail', pk=pk)
