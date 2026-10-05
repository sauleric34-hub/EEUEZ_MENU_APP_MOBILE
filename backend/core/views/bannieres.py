from django.conf import settings
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.utils import timezone
from core.models import Banniere, ZoneCiblage, Plat, AuditLog, RestaurantProfile, User
from core.models_bannieres import normaliser_ville
from core.pays import PAYS, PAYS_NOMS, drapeau
from .dashboard import admin_required

RAYON_MAX_KM = 500


def _coord(valeur, borne):
    """Coordonnée ou rayon saisi → float dans [-borne, borne], sinon None."""
    try:
        v = float(str(valeur).replace(',', '.'))
    except (TypeError, ValueError):
        return None
    return v if -borne <= v <= borne else None


def _resume_ciblage(b):
    """Libellés courts pour la liste admin."""
    resume = [f'{drapeau(c)} {PAYS_NOMS.get(c, c)}' for c in b.cible_pays]
    resume += [f'📍 {v}' for v in b.cible_villes]
    resume += [f'◎ {z.nom}' for z in b.cible_zones.all()]
    if b.a_un_cercle:
        resume.append(f'◯ Cercle {b.cercle_rayon_km:g} km')
    return resume


@admin_required
def banniere_list(request):
    bannieres = list(
        Banniere.objects.select_related('plat').prefetch_related('cible_zones').order_by('ordre', 'id')
    )
    for b in bannieres:
        b.resume_ciblage = _resume_ciblage(b)
    return render(request, 'admin_panel/bannieres/list.html', {
        'bannieres': bannieres,
        'nb_zones': ZoneCiblage.objects.count(),
        'active_page': 'bannieres',
    })


def _appliquer_champs(banniere, donnees, fichiers):
    banniere.nom_interne = donnees.get('nom_interne', '').strip() or 'Bannière sans nom'
    banniere.badge = donnees.get('badge', '').strip()
    banniere.titre = donnees.get('titre', '').strip()
    banniere.sous_titre = donnees.get('sous_titre', '').strip()
    banniere.texte_couleur = donnees.get('texte_couleur') or banniere.texte_couleur

    plat_id = donnees.get('plat')
    banniere.plat = Plat.objects.filter(pk=plat_id).first() if plat_id else None
    banniere.bouton_texte_couleur = donnees.get('bouton_texte_couleur') or banniere.bouton_texte_couleur
    banniere.bouton_fond_couleur = donnees.get('bouton_fond_couleur') or banniere.bouton_fond_couleur

    banniere.fond_type = donnees.get('fond_type', 'image')
    banniere.fond_couleur = donnees.get('fond_couleur') or banniere.fond_couleur
    banniere.fond_degrade_debut = donnees.get('fond_degrade_debut') or banniere.fond_degrade_debut
    banniere.fond_degrade_fin = donnees.get('fond_degrade_fin') or banniere.fond_degrade_fin
    if 'fond_image' in fichiers:
        banniere.fond_image = fichiers['fond_image']
    if 'image_droite' in fichiers:
        banniere.image_droite = fichiers['image_droite']

    banniere.is_active = donnees.get('is_active') == 'on'

    # Ciblage
    banniere.cible_pays = sorted({c for c in donnees.getlist('cible_pays') if c in PAYS_NOMS})
    villes, vues = [], set()
    for v in donnees.getlist('cible_villes'):
        v = ' '.join(v.split())[:100]
        if v and normaliser_ville(v) not in vues:
            vues.add(normaliser_ville(v))
            villes.append(v)
    banniere.cible_villes = villes
    lat = _coord(donnees.get('cercle_lat'), 90)
    lon = _coord(donnees.get('cercle_lon'), 180)
    rayon = _coord(donnees.get('cercle_rayon_km'), RAYON_MAX_KM)
    if lat is not None and lon is not None and rayon and rayon > 0:
        banniere.cercle_lat, banniere.cercle_lon, banniere.cercle_rayon_km = lat, lon, rayon
    else:
        banniere.cercle_lat = banniere.cercle_lon = banniere.cercle_rayon_km = None
    return banniere


