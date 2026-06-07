import csv
from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.db.models import Sum, Count
from django.core.paginator import Paginator
from django.utils import timezone
from datetime import timedelta
import json
from core.models import Commande, Transaction, RestaurantProfile
from .dashboard import admin_required


@admin_required
def finances_view(request):
    ca_total = Commande.objects.filter(statut='livree').aggregate(s=Sum('montant_total'))['s'] or 0
    commissions_total = Commande.objects.filter(statut='livree').aggregate(s=Sum('commission_eeuez'))['s'] or 0
    reversements_total = Commande.objects.filter(statut='livree').aggregate(s=Sum('montant_restaurant'))['s'] or 0

    restaurants = RestaurantProfile.objects.filter(
        commandes__statut='livree'
    ).annotate(
        ca=Sum('commandes__montant_total'),
        commissions=Sum('commandes__commission_eeuez'),
        reversements=Sum('commandes__montant_restaurant'),
        nb_commandes=Count('commandes'),
    ).order_by('-ca')

    # Line chart commissions cumulées 12 mois
    now = timezone.now()
    months_labels = []
    comm_data = []
    for i in range(11, -1, -1):
        d = now - timedelta(days=30 * i)
        ms = d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        me = (ms + timedelta(days=32)).replace(day=1)
        months_labels.append(d.strftime('%b %Y'))
        val = Commande.objects.filter(statut='livree', created_at__gte=ms, created_at__lt=me).aggregate(s=Sum('commission_eeuez'))['s'] or 0
        comm_data.append(float(val))

    return render(request, 'admin_panel/finances/index.html', {
        'ca_total': ca_total,
        'commissions_total': commissions_total,
        'reversements_total': reversements_total,
        'restaurants': restaurants,
        'months_labels': json.dumps(months_labels),
        'comm_data': json.dumps(comm_data),
        'restaurant_labels': json.dumps([r.nom[:20] for r in restaurants]),
        'restaurant_ca': json.dumps([float(r.ca or 0) for r in restaurants]),
        'active_page': 'finances',
    })


@admin_required
def transaction_list(request):
    qs = Transaction.objects.select_related('commande__restaurant', 'commande__client')
    type_filter = request.GET.get('type', '')
    statut_filter = request.GET.get('statut', '')
    if type_filter:
        qs = qs.filter(type=type_filter)
    if statut_filter:
        qs = qs.filter(statut=statut_filter)

    paginator = Paginator(qs.order_by('-created_at'), 25)
    page = paginator.get_page(request.GET.get('page', 1))

    return render(request, 'admin_panel/finances/transactions.html', {
        'page_obj': page,
        'type_filter': type_filter,
        'statut_filter': statut_filter,
        'active_page': 'finances',
    })


@admin_required
def export_csv(request):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="finances_eeuez.csv"'
    response.write('﻿')
    writer = csv.writer(response)
    writer.writerow(['Restaurant', 'CA (FCFA)', 'Commission (%)', 'Commission (FCFA)', 'Reversement (FCFA)', 'Nb Commandes'])
    for r in RestaurantProfile.objects.all():
        ca = float(r.chiffre_affaires)
        comm = ca * float(r.commission_rate) / 100
        rev = ca - comm
        writer.writerow([r.nom, int(ca), float(r.commission_rate), int(comm), int(rev), r.total_commandes])
    return response
