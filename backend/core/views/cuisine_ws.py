"""Écran cuisine (KDS) de l'espace restaurant web.

Conçu pour une TV ou une tablette fixée en cuisine : plein écran, lisible de
loin, mis à jour toutes les quelques secondes par un flux JSON (pas besoin de
WebSocket), avec sonneries et animations côté navigateur. Les cuisiniers font
avancer les commandes d'un tap : accepter → en préparation → prête.
"""
from datetime import timedelta

from django.db.models import Prefetch
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.models import AuditLog, Commande, LigneCommande
from .resto_ws import resto_required

STATUTS_CUISINE = ['en_attente', 'acceptee', 'en_preparation', 'prete']
# Au-delà, une commande « oubliée » (jamais clôturée) n'a plus sa place sur
# l'écran cuisine : elle reste gérable depuis la page Commandes.
FENETRE_HEURES = 24
STATUTS_SERVIS = ['en_livraison', 'livree', 'recuperee']

# Transitions autorisées depuis l'écran cuisine (le refus, l'assignation d'un
# livreur et le code de retrait restent sur la page Commandes).
ACTIONS = {
    'accepter': (('en_attente',), 'acceptee'),
    'preparation': (('acceptee',), 'en_preparation'),
    'prete': (('acceptee', 'en_preparation'), 'prete'),
}


@resto_required
def cuisine(request):
    return render(request, 'resto/cuisine.html', {'resto': request.resto})


def _image(request, plat):
    if not plat or not plat.image:
        return None
    try:
        return request.build_absolute_uri(plat.url_affichage)
    except Exception:
        return None


def _commande_json(request, c):
    client = c.client
    lignes = []
    for l in c.lignes.all():
        lignes.append({
            'quantite': l.quantite,
            'nom': l.plat.nom if l.plat else 'Plat supprimé',
            'image': _image(request, l.plat),
            'choix': [f'{ch.groupe_nom} : {ch.option_nom}' for ch in l.choix.all()],
        })
    return {
        'id': c.pk,
        'statut': c.statut,
        'cree_le': c.created_at.isoformat(),
        'emporter': c.emporter,
        'client': (client.first_name or client.username) if client else 'Client',
        'allergies': (client.allergies or '').strip() if client else '',
        'notes': (c.notes or '').strip(),
        'livreur_assigne': hasattr(c, 'livraison') and c.livraison.livreur_id is not None,
        'lignes': lignes,
    }


@resto_required
def cuisine_donnees(request):
    """GET /admin-panel/resto/cuisine/donnees/ — commandes actives (payées)."""
    resto = request.resto
    lignes = LigneCommande.objects.select_related('plat').prefetch_related('choix')
    actives = (
        resto.commandes.filter(
            paiement_confirme=True, statut__in=STATUTS_CUISINE,
            created_at__gte=timezone.now() - timedelta(hours=FENETRE_HEURES),
        )
        .select_related('client', 'livraison')
        .prefetch_related(Prefetch('lignes', queryset=lignes))
        .order_by('created_at')
    )
    debut_jour = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
    servies = resto.commandes.filter(
        paiement_confirme=True, statut__in=STATUTS_SERVIS, created_at__gte=debut_jour,
    ).count()
    return JsonResponse({
        'maintenant': timezone.now().isoformat(),
        'commandes': [_commande_json(request, c) for c in actives],
        'servies_aujourdhui': servies,
    })


@resto_required
@require_POST
def cuisine_action(request, pk):
    """POST /admin-panel/resto/cuisine/<pk>/action/  action=accepter|preparation|prete"""
    commande = get_object_or_404(Commande, pk=pk, restaurant=request.resto, paiement_confirme=True)
    action = request.POST.get('action')
    regle = ACTIONS.get(action)
    if not regle or commande.statut not in regle[0]:
        return JsonResponse({'ok': False, 'error': 'Action impossible pour ce statut.', 'statut': commande.statut}, status=409)
    commande.statut = regle[1]
    commande.save()  # même chemin que la page Commandes (notifications client…)
    AuditLog.objects.create(
        user=request.user, action=f'CUISINE_{action.upper()}',
        model_name='Commande', object_id=str(commande.pk),
        description={'statut': commande.statut},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return JsonResponse({'ok': True, 'statut': commande.statut})
