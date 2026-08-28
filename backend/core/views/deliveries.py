from django.contrib import messages
from django.contrib.auth import get_user_model
from django.shortcuts import render, redirect, get_object_or_404

from core.models import Livraison, Commande, AuditLog
from core.delivery import (
    valider_sans_code, abandonner_livraison, TransitionInvalide,
)
from .dashboard import admin_required

User = get_user_model()

ACTIFS = ['assignee', 'en_collecte', 'en_livraison']


@admin_required
def deliveries_view(request):
    livraisons_actives = Livraison.objects.filter(
        statut__in=ACTIFS
    ).select_related('commande__restaurant', 'commande__client', 'livreur').order_by('-created_at')

    # Courses clôturées sans confirmation client : à valider (débloque le
    # paiement du livreur ET l'argent du restaurant) ou à rejeter.
    a_valider = Livraison.objects.filter(
        statut='livree_sans_code'
    ).select_related('commande__restaurant', 'commande__client', 'livreur').order_by('-delivered_at')

    livraisons_recentes = Livraison.objects.filter(
        statut='livree'
    ).select_related('commande__restaurant', 'livreur').order_by('-delivered_at')[:20]

    livreurs_dispo = User.objects.filter(role='livreur', is_active=True).order_by('username')

    stats = {
        'total': Livraison.objects.count(),
        'livrees': Livraison.objects.filter(statut='livree').count(),
        'en_cours': Livraison.objects.filter(statut__in=ACTIFS).count(),
        'a_valider': a_valider.count(),
        'echecs': Livraison.objects.filter(statut='echec').count(),
    }
    taux_succes = round(stats['livrees'] / stats['total'] * 100, 1) if stats['total'] else 0

    return render(request, 'admin_panel/deliveries/index.html', {
        'livraisons_actives': livraisons_actives,
        'a_valider': a_valider,
        'livraisons_recentes': livraisons_recentes,
        'livreurs_dispo': livreurs_dispo,
        'stats': stats,
        'taux_succes': taux_succes,
        'active_page': 'deliveries',
    })


@admin_required
def delivery_action(request, pk):
    """Intervention admin sur une livraison bloquée ou à valider."""
    if request.method != 'POST':
        return redirect('core:deliveries')

    livraison = get_object_or_404(
        Livraison.objects.select_related('commande', 'livreur'), pk=pk,
    )
    action = request.POST.get('action')
    commande = livraison.commande

    try:
        if action == 'valider_sans_code':
            valider_sans_code(livraison)
            messages.success(request, f'Course #{commande.pk} validée — livreur et restaurant crédités.')
        elif action == 'rejeter_sans_code':
            abandonner_livraison(livraison, 'Rejet admin (course sans code non validée)', auto=False)
            messages.warning(request, f'Course #{commande.pk} rejetée et remise au pool.')
        elif action == 'remettre_pool':
            abandonner_livraison(livraison, request.POST.get('motif', 'Remise au pool par un admin'), auto=False)
            messages.info(request, f'Commande #{commande.pk} remise au pool des livreurs.')
        elif action == 'reassigner':
            nouveau = get_object_or_404(User, pk=request.POST.get('livreur'), role='livreur', is_active=True)
            livraison.livreur = nouveau
            livraison.statut = 'assignee'
            livraison.save(update_fields=['livreur', 'statut'])
            AuditLog.objects.create(
                user=request.user, action='LIVRAISON_REASSIGNEE',
                model_name='Livraison', object_id=str(livraison.pk),
                description={'commande': commande.pk, 'livreur': nouveau.pk},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            messages.success(request, f'Commande #{commande.pk} réassignée à {nouveau.get_full_name() or nouveau.username}.')
        elif action == 'marquer_echec':
            livraison.statut = 'echec'
            livraison.save(update_fields=['statut'])
            if commande:
                commande.statut = 'annulee'
                commande.save(update_fields=['statut', 'updated_at'])
            AuditLog.objects.create(
                user=request.user, action='LIVRAISON_ECHEC',
                model_name='Livraison', object_id=str(livraison.pk),
                description={'commande': commande.pk if commande else None},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            messages.warning(request, f'Livraison #{commande.pk if commande else pk} marquée en échec.')
        else:
            messages.error(request, 'Action inconnue.')
    except TransitionInvalide as e:
        messages.error(request, str(e))

    return redirect('core:deliveries')
