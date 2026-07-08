# ═══════════════════════════════════════════════════════════
#  Workspace Restaurant (web) — dashboard, commandes, plats,
#  messages, livreurs, communauté, finances, profil.
# ═══════════════════════════════════════════════════════════

import json
import secrets
from datetime import timedelta
from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Count, Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone

from core.models import (
    User, RestaurantProfile, Plat, PlatImage, Categorie, Commande, Livraison,
    Conversation, Message, Favori, Abonnement, RetraitFonds, AuditLog,
)


def resto_required(view):
    """Réservé aux comptes restaurant possédant un profil."""
    @wraps(view)
    @login_required(login_url='core:login')
    def wrapper(request, *args, **kwargs):
        if request.user.role != 'restaurant' or not hasattr(request.user, 'restaurant_profile'):
            messages.error(request, 'Accès réservé aux restaurants.')
            return redirect('core:login')
        request.resto = request.user.restaurant_profile
        return view(request, *args, **kwargs)
    return wrapper


def _solde_disponible(resto):
    """Gains cumulés (commandes livrées) − retraits non refusés."""
    gains = resto.commandes.filter(statut='livree').aggregate(t=Sum('montant_restaurant'))['t'] or 0
    retire = resto.retraits.exclude(statut='refuse').aggregate(t=Sum('montant'))['t'] or 0
    return float(gains) - float(retire)


# ─── DASHBOARD ───────────────────────────────────────────────
@resto_required
def dashboard(request):
    resto = request.resto
    now = timezone.now()
    today = now.date()

    commandes = resto.commandes
    cmd_jour = commandes.filter(created_at__date=today).count()
    cmd_mois = commandes.filter(created_at__month=now.month, created_at__year=now.year).count()
    en_attente = commandes.filter(statut='en_attente').count()
    revenus = commandes.filter(statut='livree').aggregate(t=Sum('montant_restaurant'))['t'] or 0
    nb_plats = resto.plats.filter(is_visible=True).count()
    nb_abonnes = resto.abonnes.count()
    nb_likes = Favori.objects.filter(plat__restaurant=resto).count()
    non_lus = Message.objects.filter(
        conversation__restaurant=resto, sender='client', is_read=False,
    ).count()

    # Commandes des 7 derniers jours (graphique barres)
    jours, valeurs = [], []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        jours.append(d.strftime('%a %d'))
        valeurs.append(commandes.filter(created_at__date=d).count())

    # Répartition des statuts (doughnut)
    statuts = list(commandes.values('statut').annotate(c=Count('id')))

    # Top plats par volume commandé
    top_plats = (
        Plat.objects.filter(restaurant=resto)
        .annotate(vol=Sum('lignecommande__quantite'), likes=Count('favoris', distinct=True))
        .order_by('-vol')[:5]
    )

    recentes = commandes.select_related('client').order_by('-created_at')[:8]

    return render(request, 'resto/dashboard.html', {
        'resto': resto,
        'cmd_jour': cmd_jour, 'cmd_mois': cmd_mois, 'en_attente': en_attente,
        'revenus': int(revenus), 'nb_plats': nb_plats,
        'nb_abonnes': nb_abonnes, 'nb_likes': nb_likes, 'non_lus': non_lus,
        'note': resto.note_moyenne,
        'chart_jours': json.dumps(jours), 'chart_valeurs': json.dumps(valeurs),
        'chart_statuts': json.dumps(statuts),
        'top_plats': top_plats,
        'recentes': recentes,
        'active_page': 'dashboard',
    })


# ─── COMMANDES ───────────────────────────────────────────────
@resto_required
def commandes(request):
    resto = request.resto
    statut = request.GET.get('statut', '')
    qs = resto.commandes.select_related('client', 'livraison', 'livraison__livreur').prefetch_related('lignes__plat')
    if statut:
        qs = qs.filter(statut=statut)
    livreurs = User.objects.filter(role='livreur', restaurant_attache=resto, is_active=True)
    counts = {row['statut']: row['c'] for row in resto.commandes.values('statut').annotate(c=Count('id'))}
    statut_tabs = [
        (code, label, counts.get(code, 0)) for code, label in Commande.STATUT_CHOICES
    ]
    return render(request, 'resto/commandes.html', {
        'resto': resto,
        'commandes': qs.order_by('-created_at')[:60],
        'statut': statut,
        'livreurs': livreurs,
        'statut_tabs': statut_tabs,
        'total_count': resto.commandes.count(),
        'active_page': 'commandes',
    })


