from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q, Count, Avg
from django.core.paginator import Paginator
import json
from core.models import Avis, AuditLog
from .dashboard import admin_required


@admin_required
def reviews_view(request):
    qs = Avis.objects.select_related('client', 'restaurant', 'commande')
    note_filter = request.GET.get('note', '')
    restaurant_id = request.GET.get('restaurant', '')
    visibilite = request.GET.get('visible', '')

    if note_filter:
        qs = qs.filter(note=note_filter)
    if restaurant_id:
        qs = qs.filter(restaurant_id=restaurant_id)
    if visibilite == '1':
        qs = qs.filter(is_visible=True)
    elif visibilite == '0':
        qs = qs.filter(is_visible=False)

    paginator = Paginator(qs.order_by('-created_at'), 20)
    page = paginator.get_page(request.GET.get('page', 1))

    # Stats
    note_avg = Avis.objects.aggregate(avg=Avg('note'))['avg'] or 0
    distrib = [Avis.objects.filter(note=i).count() for i in range(1, 6)]

    return render(request, 'admin_panel/reviews/index.html', {
        'page_obj': page,
        'note_filter': note_filter,
        'note_avg': round(float(note_avg), 1),
        'distrib': json.dumps(distrib),
        'active_page': 'reviews',
    })


@admin_required
def review_toggle(request, pk):
    avis = get_object_or_404(Avis, pk=pk)
    avis.is_visible = not avis.is_visible
    avis.save()
    AuditLog.objects.create(
        user=request.user, action='TOGGLE_REVIEW',
        model_name='Avis', object_id=str(pk),
        description={'visible': avis.is_visible},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    status = 'affiché' if avis.is_visible else 'masqué'
    messages.success(request, f'Avis {status}.')
    return redirect('core:reviews')
