# ═══════════════════════════════════════════════════════════
#  Workspace Livreur (web) — missions attribuées, démarrage
#  de livraison (suivi client), historique et gains.
# ═══════════════════════════════════════════════════════════

import json
from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST

from core.models import Livraison, AuditLog, Commande
from core.delivery import (
    est_livreur_independant, prendre_commande_libre, PriseImpossible,
)

# Statuts d'une commande prête à être livrée (offerte au pool libre).
STATUTS_LIBERABLES = ['acceptee', 'en_preparation', 'prete']


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

    # Missions libres : réservées aux livreurs INDÉPENDANTS. Ce sont les
    # commandes qu'un restaurant a confiées au pool et que personne n'a encore
    # prises.
    independant = est_livreur_independant(livreur)
    missions_libres = []
    if independant:
        missions_libres = (
            Commande.objects.filter(
                livraison_libre=True,
                livraison__isnull=True,
                paiement_confirme=True,
                statut__in=STATUTS_LIBERABLES,
            )
            .select_related('restaurant', 'client')
            .order_by('created_at')
        )

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
        'est_independant': independant,
        'missions_libres': missions_libres,
        'active_page': 'dashboard',
    })


# ─── PRENDRE UNE MISSION LIBRE ───────────────────────────────
@require_POST
@livreur_required
def prendre_mission(request, pk):
    """Un livreur indépendant prend une commande en livraison libre."""
    try:
        livraison = prendre_commande_libre(pk, request.user)
    except PriseImpossible as e:
        messages.error(request, str(e))
        return redirect('core:livreur_dashboard')

    AuditLog.objects.create(
        user=request.user, action='MISSION_LIBRE_PRISE',
        model_name='Livraison', object_id=str(livraison.pk),
        description={'commande': livraison.commande_id},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    messages.success(
        request, f'Mission #{livraison.commande_id} prise. Bonne route !'
    )
    return redirect('core:livreur_dashboard')


# ─── CARTE DES MISSIONS ──────────────────────────────────────
@ensure_csrf_cookie
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
            'livraison_id': liv.pk,
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


# ─── POSITION GPS EN DIRECT ───────────────────────────────────
@livreur_required
@require_POST
def position_update(request, pk):
    """Le workspace livreur pousse sa position GPS ici (toutes les quelques
    secondes) pendant une livraison active. Le client la voit bouger sur sa
    carte de suivi. Répond en JSON léger."""
    livraison = get_object_or_404(Livraison, pk=pk, livreur=request.user)
    try:
        lat = float(request.POST.get('lat'))
        lon = float(request.POST.get('lon'))
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Coordonnées invalides'}, status=400)
    # Bornes plausibles (évite d'enregistrer des valeurs aberrantes).
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return JsonResponse({'error': 'Coordonnées hors limites'}, status=400)
    livraison.latitude_actuelle = lat
    livraison.longitude_actuelle = lon
    livraison.save(update_fields=['latitude_actuelle', 'longitude_actuelle'])
    return JsonResponse({'ok': True})


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
