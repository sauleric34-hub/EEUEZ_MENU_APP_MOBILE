# ═══════════════════════════════════════════════════════════
#  Workspace Livreur (web) — missions attribuées, démarrage
#  de livraison (suivi client), historique et gains.
# ═══════════════════════════════════════════════════════════

import json
from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone

from core.models import Livraison, AuditLog


def livreur_required(view):
    @wraps(view)
    @login_required(login_url='core:login')
    def wrapper(request, *args, **kwargs):
        if request.user.role != 'livreur':
            messages.error(request, 'Accès réservé aux livreurs.')
            return redirect('core:login')
        return view(request, *args, **kwargs)
    return wrapper


ACTIFS = ['assignee', 'en_collecte', 'en_livraison']


# ─── DASHBOARD ───────────────────────────────────────────────
@livreur_required
def dashboard(request):
    livreur = request.user
    qs = Livraison.objects.filter(livreur=livreur).select_related(
        'commande', 'commande__restaurant', 'commande__client',
    ).prefetch_related('commande__lignes__plat')

    actives = qs.filter(statut__in=ACTIFS).order_by('created_at')
    historique = qs.filter(statut='livree').order_by('-delivered_at')[:15]

    today = timezone.now().date()
    livrees_jour = qs.filter(statut='livree', delivered_at__date=today).count()
    gains_jour = 0
    for liv in qs.filter(statut='livree', delivered_at__date=today).select_related('commande__restaurant'):
        if liv.commande and liv.commande.restaurant:
            gains_jour += float(liv.commande.restaurant.frais_livraison) * 0.7

    return render(request, 'livreur/dashboard.html', {
        'livreur': livreur,
        'actives': actives,
        'historique': historique,
        'nb_actives': actives.count(),
        'livrees_jour': livrees_jour,
        'gains_jour': int(gains_jour),
        'gain_total': int(livreur.gain_total),
        'nb_total': livreur.nombre_livraisons,
        'resto_attache': livreur.restaurant_attache,
        'active_page': 'dashboard',
    })


# ─── CARTE DES MISSIONS ──────────────────────────────────────
@livreur_required
def carte(request):
    """Carte des livraisons actives : point de collecte (restaurant) + destination client."""
    livreur = request.user
    actives = Livraison.objects.filter(livreur=livreur, statut__in=ACTIFS).select_related(
        'commande', 'commande__restaurant', 'commande__client',
    )

    missions = []
    for liv in actives:
        c = liv.commande
        if not c:
            continue
        r = c.restaurant
        missions.append({
            'id': c.pk,
            'statut': liv.statut,
            'statut_label': liv.get_statut_display(),
            'restaurant': {
                'nom': r.nom if r else '—',
                'adresse': r.adresse if r else '',
                'lat': float(r.latitude) if r and r.latitude is not None else None,
                'lon': float(r.longitude) if r and r.longitude is not None else None,
            },
            'client': {
                'nom': c.client.get_full_name() or c.client.username if c.client else '—',
                'telephone': c.client.telephone if c.client else '',
                'adresse': c.adresse_livraison,
                'lat': float(c.latitude_livraison) if c.latitude_livraison is not None else None,
                'lon': float(c.longitude_livraison) if c.longitude_livraison is not None else None,
            },
            'montant': int(c.montant_total),
        })

    return render(request, 'livreur/carte.html', {
        'livreur': livreur,
        'missions_json': json.dumps(missions),
        'nb_missions': len(missions),
        'resto_attache': livreur.restaurant_attache,
        'active_page': 'carte',
    })


# ─── ACTIONS SUR UNE LIVRAISON ───────────────────────────────
@livreur_required
def livraison_action(request, pk):
    livraison = get_object_or_404(
        Livraison.objects.select_related('commande', 'commande__restaurant'),
        pk=pk, livreur=request.user,
    )
    commande = livraison.commande
    action = request.POST.get('action')

    if action == 'demarrer' and livraison.statut == 'assignee':
        # Départ vers le restaurant pour récupérer la commande
        livraison.statut = 'en_collecte'
        messages.success(request, f'Mission #{commande.pk} démarrée — direction le restaurant.')
    elif action == 'collecte' and livraison.statut == 'en_collecte':
        # Commande récupérée → en route vers le client (suivi visible dans l'app).
        # On génère le code de confirmation que le client scannera/saisira à la réception.
        livraison.statut = 'en_livraison'
        if not livraison.code_confirmation:
            livraison.code_confirmation = Livraison.generer_code()
        commande.statut = 'en_livraison'
        commande.save(update_fields=['statut', 'updated_at'])
        messages.success(request, f'Commande #{commande.pk} récupérée — le client suit votre trajet. '
                                  f'Faites-lui scanner votre QR ou saisir le code à l\'arrivée.')
    else:
        messages.error(request, 'Action impossible pour ce statut.')
        return redirect('core:livreur_dashboard')

    livraison.save()
    AuditLog.objects.create(
        user=request.user, action=f'LIVRAISON_{(action or "?").upper()}',
        model_name='Livraison', object_id=str(livraison.pk),
        description={'statut': livraison.statut},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return redirect('core:livreur_dashboard')