@admin_required
def banniere_form(request, pk=None):
    banniere = get_object_or_404(Banniere, pk=pk) if pk else None

    if request.method == 'POST':
        titre = request.POST.get('titre', '').strip()
        fond_type = request.POST.get('fond_type', 'image')
        manque_image_fond = fond_type == 'image' and 'fond_image' not in request.FILES and not (banniere and banniere.fond_image)
        manque_image_droite = 'image_droite' not in request.FILES and not (banniere and banniere.image_droite)

        if not titre:
            messages.error(request, 'Le texte de la bannière est obligatoire.')
        elif manque_image_fond:
            messages.error(request, "Choisissez une image de fond, ou changez le type de fond.")
        elif manque_image_droite:
            messages.error(request, "L'image de droite est obligatoire.")
        else:
            if banniere is None:
                banniere = Banniere(ordre=(Banniere.objects.count()))
            banniere = _appliquer_champs(banniere, request.POST, request.FILES)
            banniere.save()
            banniere.cible_zones.set(ZoneCiblage.objects.filter(pk__in=request.POST.getlist('cible_zones')))
            AuditLog.objects.create(
                user=request.user,
                action='EDIT_BANNIERE' if pk else 'CREATE_BANNIERE',
                model_name='Banniere', object_id=str(banniere.pk),
                description={'nom_interne': banniere.nom_interne},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            messages.success(request, f'Bannière « {banniere.nom_interne} » enregistrée.')
            return redirect('core:banniere_list')

    # Villes déjà connues (restaurants + clients) : suggestions de saisie
    villes_connues = sorted(
        {v.strip() for v in RestaurantProfile.objects.values_list('ville', flat=True) if v and v.strip()}
        | {v.strip() for v in User.objects.exclude(ville='').values_list('ville', flat=True) if v.strip()},
        key=str.lower,
    )
    pays_coches = set(banniere.cible_pays) if banniere else set()
    zones_cochees = set(banniere.cible_zones.values_list('pk', flat=True)) if banniere else set()
    return render(request, 'admin_panel/bannieres/form.html', {
        'banniere': banniere,
        'plats': Plat.objects.select_related('restaurant').order_by('nom'),
        'pays': [
            {'code': c, 'nom': n, 'drapeau': drapeau(c), 'coche': c in pays_coches}
            for c, n in PAYS
        ],
        'villes_connues': villes_connues,
        'zones': [
            {'zone': z, 'cochee': z.pk in zones_cochees} for z in ZoneCiblage.objects.all()
        ],
        'carto_api_key': settings.CARTO_API_KEY,
        'active_page': 'bannieres',
    })


@admin_required
def banniere_delete(request, pk):
    banniere = get_object_or_404(Banniere, pk=pk)
    nom = banniere.nom_interne
    banniere.delete()
    AuditLog.objects.create(
        user=request.user, action='DELETE_BANNIERE',
        model_name='Banniere', object_id=str(pk),
        description={'nom_interne': nom},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    messages.success(request, f'Bannière « {nom} » supprimée.')
    return redirect('core:banniere_list')


@admin_required
def banniere_toggle(request, pk):
    banniere = get_object_or_404(Banniere, pk=pk)
    banniere.is_active = not banniere.is_active
    banniere.save(update_fields=['is_active', 'updated_at'])
    messages.success(request, f'Bannière {"activée" if banniere.is_active else "désactivée"}.')
    return redirect('core:banniere_list')


@admin_required
def banniere_move(request, pk, direction):
    banniere = get_object_or_404(Banniere, pk=pk)
    if direction == 'up':
        voisine = Banniere.objects.filter(ordre__lt=banniere.ordre).order_by('-ordre', '-id').first()
    else:
        voisine = Banniere.objects.filter(ordre__gt=banniere.ordre).order_by('ordre', 'id').first()

    if voisine:
        banniere.ordre, voisine.ordre = voisine.ordre, banniere.ordre
        banniere.save(update_fields=['ordre', 'updated_at'])
        voisine.save(update_fields=['ordre', 'updated_at'])

    return redirect('core:banniere_list')


# ─── ZONES DE CIBLAGE (réutilisables) ───────────────────────
def _rafraichir_bannieres_de(zone):
    """Une zone modifiée change la liste de bannières vue par les clients :
    on avance `updated_at` des bannières concernées pour que l'app recharge."""
    Banniere.objects.filter(cible_zones=zone).update(updated_at=timezone.now())


@admin_required
def zone_list(request):
    from django.db.models import Count
    zones = ZoneCiblage.objects.annotate(nb_bannieres=Count('bannieres'))
    return render(request, 'admin_panel/bannieres/zones.html', {
        'zones': zones,
        'carto_api_key': settings.CARTO_API_KEY,
        'active_page': 'bannieres',
    })


@admin_required
def zone_form(request, pk=None):
    zone = get_object_or_404(ZoneCiblage, pk=pk) if pk else None

    if request.method == 'POST':
        nom = request.POST.get('nom', '').strip()[:100]
        lat = _coord(request.POST.get('latitude'), 90)
        lon = _coord(request.POST.get('longitude'), 180)
        rayon = _coord(request.POST.get('rayon_km'), RAYON_MAX_KM)
        if not nom:
            messages.error(request, 'Le nom de la zone est obligatoire.')
        elif lat is None or lon is None:
            messages.error(request, 'Cliquez sur la carte pour placer le centre de la zone.')
        elif not rayon or rayon <= 0:
            messages.error(request, f'Le rayon doit être compris entre 0 et {RAYON_MAX_KM} km.')
        else:
            zone = zone or ZoneCiblage()
            zone.nom, zone.latitude, zone.longitude, zone.rayon_km = nom, lat, lon, rayon
            zone.save()
            _rafraichir_bannieres_de(zone)
            AuditLog.objects.create(
                user=request.user, action='EDIT_ZONE' if pk else 'CREATE_ZONE',
                model_name='ZoneCiblage', object_id=str(zone.pk),
                description={'nom': zone.nom, 'rayon_km': zone.rayon_km},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            messages.success(request, f'Zone « {zone.nom} » enregistrée.')
            return redirect('core:zone_list')

    return render(request, 'admin_panel/bannieres/zone_form.html', {
        'zone': zone,
        'carto_api_key': settings.CARTO_API_KEY,
        'active_page': 'bannieres',
    })


@admin_required
def zone_delete(request, pk):
    if request.method != 'POST':
        return redirect('core:zone_list')
    zone = get_object_or_404(ZoneCiblage, pk=pk)
    nom = zone.nom
    _rafraichir_bannieres_de(zone)
    zone.delete()
    AuditLog.objects.create(
        user=request.user, action='DELETE_ZONE',
        model_name='ZoneCiblage', object_id=str(pk),
        description={'nom': nom},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    messages.success(request, f'Zone « {nom} » supprimée.')
    return redirect('core:zone_list')
