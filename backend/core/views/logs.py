import csv
from django.shortcuts import render
from django.http import HttpResponse
from django.db.models import Q
from django.core.paginator import Paginator
from core.models import AuditLog, User
from .dashboard import admin_required


@admin_required
def logs_view(request):
    qs = AuditLog.objects.select_related('user')
    q = request.GET.get('q', '')
    action = request.GET.get('action', '')
    user_id = request.GET.get('user', '')

    if q:
        qs = qs.filter(Q(action__icontains=q) | Q(model_name__icontains=q) | Q(user__username__icontains=q))
    if action:
        qs = qs.filter(action=action)
    if user_id:
        qs = qs.filter(user_id=user_id)

    paginator = Paginator(qs.order_by('-created_at'), 30)
    page = paginator.get_page(request.GET.get('page', 1))
    actions = AuditLog.objects.values_list('action', flat=True).distinct()
    admins = User.objects.filter(role='admin')

    return render(request, 'admin_panel/logs/index.html', {
        'page_obj': page,
        'q': q,
        'action': action,
        'user_id': user_id,
        'actions': actions,
        'admins': admins,
        'active_page': 'logs',
    })


@admin_required
def export_csv(request):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'
    response.write('﻿')
    writer = csv.writer(response)
    writer.writerow(['Date', 'Utilisateur', 'Action', 'Modèle', 'ID Objet', 'IP', 'Détails'])
    for log in AuditLog.objects.select_related('user').order_by('-created_at')[:5000]:
        writer.writerow([
            log.created_at.strftime('%d/%m/%Y %H:%M:%S'),
            log.user.username if log.user else 'Système',
            log.action,
            log.model_name,
            log.object_id,
            log.ip_address or '',
            str(log.description),
        ])
    return response
