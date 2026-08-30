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

from core.tracking_ws import broadcast_tracking
from core.models import (
    User, RestaurantProfile, Plat, PlatImage, Categorie, Commande, Livraison,
    Conversation, Message, Favori, Abonnement, RetraitFonds, AuditLog,
    RestaurantMedia, Reservation,
    Publication, PublicationMedia, PublicationCommentaire,
    GroupeComplement, OptionComplement, ElementInclus,
)
from core import fidelite
from core.publications_utils import (
    MAX_MEDIAS_PAR_PUBLICATION, creer_medias, valider_medias,
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

    # Commandes payées uniquement (les paiements mobile money abandonnés n'existent pas).
    commandes = resto.commandes.filter(paiement_confirme=True)
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
    base = resto.commandes.filter(paiement_confirme=True)
    qs = base.select_related('client', 'livraison', 'livraison__livreur').prefetch_related('lignes__plat')
    if statut:
        qs = qs.filter(statut=statut)
    livreurs = User.objects.filter(role='livreur', restaurant_attache=resto, is_active=True)
    counts = {row['statut']: row['c'] for row in base.values('statut').annotate(c=Count('id'))}
    statut_tabs = [
        (code, label, counts.get(code, 0)) for code, label in Commande.STATUT_CHOICES
    ]
    return render(request, 'resto/commandes.html', {
        'resto': resto,
        'commandes': qs.order_by('-created_at')[:60],
        'statut': statut,
        'livreurs': livreurs,
        'statut_tabs': statut_tabs,
        'total_count': base.count(),
        'active_page': 'commandes',
    })


@resto_required
def commande_action(request, pk):
    resto = request.resto
    commande = get_object_or_404(Commande, pk=pk, restaurant=resto)
    action = request.POST.get('action')

    # Une commande dont le paiement mobile money n'a pas abouti n'existe pas
    # vraiment : aucune étape ne peut la faire avancer.
    if not commande.paiement_confirme:
        messages.error(request, 'Cette commande n\'est pas payée.')
        return redirect('core:resto_commandes')

    if action == 'accepter' and commande.statut == 'en_attente':
        commande.statut = 'acceptee'
        messages.success(request, f'Commande #{commande.pk} acceptée.')
    elif action == 'refuser' and commande.statut == 'en_attente':
        commande.statut = 'refusee'
        commande.notes = request.POST.get('raison', commande.notes)
        # Commande refusée : le client récupère les points qu'il avait engagés.
        if fidelite.rembourser_points(commande):
            commande.points_utilises = 0
            commande.reduction_points = 0
        messages.warning(request, f'Commande #{commande.pk} refusée.')
    elif action == 'preparation' and commande.statut == 'acceptee':
        commande.statut = 'en_preparation'
        messages.success(request, f'Commande #{commande.pk} en préparation.')
    elif action == 'prete' and commande.statut in ('acceptee', 'en_preparation'):
        commande.statut = 'prete'
        messages.success(request, f'Commande #{commande.pk} prête — assignez un livreur.')
    elif action == 'assigner' and commande.statut in ('acceptee', 'en_preparation', 'prete'):
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
        # Confiée à un livreur maison : elle n'est plus offerte au pool libre.
        commande.livraison_libre = False
        messages.success(request, f'Livraison #{commande.pk} déléguée à {livreur.get_full_name() or livreur.username}.')
    elif action == 'liberer' and commande.statut in ('acceptee', 'en_preparation', 'prete'):
        # Confie la commande au pool de livreurs INDÉPENDANTS. Sans effet si
        # une livraison est déjà en cours.
        if hasattr(commande, 'livraison'):
            messages.error(request, 'Cette commande a déjà un livreur assigné.')
            return redirect('core:resto_commandes')
        commande.livraison_libre = True
        messages.success(
            request,
            f'Commande #{commande.pk} confiée aux livreurs indépendants. '
            'Le premier disponible pourra la prendre.',
        )
    elif action == 'reprendre_libre' and commande.livraison_libre and not hasattr(commande, 'livraison'):
        # Le restaurant retire la commande du pool (tant qu'aucun livreur ne l'a prise).
        commande.livraison_libre = False
        messages.info(request, f'Commande #{commande.pk} retirée du pool des livreurs indépendants.')
    else:
        messages.error(request, 'Action impossible pour ce statut.')
        return redirect('core:resto_commandes')

    commande.save()
    broadcast_tracking(commande.pk)
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
            frais = request.POST.get('frais_livraison', '')
            plat.frais_livraison = int(frais) if str(frais).isdigit() else 500
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

            _enregistrer_complements(plat, request.POST)
            _enregistrer_inclus(plat, request.POST)

            messages.success(request, f'Plat « {plat.nom} » enregistré.')
            return redirect('core:resto_plats')

    return render(request, 'resto/plat_form.html', {
        'resto': resto, 'plat': plat,
        'categories': Categorie.objects.all(),
        'groupes': (
            plat.groupes_complements.prefetch_related('options') if plat else []
        ),
        'inclus': plat.elements_inclus.all() if plat else [],
        'active_page': 'plats',
    })


def _enregistrer_complements(plat, donnees):
    """Remplace les groupes de compléments du plat par ceux du formulaire.

    Les groupes arrivent sous forme de listes parallèles, indexées par un
    identifiant de ligne côté navigateur :
        groupe_nom[3]="Boisson", option_nom[3][]=["Jus"], option_prix[3][]=["1000"]

    On efface puis recrée plutôt que de rapprocher ligne à ligne : c'est plus
    simple à suivre, et les commandes passées ne sont pas affectées puisque
    leurs choix sont recopiés (cf. ChoixLigneCommande).
    """
    plat.groupes_complements.all().delete()

    indices = [
        cle[len('groupe_nom['):-1]
        for cle in donnees
        if cle.startswith('groupe_nom[') and cle.endswith(']')
    ]

    for ordre, index in enumerate(indices):
        nom = (donnees.get(f'groupe_nom[{index}]') or '').strip()
        if not nom:
            continue

        groupe = GroupeComplement.objects.create(
            plat=plat, nom=nom[:80], ordre=ordre,
            obligatoire=donnees.get(f'groupe_obligatoire[{index}]') == 'on',
        )

        noms = donnees.getlist(f'option_nom[{index}][]')
        prix = donnees.getlist(f'option_prix[{index}][]')
        for rang, nom_option in enumerate(noms):
            nom_option = (nom_option or '').strip()
            if not nom_option:
                continue
            brut = (prix[rang] if rang < len(prix) else '') or '0'
            # Un montant vide ou non numérique vaut « offert » : c'est le cas
            # le plus courant, et cela évite de bloquer la saisie.
            supplement = int(brut) if str(brut).strip().isdigit() else 0
            OptionComplement.objects.create(
                groupe=groupe, nom=nom_option[:80],
                supplement=supplement, ordre=rang,
            )

        # Un groupe sans option n'a pas de sens : il piégerait le client sur
        # un choix impossible s'il était marqué obligatoire.
        if not groupe.options.exists():
            groupe.delete()


def _enregistrer_inclus(plat, donnees):
    """Remplace la liste de ce qui vient avec le plat (information seule)."""
    plat.elements_inclus.all().delete()
    for ordre, nom in enumerate(donnees.getlist('inclus_nom[]')):
        nom = (nom or '').strip()
        if nom:
            ElementInclus.objects.create(plat=plat, nom=nom[:120], ordre=ordre)


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
    # Argent gelé : commandes payées mais pas encore livrées (en cours).
    # Le montant n'entre dans le solde disponible qu'à la confirmation de réception.
    EN_COURS = ['en_attente', 'acceptee', 'en_preparation', 'prete', 'en_livraison']
    argent_gele = resto.commandes.filter(statut__in=EN_COURS) \
        .aggregate(t=Sum('montant_restaurant'))['t'] or 0
    nb_gele = resto.commandes.filter(statut__in=EN_COURS).count()
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
        'argent_gele': int(argent_gele),
        'nb_gele': nb_gele,
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


# ─── GALERIE ─────────────────────────────────────────────────
@resto_required
def galerie(request):
    resto = request.resto
    if request.method == 'POST':
        files = request.FILES.getlist('medias')
        count = 0
        for f in files:
            ctype = (getattr(f, 'content_type', '') or '').lower()
            name = (f.name or '').lower()
            is_video = ctype.startswith('video') or name.endswith(('.mp4', '.mov', '.webm', '.m4v', '.3gp'))
            RestaurantMedia.objects.create(
                restaurant=resto, type='video' if is_video else 'image', fichier=f,
            )
            count += 1
        if count:
            messages.success(request, f'{count} média(s) ajouté(s) à la galerie.')
        else:
            messages.error(request, 'Aucun fichier sélectionné.')
        return redirect('core:resto_galerie')

    return render(request, 'resto/galerie.html', {
        'resto': resto, 'medias': resto.medias.all(), 'active_page': 'galerie',
    })


@resto_required
def galerie_delete(request, pk):
    media = get_object_or_404(RestaurantMedia, pk=pk, restaurant=request.resto)
    media.delete()
    messages.info(request, 'Média supprimé.')
    return redirect('core:resto_galerie')


# ─── PUBLICATIONS (fil social) ───────────────────────────────
@resto_required
def publications(request):
    """Liste des publications du restaurant + file de validation des
    contributions clients (onglet « En attente »)."""
    resto = request.resto

    if request.method == 'POST':
        action = request.POST.get('action')
        pub = get_object_or_404(
            Publication, pk=request.POST.get('publication_id'), restaurant=resto,
        )
        if action == 'valider' and pub.statut == 'en_attente':
            pub.statut = 'publiee'
            pub.save(update_fields=['statut'])
            # Le contributeur est récompensé (une seule fois, même en cas de
            # re-validation : le grand livre garantit l'unicité).
            mouvement = fidelite.crediter_publication_validee(pub)
            if mouvement:
                messages.success(
                    request,
                    f'Publication validée — elle est visible dans l\'app. '
                    f'{mouvement.montant} points crédités à {pub.auteur.get_full_name() or pub.auteur.username}.',
                )
            else:
                messages.success(request, 'Publication validée — elle est visible dans l\'app.')
        elif action == 'refuser' and pub.statut == 'en_attente':
            pub.statut = 'refusee'
            pub.save(update_fields=['statut'])
            messages.warning(request, 'Contribution refusée.')
        else:
            messages.error(request, 'Action impossible pour ce statut.')
        return redirect('core:resto_publications')

    onglet = request.GET.get('onglet', 'publiees')
    base = Publication.objects.du_restaurant(resto).select_related(
        'auteur', 'plat',
    ).prefetch_related('medias')

    if onglet == 'attente':
        liste = base.filter(statut='en_attente')
    else:
        liste = base.filter(statut='publiee')

    return render(request, 'resto/publications.html', {
        'resto': resto,
        'publications': liste,
        'onglet': onglet,
        'nb_publiees': base.filter(statut='publiee').count(),
        'nb_attente': base.filter(statut='en_attente').count(),
        'plats': resto.plats.filter(is_visible=True).order_by('nom'),
        'active_page': 'publications',
    })


@resto_required
def publication_create(request):
    """Nouvelle publication du restaurant. Immuable une fois créée."""
    resto = request.resto
    if request.method != 'POST':
        return redirect('core:resto_publications')

    texte = (request.POST.get('texte') or '').strip()
    fichiers = request.FILES.getlist('medias')
    if not texte and not fichiers:
        messages.error(request, 'Ajoutez au moins un texte ou un média.')
        return redirect('core:resto_publications')

    erreur = valider_medias(fichiers)
    if erreur:
        messages.error(request, erreur)
        return redirect('core:resto_publications')

    plat = None
    plat_id = request.POST.get('plat')
    if plat_id:
        plat = resto.plats.filter(pk=plat_id).first()

    pub = Publication.objects.create(
        restaurant=resto, auteur=None, texte=texte, plat=plat, statut='publiee',
    )
    creer_medias(pub, fichiers)
    messages.success(request, 'Publication en ligne.')
    return redirect('core:resto_publications')


@resto_required
def publication_delete(request, pk):
    """Suppression douce : masquée partout dans l'app, conservée en base et
    visible par l'administrateur avec le statut « supprimée »."""
    pub = get_object_or_404(Publication, pk=pk, restaurant=request.resto)
    pub.supprime_par = 'restaurant'
    pub.supprime_le = timezone.now()
    pub.save(update_fields=['supprime_par', 'supprime_le'])
    messages.info(request, 'Publication retirée de l\'application.')
    return redirect('core:resto_publications')


@resto_required
def publication_commentaire_delete(request, pk):
    """Modération d'un commentaire sur une publication du restaurant."""
    commentaire = get_object_or_404(
        PublicationCommentaire.objects.select_related('publication'),
        pk=pk, publication__restaurant=request.resto,
    )
    commentaire.supprime_par = 'restaurant'
    commentaire.supprime_le = timezone.now()
    commentaire.save(update_fields=['supprime_par', 'supprime_le'])
    messages.info(request, 'Commentaire supprimé.')
    return redirect('core:resto_publications')


# ─── RÉSERVATIONS ────────────────────────────────────────────
@resto_required
def reservations(request):
    resto = request.resto
    if request.method == 'POST':
        form = request.POST.get('form')
        if form == 'prix':
            try:
                resto.prix_reservation = int(request.POST.get('prix_reservation', resto.prix_reservation) or 0)
                resto.save(update_fields=['prix_reservation'])
                messages.success(request, f'Prix de réservation mis à jour : {int(resto.prix_reservation)} F.')
            except (TypeError, ValueError):
                messages.error(request, 'Prix invalide.')
        else:
            resa = get_object_or_404(Reservation, pk=request.POST.get('reservation_id'), restaurant=resto)
            action = request.POST.get('action')
            if action == 'accepter' and resa.statut == 'en_attente':
                # Le resto peut ajuster le prix au moment d'accepter
                prix = request.POST.get('prix')
                if prix and str(prix).isdigit():
                    resa.prix = int(prix)
                if int(resa.prix) <= 0:
                    # Réservation gratuite → confirmée directement (aucun paiement)
                    resa.statut = 'payee'
                    if not resa.code:
                        resa.code = Livraison.generer_code()
                    resa.save(update_fields=['statut', 'prix', 'code', 'updated_at'])
                    messages.success(request, f'Réservation #{resa.pk} acceptée (gratuite) — confirmée.')
                else:
                    resa.statut = 'acceptee'
                    resa.save(update_fields=['statut', 'prix', 'updated_at'])
                    messages.success(request, f'Réservation #{resa.pk} acceptée ({int(resa.prix)} F).')
            elif action == 'refuser' and resa.statut == 'en_attente':
                resa.statut = 'refusee'
                resa.save(update_fields=['statut', 'updated_at'])
                messages.info(request, f'Réservation #{resa.pk} refusée.')
            AuditLog.objects.create(
                user=request.user, action=f'RESERVATION_{(action or "?").upper()}',
                model_name='Reservation', object_id=str(resa.pk),
                description={'statut': resa.statut},
                ip_address=request.META.get('REMOTE_ADDR'),
            )
        return redirect('core:resto_reservations')

    resas = resto.reservations.select_related('client').all()
    return render(request, 'resto/reservations.html', {
        'resto': resto,
        'reservations': resas,
        'en_attente': resas.filter(statut='en_attente').count(),
        'active_page': 'reservations',
    })