@resto_required
def commande_action(request, pk):
    resto = request.resto
    commande = get_object_or_404(Commande, pk=pk, restaurant=resto)
    action = request.POST.get('action')

    if action == 'accepter' and commande.statut == 'en_attente':
        commande.statut = 'acceptee'
        messages.success(request, f'Commande #{commande.pk} acceptée.')
    elif action == 'refuser' and commande.statut == 'en_attente':
        commande.statut = 'refusee'
        commande.notes = request.POST.get('raison', commande.notes)
        messages.warning(request, f'Commande #{commande.pk} refusée.')
    elif action == 'preparation' and commande.statut == 'acceptee':
        commande.statut = 'en_preparation'
        messages.success(request, f'Commande #{commande.pk} en préparation.')
    elif action == 'prete' and commande.statut in ('acceptee', 'en_preparation'):
        commande.statut = 'prete'
        messages.success(request, f'Commande #{commande.pk} prête — assignez un livreur.')
    elif action == 'assigner':
        livreur = get_object_or_404(
            User, pk=request.POST.get('livreur'), role='livreur', restaurant_attache=resto,
        )
        if hasattr(commande, 'livraison'):
            commande.livraison.livreur = livreur
            commande.livraison.save()
        else:
            Livraison.objects.create(commande=commande, livreur=livreur, statut='assignee')
        if commande.statut in ('acceptee', 'en_preparation'):
            commande.statut = 'prete'
        messages.success(request, f'Livraison #{commande.pk} déléguée à {livreur.get_full_name() or livreur.username}.')
    else:
        messages.error(request, 'Action impossible pour ce statut.')
        return redirect('core:resto_commandes')

    commande.save()
    AuditLog.objects.create(
        user=request.user, action=f'COMMANDE_{(action or "?").upper()}',
        model_name='Commande', object_id=str(commande.pk),
        description={'statut': commande.statut},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    return redirect('core:resto_commandes')


# ─── PLATS ───────────────────────────────────────────────────
@resto_required
def plats(request):
    resto = request.resto
    qs = resto.plats.annotate(
        vol=Sum('lignecommande__quantite'),
        nb_likes=Count('favoris', distinct=True),
    ).select_related('categorie').order_by('-created_at')
    return render(request, 'resto/plats.html', {
        'resto': resto, 'plats': qs, 'today': timezone.localdate(),
        'active_page': 'plats',
    })


@resto_required
def plat_delete(request, pk):
    plat = get_object_or_404(Plat, pk=pk, restaurant=request.resto)
    nom = plat.nom
    plat.delete()
    messages.success(request, f'Plat « {nom} » supprimé.')
    return redirect('core:resto_plats')


@resto_required
def plat_du_jour(request, pk):
    """Définit / retire ce plat comme plat du jour (un seul par restaurant)."""
    resto = request.resto
    plat = get_object_or_404(Plat, pk=pk, restaurant=resto)
    today = timezone.localdate()
    if plat.plat_du_jour_le == today:
        plat.plat_du_jour_le = None
        plat.save(update_fields=['plat_du_jour_le'])
        messages.info(request, f'« {plat.nom} » n\'est plus le plat du jour.')
    else:
        # Un seul plat du jour à la fois pour ce restaurant
        resto.plats.exclude(pk=plat.pk).update(plat_du_jour_le=None)
        plat.plat_du_jour_le = today
        plat.is_available = True
        plat.save(update_fields=['plat_du_jour_le', 'is_available'])
        messages.success(request, f'« {plat.nom} » est le plat du jour ! (jusqu\'à minuit)')
    return redirect('core:resto_plats')


@resto_required
def plat_form(request, pk=None):
    resto = request.resto
    plat = get_object_or_404(Plat, pk=pk, restaurant=resto) if pk else None

    if request.method == 'POST':
        nom = request.POST.get('nom', '').strip()
        prix = request.POST.get('prix', '0')
        if not nom or not prix.isdigit() or int(prix) <= 0:
            messages.error(request, 'Nom et prix (nombre positif) sont obligatoires.')
        else:
            if plat is None:
                plat = Plat(restaurant=resto)
            plat.nom = nom
            plat.prix = int(prix)
            plat.description = request.POST.get('description', '')
            plat.ingredients = request.POST.get('ingredients', '')
            plat.allergies = request.POST.get('allergies', '')
            cat = request.POST.get('categorie')
            plat.categorie = Categorie.objects.filter(pk=cat).first() if cat else None
            plat.is_available = request.POST.get('is_available') == 'on'
            plat.is_popular = request.POST.get('is_popular') == 'on'
            plat.is_visible = True
            if 'image' in request.FILES:
                plat.image = request.FILES['image']
            plat.save()
            # Photos supplémentaires (galerie)
            for f in request.FILES.getlist('photos'):
                PlatImage.objects.create(plat=plat, image=f)
            messages.success(request, f'Plat « {plat.nom} » enregistré.')
            return redirect('core:resto_plats')

    return render(request, 'resto/plat_form.html', {
        'resto': resto, 'plat': plat,
        'categories': Categorie.objects.all(),
        'active_page': 'plats',
    })


@resto_required
def plat_toggle(request, pk):
    plat = get_object_or_404(Plat, pk=pk, restaurant=request.resto)
    plat.is_available = not plat.is_available
    plat.save(update_fields=['is_available'])
    messages.success(request, f'« {plat.nom} » {"disponible" if plat.is_available else "indisponible"}.')
    return redirect('core:resto_plats')


# ─── MESSAGES ────────────────────────────────────────────────
@resto_required
def conversations(request):
    resto = request.resto
    convs = (
        Conversation.objects.filter(restaurant=resto)
        .select_related('client', 'plat')
        .annotate(non_lus=Count('messages', filter=Q(messages__sender='client', messages__is_read=False)))
        .order_by('-updated_at')
    )
    return render(request, 'resto/messages.html', {
        'resto': resto, 'conversations': convs, 'active_page': 'messages',
    })


@resto_required
def conversation_detail(request, pk):
    resto = request.resto
    conv = get_object_or_404(
        Conversation.objects.select_related('client', 'plat'), pk=pk, restaurant=resto,
    )
    if request.method == 'POST':
        texte = (request.POST.get('texte') or '').strip()
        if texte:
            Message.objects.create(conversation=conv, sender='restaurant', texte=texte)
            conv.save(update_fields=['updated_at'])
        return redirect('core:resto_conversation', pk=pk)

    # Les messages du client sont lus dès l'ouverture du fil
    conv.messages.filter(sender='client', is_read=False).update(is_read=True)
    return render(request, 'resto/conversation.html', {
        'resto': resto, 'conv': conv,
        'msgs': conv.messages.all(),
        'active_page': 'messages',
    })


# ─── LIVREURS ────────────────────────────────────────────────
@resto_required
def livreurs(request):
    resto = request.resto

    if request.method == 'POST':
        nom = request.POST.get('nom', '').strip()
        telephone = request.POST.get('telephone', '').strip()
        email = request.POST.get('email', '').strip()
        username = email or f"livreur.{secrets.token_hex(3)}@menu.cm"
        if User.objects.filter(username=username).exists():
            messages.error(request, 'Un compte existe déjà avec cet email.')
        elif not nom:
            messages.error(request, 'Le nom du livreur est obligatoire.')
        else:
            # Mot de passe : saisi par le restaurant, sinon généré automatiquement
            password = (request.POST.get('password') or '').strip()
            generated = False
            if not password:
                password = secrets.token_urlsafe(8)
                generated = True
            parts = nom.split(' ', 1)
            User.objects.create_user(
                username=username, email=email or username, password=password,
                first_name=parts[0], last_name=parts[1] if len(parts) > 1 else '',
                telephone=telephone, role='livreur', restaurant_attache=resto,
            )
            if generated:
                messages.success(
                    request,
                    f'Livreur « {nom} » créé. Mot de passe généré à transmettre — '
                    f'Utilisateur : {username} · Mot de passe : {password} '
                    f'(affiché une seule fois, notez-le maintenant).',
                )
            else:
                messages.success(
                    request,
                    f'Livreur « {nom} » créé avec le mot de passe choisi. '
                    f'Identifiant à transmettre : {username}',
                )
        return redirect('core:resto_livreurs')

    qs = User.objects.filter(role='livreur', restaurant_attache=resto).annotate(
        en_cours=Count('livraisons', filter=Q(livraisons__statut__in=['assignee', 'en_collecte', 'en_livraison'])),
    )
    return render(request, 'resto/livreurs.html', {
        'resto': resto, 'livreurs': qs, 'active_page': 'livreurs',
    })


# ─── COMMUNAUTÉ (abonnés & likes) ────────────────────────────
@resto_required
def communaute(request):
    resto = request.resto
    abonnes = Abonnement.objects.filter(restaurant=resto).select_related('client').order_by('-created_at')
    plats_likes = (
        resto.plats.annotate(nb_likes=Count('favoris', distinct=True))
        .filter(nb_likes__gt=0).order_by('-nb_likes')
    )
    derniers_likes = (
        Favori.objects.filter(plat__restaurant=resto)
        .select_related('client', 'plat').order_by('-created_at')[:20]
    )
    return render(request, 'resto/communaute.html', {
        'resto': resto,
        'abonnes': abonnes,
        'plats_likes': plats_likes,
        'derniers_likes': derniers_likes,
        'total_likes': Favori.objects.filter(plat__restaurant=resto).count(),
        'active_page': 'communaute',
    })


# ─── FINANCES ────────────────────────────────────────────────
@resto_required
def finances(request):
    resto = request.resto

    if request.method == 'POST':
        solde = _solde_disponible(resto)
        try:
            montant = int(request.POST.get('montant', '0'))
        except ValueError:
            montant = 0
        if montant < 1000:
            messages.error(request, 'Montant minimum de retrait : 1 000 F.')
        elif montant > solde:
            messages.error(request, f'Solde insuffisant ({int(solde)} F disponibles).')
        else:
            RetraitFonds.objects.create(
                restaurant=resto, montant=montant,
                mode_paiement=request.POST.get('mode_paiement', 'mtn_money'),
                numero_compte=request.POST.get('numero_compte', ''),
            )
            messages.success(request, f'Demande de retrait de {montant} F enregistrée — traitement sous 48 h.')
        return redirect('core:resto_finances')

    livrees = resto.commandes.filter(statut='livree')
    gains_total = livrees.aggregate(t=Sum('montant_restaurant'))['t'] or 0
    commission_total = livrees.aggregate(t=Sum('commission_eeuez'))['t'] or 0
    now = timezone.now()
    gains_mois = livrees.filter(created_at__month=now.month, created_at__year=now.year) \
        .aggregate(t=Sum('montant_restaurant'))['t'] or 0

    # Revenus des 6 derniers mois (graphique)
    labels, values = [], []
    for i in range(5, -1, -1):
        d = (now.replace(day=1) - timedelta(days=30 * i))
        v = livrees.filter(created_at__month=d.month, created_at__year=d.year) \
            .aggregate(t=Sum('montant_restaurant'))['t'] or 0
        labels.append(d.strftime('%b'))
        values.append(int(v))

    return render(request, 'resto/finances.html', {
        'resto': resto,
        'solde': int(_solde_disponible(resto)),
        'gains_total': int(gains_total),
        'gains_mois': int(gains_mois),
        'commission_total': int(commission_total),
        'commission_rate': resto.commission_rate,
        'nb_livrees': livrees.count(),
        'retraits': resto.retraits.all()[:20],
        'chart_labels': json.dumps(labels),
        'chart_values': json.dumps(values),
        'dernieres': livrees.order_by('-created_at')[:10],
        'active_page': 'finances',
    })


# ─── PROFIL ──────────────────────────────────────────────────
@resto_required
def profil(request):
    resto = request.resto

    if request.method == 'POST':
        form = request.POST.get('form')
        if form == 'infos':
            resto.nom = request.POST.get('nom', resto.nom)
            resto.description = request.POST.get('description', resto.description)
            resto.adresse = request.POST.get('adresse', resto.adresse)
            resto.ville = request.POST.get('ville', resto.ville)
            resto.temps_livraison_moyen = int(request.POST.get('temps_livraison', resto.temps_livraison_moyen) or 30)
            resto.frais_livraison = int(request.POST.get('frais_livraison', resto.frais_livraison) or 500)
            if 'logo' in request.FILES:
                resto.logo = request.FILES['logo']
            if 'cover_image' in request.FILES:
                resto.cover_image = request.FILES['cover_image']
            resto.save()
            messages.success(request, 'Profil mis à jour.')
        elif form == 'position':
            # Position actuelle capturée par le navigateur (géolocalisation)
            try:
                resto.latitude = round(float(request.POST.get('latitude')), 6)
                resto.longitude = round(float(request.POST.get('longitude')), 6)
                resto.save(update_fields=['latitude', 'longitude'])
                messages.success(request, f'Position enregistrée : {resto.latitude}, {resto.longitude}.')
            except (TypeError, ValueError):
                messages.error(request, 'Coordonnées invalides — autorisez la géolocalisation du navigateur.')
        elif form == 'statut':
            resto.is_open = not resto.is_open
            resto.save(update_fields=['is_open'])
            messages.success(request, 'Restaurant ' + ('ouvert' if resto.is_open else 'fermé') + '.')
        return redirect('core:resto_profil')

    return render(request, 'resto/profil.html', {
        'resto': resto, 'active_page': 'profil',
    })
