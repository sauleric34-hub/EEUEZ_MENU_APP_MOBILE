from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Q, Sum, Count, Avg, Exists, OuterRef
from django.core.paginator import Paginator
from core.models import RestaurantProfile, User, AuditLog
from core.models_livraison import PalierLivraison
from core.delivery import parser_bareme_livraison, remplacer_bareme_livraison
from .dashboard import admin_required


@admin_required
def restaurant_list(request):
    qs = RestaurantProfile.objects.select_related('user').annotate(
        nb_commandes=Count('commandes'),
        ca=Sum('commandes__montant_total'),
        note_avg=Avg('avis_set__note'),
        a_bareme=Exists(PalierLivraison.objects.filter(restaurant=OuterRef('pk'))),
    )
    q = request.GET.get('q', '')
    statut = request.GET.get('statut', '')
    ville = request.GET.get('ville', '')
    if q:
        qs = qs.filter(Q(nom__icontains=q) | Q(ville__icontains=q) | Q(user__email__icontains=q))
    if statut == 'actif':
        qs = qs.filter(is_verified=True, user__is_active=True)
    elif statut == 'attente':
        qs = qs.filter(is_verified=False)
    elif statut == 'suspendu':
        qs = qs.filter(user__is_active=False)
    if ville:
        qs = qs.filter(ville__icontains=ville)

    paginator = Paginator(qs.order_by('-created_at'), 15)
    page = paginator.get_page(request.GET.get('page', 1))
    villes = RestaurantProfile.objects.values_list('ville', flat=True).distinct()

    return render(request, 'admin_panel/restaurants/list.html', {
        'page_obj': page,
        'q': q,
        'statut': statut,
        'ville': ville,
        'villes': villes,
        'active_page': 'restaurants',
    })


@admin_required
def restaurant_detail(request, pk):
    restaurant = get_object_or_404(RestaurantProfile.objects.select_related('user'), pk=pk)
    commandes = restaurant.commandes.order_by('-created_at')[:10]
    plats = restaurant.plats.all()
    avis = restaurant.avis_set.order_by('-created_at')[:5]
    ca = restaurant.chiffre_affaires
    # Revenu réel de la plateforme = majoration encaissée sur les commandes livrées
    commissions = restaurant.commandes.filter(statut='livree') \
        .aggregate(t=Sum('commission_eeuez'))['t'] or 0

    return render(request, 'admin_panel/restaurants/detail.html', {
        'restaurant': restaurant,
        'commandes': commandes,
        'plats': plats,
        'avis': avis,
        'ca': ca,
        'commissions': commissions,
        'paliers': restaurant.paliers_livraison.all(),
        'active_page': 'restaurants',
    })


