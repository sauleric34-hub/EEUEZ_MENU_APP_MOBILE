from django.shortcuts import render, redirect
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta
import json
from core.models import User, RestaurantProfile, Commande, Livraison, Avis, Transaction, AuditLog


def admin_required(view_func):
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated or request.user.role != 'admin':
            return redirect('core:login')
        return view_func(request, *args, **kwargs)
    return wrapper


@admin_required
def dashboard_view(request):
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # KPIs
    total_restaurants = RestaurantProfile.objects.count()
    restaurants_actifs = RestaurantProfile.objects.filter(is_verified=True, user__is_active=True).count()
    restaurants_en_attente = RestaurantProfile.objects.filter(is_verified=False).count()
    total_clients = User.objects.filter(role='client').count()
    total_livreurs = User.objects.filter(role='livreur').count()
    commandes_aujourd_hui = Commande.objects.filter(created_at__gte=today_start).count()
    commandes_ce_mois = Commande.objects.filter(created_at__gte=month_start).count()

    ca_total = Commande.objects.filter(statut='livree').aggregate(s=Sum('montant_total'))['s'] or 0
    commissions_total = Commande.objects.filter(statut='livree').aggregate(s=Sum('commission_eeuez'))['s'] or 0
    note_globale = Avis.objects.aggregate(avg=Avg('note'))['avg'] or 0
    livraisons_en_cours = Livraison.objects.filter(statut__in=['assignee', 'en_collecte', 'en_livraison']).count()

    # Line chart: CA & commissions 12 derniers mois
    months_labels = []
    ca_data = []
    commission_data = []
    for i in range(11, -1, -1):
        d = now - timedelta(days=30 * i)
        label = d.strftime('%b %Y')
        ms = d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        me = (ms + timedelta(days=32)).replace(day=1)
        qs = Commande.objects.filter(statut='livree', created_at__gte=ms, created_at__lt=me)
        months_labels.append(label)
        ca_data.append(float(qs.aggregate(s=Sum('montant_total'))['s'] or 0))
        commission_data.append(float(qs.aggregate(s=Sum('commission_eeuez'))['s'] or 0))

    # Bar chart: commandes 7 derniers jours
    days_labels = []
    commandes_data = []
    for i in range(6, -1, -1):
        d = now - timedelta(days=i)
        ds = d.replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        days_labels.append(d.strftime('%a %d'))
        commandes_data.append(Commande.objects.filter(created_at__gte=ds, created_at__lt=de).count())

    # Doughnut: statuts commandes
    statuts_data = {}
    for s, label in Commande.STATUT_CHOICES:
        statuts_data[label] = Commande.objects.filter(statut=s).count()

    # Stacked bar: paiements par mode par semaine (4 dernières semaines)
    paiement_labels = []
    paiement_mtn, paiement_orange, paiement_carte, paiement_especes = [], [], [], []
    for i in range(3, -1, -1):
        ws = now - timedelta(weeks=i + 1)
        we = now - timedelta(weeks=i)
        paiement_labels.append(f"S-{i + 1}")
        qs_w = Transaction.objects.filter(type='paiement_client', created_at__gte=ws, created_at__lt=we)
        paiement_mtn.append(float(qs_w.filter(mode_paiement='mtn_money').aggregate(s=Sum('montant'))['s'] or 0))
        paiement_orange.append(float(qs_w.filter(mode_paiement='orange_money').aggregate(s=Sum('montant'))['s'] or 0))
        paiement_carte.append(float(qs_w.filter(mode_paiement='carte').aggregate(s=Sum('montant'))['s'] or 0))
        paiement_especes.append(float(qs_w.filter(mode_paiement='especes').aggregate(s=Sum('montant'))['s'] or 0))

    # Top 5 restaurants
    top_restaurants = RestaurantProfile.objects.annotate(
        nb_commandes=Count('commandes'),
        ca=Sum('commandes__montant_total')
    ).order_by('-nb_commandes')[:5]

    # Radar: top 5 perf
    radar_labels = [r.nom[:15] for r in top_restaurants]
    radar_notes = [float(r.note_moyenne) for r in top_restaurants]
    radar_volumes = [r.nb_commandes or 0 for r in top_restaurants]
    max_vol = max(radar_volumes) if radar_volumes else 1
    radar_volumes_norm = [round(v / max_vol * 5, 1) for v in radar_volumes]

    # Feed commandes récentes
    commandes_recentes = Commande.objects.select_related('client', 'restaurant').order_by('-created_at')[:10]

    # Alertes
    alertes = []
    inactifs = RestaurantProfile.objects.filter(
        is_verified=True,
        commandes__created_at__lt=now - timedelta(days=7)
    ).distinct()[:3]
    for r in inactifs:
        alertes.append({'type': 'warning', 'msg': f"{r.nom} — Aucune commande depuis 7 jours"})

    avis_negatifs = Avis.objects.filter(note__lte=2, is_visible=True).count()
    if avis_negatifs:
        alertes.append({'type': 'danger', 'msg': f"{avis_negatifs} avis négatifs non traités"})

    context = {
        'total_restaurants': total_restaurants,
        'restaurants_actifs': restaurants_actifs,
        'restaurants_en_attente': restaurants_en_attente,
        'total_clients': total_clients,
        'total_livreurs': total_livreurs,
        'commandes_aujourd_hui': commandes_aujourd_hui,
        'commandes_ce_mois': commandes_ce_mois,
        'ca_total': ca_total,
        'commissions_total': commissions_total,
        'note_globale': round(float(note_globale), 1),
        'livraisons_en_cours': livraisons_en_cours,
        # Charts JSON
        'months_labels': json.dumps(months_labels),
        'ca_data': json.dumps(ca_data),
        'commission_data': json.dumps(commission_data),
        'days_labels': json.dumps(days_labels),
        'commandes_data': json.dumps(commandes_data),
        'statuts_labels': json.dumps(list(statuts_data.keys())),
        'statuts_values': json.dumps(list(statuts_data.values())),
        'paiement_labels': json.dumps(paiement_labels),
        'paiement_mtn': json.dumps(paiement_mtn),
        'paiement_orange': json.dumps(paiement_orange),
        'paiement_carte': json.dumps(paiement_carte),
        'paiement_especes': json.dumps(paiement_especes),
        'radar_labels': json.dumps(radar_labels),
        'radar_notes': json.dumps(radar_notes),
        'radar_volumes_norm': json.dumps(radar_volumes_norm),
        'top_restaurants': top_restaurants,
        'commandes_recentes': commandes_recentes,
        'alertes': alertes,
        'active_page': 'dashboard',
    }
    return render(request, 'admin_panel/dashboard.html', context)
