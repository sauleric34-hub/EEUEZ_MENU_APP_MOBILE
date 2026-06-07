from django.shortcuts import render
from django.db.models import Avg, Count
from core.models import Livraison, Commande
from .dashboard import admin_required


@admin_required
def deliveries_view(request):
    livraisons_actives = Livraison.objects.filter(
        statut__in=['assignee', 'en_collecte', 'en_livraison']
    ).select_related('commande__restaurant', 'commande__client', 'livreur').order_by('-created_at')

    livraisons_recentes = Livraison.objects.filter(
        statut='livree'
    ).select_related('commande__restaurant', 'livreur').order_by('-delivered_at')[:20]

    stats = {
        'total': Livraison.objects.count(),
        'livrees': Livraison.objects.filter(statut='livree').count(),
        'en_cours': Livraison.objects.filter(statut__in=['assignee', 'en_collecte', 'en_livraison']).count(),
        'echecs': Livraison.objects.filter(statut='echec').count(),
    }
    taux_succes = round(stats['livrees'] / stats['total'] * 100, 1) if stats['total'] else 0

    return render(request, 'admin_panel/deliveries/index.html', {
        'livraisons_actives': livraisons_actives,
        'livraisons_recentes': livraisons_recentes,
        'stats': stats,
        'taux_succes': taux_succes,
        'active_page': 'deliveries',
    })