@admin_required
def restaurant_bareme(request, pk):
    """Édition, par un admin, du barème de livraison par distance d'un restaurant
    (dépannage / support — le restaurant le gère aussi depuis son espace)."""
    restaurant = get_object_or_404(RestaurantProfile, pk=pk)
    if request.method == 'POST':
        lignes, erreur = parser_bareme_livraison(
            request.POST.getlist('palier_km'), request.POST.getlist('palier_prix'),
        )
        if erreur:
            messages.error(request, erreur)
            return redirect('core:restaurant_detail', pk=pk)
        remplacer_bareme_livraison(restaurant, lignes)
        AuditLog.objects.create(
            user=request.user, action='UPDATE_BAREME_LIVRAISON',
            model_name='RestaurantProfile', object_id=str(pk),
            description={'tranches': [[float(k), m] for k, m in lignes]},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        messages.success(
            request,
            f'Barème de livraison mis à jour ({len(lignes)} tranche(s)).' if lignes
            else 'Barème de livraison retiré — le frais de repli s\'applique.',
        )
    return redirect('core:restaurant_detail', pk=pk)


@admin_required
def restaurant_create(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        nom = request.POST.get('nom')
        adresse = request.POST.get('adresse')
        ville = request.POST.get('ville')
        pays = request.POST.get('pays', 'Cameroun')
        latitude = request.POST.get('latitude') or None
        longitude = request.POST.get('longitude') or None
        commission_rate = request.POST.get('commission_rate', 10)
        description = request.POST.get('description', '')

        if User.objects.filter(username=username).exists():
            messages.error(request, 'Ce nom d\'utilisateur existe déjà.')
        else:
            # Mot de passe laissé vide → génération automatique d'identifiants
            generated = False
            if not password:
                import secrets
                password = secrets.token_urlsafe(9)
                generated = True

            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                role='restaurant',
            )
            profile = RestaurantProfile.objects.create(
                user=user,
                nom=nom,
                adresse=adresse,
                ville=ville,
                pays=pays,
                latitude=latitude,
                longitude=longitude,
                commission_rate=commission_rate,
                description=description,
            )
            if 'logo' in request.FILES:
                profile.logo = request.FILES['logo']
            if 'cover_image' in request.FILES:
                profile.cover_image = request.FILES['cover_image']
            profile.save()

            AuditLog.objects.create(
                user=request.user,
                action='CREATE_RESTAURANT',
                model_name='RestaurantProfile',
                object_id=str(profile.pk),
                description={'nom': nom, 'ville': ville},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            if generated:
                messages.success(
                    request,
                    f'Restaurant "{nom}" créé. Identifiants à transmettre — '
                    f'Utilisateur : {username} · Mot de passe : {password} '
                    f'(affiché une seule fois, notez-le maintenant). '
                    f'Connexion : /admin-panel/login/',
                )
            else:
                messages.success(request, f'Restaurant "{nom}" créé avec succès.')
            return redirect('core:restaurant_detail', pk=profile.pk)

    return render(request, 'admin_panel/restaurants/create.html', {'active_page': 'restaurants'})


@admin_required
def restaurant_edit(request, pk):
    restaurant = get_object_or_404(RestaurantProfile, pk=pk)
    if request.method == 'POST':
        restaurant.nom = request.POST.get('nom', restaurant.nom)
        restaurant.adresse = request.POST.get('adresse', restaurant.adresse)
        restaurant.ville = request.POST.get('ville', restaurant.ville)
        restaurant.pays = request.POST.get('pays', restaurant.pays)
        restaurant.description = request.POST.get('description', restaurant.description)
        lat = request.POST.get('latitude')
        lng = request.POST.get('longitude')
        if lat:
            restaurant.latitude = lat
        if lng:
            restaurant.longitude = lng
        if 'logo' in request.FILES:
            restaurant.logo = request.FILES['logo']
        if 'cover_image' in request.FILES:
            restaurant.cover_image = request.FILES['cover_image']
        restaurant.save()
        AuditLog.objects.create(
            user=request.user, action='EDIT_RESTAURANT',
            model_name='RestaurantProfile', object_id=str(pk),
            description={'nom': restaurant.nom},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        messages.success(request, 'Restaurant mis à jour.')
        return redirect('core:restaurant_detail', pk=pk)

    return render(request, 'admin_panel/restaurants/edit.html', {
        'restaurant': restaurant, 'active_page': 'restaurants'
    })


@admin_required
def restaurant_toggle(request, pk):
    restaurant = get_object_or_404(RestaurantProfile, pk=pk)
    restaurant.user.is_active = not restaurant.user.is_active
    restaurant.user.save()
    action = 'ACTIVATE_RESTAURANT' if restaurant.user.is_active else 'SUSPEND_RESTAURANT'
    AuditLog.objects.create(
        user=request.user, action=action,
        model_name='RestaurantProfile', object_id=str(pk),
        description={'nom': restaurant.nom},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    status = 'activé' if restaurant.user.is_active else 'suspendu'
    messages.success(request, f'Restaurant {status}.')
    return redirect('core:restaurant_detail', pk=pk)


@admin_required
def restaurant_verify(request, pk):
    restaurant = get_object_or_404(RestaurantProfile, pk=pk)
    restaurant.is_verified = True
    restaurant.save()
    AuditLog.objects.create(
        user=request.user, action='VERIFY_RESTAURANT',
        model_name='RestaurantProfile', object_id=str(pk),
        description={'nom': restaurant.nom},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    messages.success(request, 'Restaurant vérifié.')
    return redirect('core:restaurant_detail', pk=pk)


@admin_required
def restaurant_commission(request, pk):
    restaurant = get_object_or_404(RestaurantProfile, pk=pk)
    if request.method == 'POST':
        rate = request.POST.get('commission_rate')
        old_rate = restaurant.commission_rate
        restaurant.commission_rate = rate
        restaurant.save()
        AuditLog.objects.create(
            user=request.user, action='UPDATE_COMMISSION',
            model_name='RestaurantProfile', object_id=str(pk),
            description={'old': str(old_rate), 'new': str(rate)},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        messages.success(request, f'Taux de commission mis à jour : {rate}%')
    return redirect('core:restaurant_detail', pk=pk)
