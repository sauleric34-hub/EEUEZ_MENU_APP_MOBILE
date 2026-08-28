"""Workspace admin — gestion des livreurs INDÉPENDANTS.

Un livreur indépendant a le rôle « livreur » et n'est rattaché à aucun
restaurant (restaurant_attache = NULL). Ce sont eux qui prennent les commandes
mises en « livraison libre » par les restaurants.
"""

from django.contrib import messages
from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.shortcuts import redirect, render, get_object_or_404
from django.utils import timezone

from core.models import AuditLog, Livraison, PaiementLivreur
from core.models_livraison import ParametrageLivraison
from .dashboard import admin_required

User = get_user_model()

# Longueur minimale du mot de passe d'un compte créé par l'admin.
MIN_MDP = 6


@admin_required
def livreurs_view(request):
    """Liste + création des livreurs indépendants."""
    if request.method == 'POST':
        return _creer_livreur(request)

    livreurs = (
        User.objects.filter(role='livreur', restaurant_attache__isnull=True)
        .annotate(
            nb_en_cours=Count(
                'livraison',
                filter=Q(livraison__statut__in=['assignee', 'en_collecte', 'en_livraison']),
            ),
            nb_abandons=Count('abandons_livraison'),
        )
        .order_by('-is_active', 'username')
    )
    livreurs = list(livreurs)
    for l in livreurs:
        l.solde = int(l.solde_livreur)
        l.paiement_ok = bool(l.paiement_numero)

    return render(request, 'admin_panel/livreurs/index.html', {
        'livreurs': livreurs,
        'total': len(livreurs),
        'actifs': sum(1 for l in livreurs if l.is_active),
        'active_page': 'livreurs',
    })


@admin_required
def paiements_view(request):
    """Suivi des paiements automatiques des livreurs + relance manuelle."""
    paiements = PaiementLivreur.objects.select_related('livreur').order_by('-created_at')[:100]
    a_verser = (
        User.objects.filter(role='livreur', restaurant_attache__isnull=True, is_active=True)
        .exclude(paiement_numero='')
    )
    a_verser = [l for l in a_verser if l.solde_livreur > 0]
    for l in a_verser:
        l.solde = int(l.solde_livreur)

    return render(request, 'admin_panel/livreurs/paiements.html', {
        'paiements': paiements,
        'en_attente': [p for p in paiements if p.statut in ('en_attente', 'approuve')],
        'a_verser': a_verser,
        'active_page': 'livreurs',
    })


@admin_required
def paiement_action(request, pk):
    if request.method != 'POST':
        return redirect('core:admin_livreur_paiements')

    action = request.POST.get('action')

    if action == 'declencher':
        # Force un versement du solde courant d'un livreur.
        from core.payout_livreur import declencher_paiement_livreur
        livreur = get_object_or_404(User, pk=request.POST.get('livreur'), role='livreur')
        paiement = declencher_paiement_livreur(livreur, auto=False)
        if paiement:
            messages.success(request, f'Paiement #{paiement.pk} de {int(paiement.montant)} F initié.')
        else:
            messages.error(request, 'Aucun versement possible (solde nul, numéro manquant ou paiement déjà en cours).')
        return redirect('core:admin_livreur_paiements')

    paiement = get_object_or_404(PaiementLivreur, pk=pk)
    if action == 'marquer_paye':
        paiement.statut = 'paye'
        paiement.processed_at = timezone.now()
        paiement.save(update_fields=['statut', 'processed_at'])
        messages.success(request, f'Paiement #{paiement.pk} marqué payé.')
    elif action == 'refuser':
        paiement.statut = 'refuse'
        paiement.processed_at = timezone.now()
        paiement.save(update_fields=['statut', 'processed_at'])
        messages.info(request, f'Paiement #{paiement.pk} refusé — le solde du livreur est reconstitué.')
    else:
        messages.error(request, 'Action inconnue.')
    return redirect('core:admin_livreur_paiements')


def _creer_livreur(request):
    email = (request.POST.get('email') or '').strip().lower()
    mdp = request.POST.get('password') or ''
    prenom = (request.POST.get('first_name') or '').strip()
    nom = (request.POST.get('last_name') or '').strip()
    telephone = (request.POST.get('telephone') or '').strip()

    # Validations minimales — le compte est créé par l'admin, mais reste un
    # accès réel : on refuse un e-mail déjà pris et un mot de passe trop court.
    if not email:
        messages.error(request, "L'e-mail est obligatoire.")
    elif User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
        messages.error(request, f'Un compte existe déjà avec « {email} ».')
    elif len(mdp) < MIN_MDP:
        messages.error(request, f'Le mot de passe doit faire au moins {MIN_MDP} caractères.')
    else:
        livreur = User.objects.create_user(
            username=email, email=email, password=mdp,
            first_name=prenom, last_name=nom, telephone=telephone,
            role='livreur',
        )
        # restaurant_attache reste NULL : c'est ce qui en fait un indépendant.
        AuditLog.objects.create(
            user=request.user, action='LIVREUR_INDEP_CREE',
            model_name='User', object_id=str(livreur.pk),
            description={'email': email},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        messages.success(request, f'Livreur indépendant « {email} » créé.')

    return redirect('core:admin_livreurs')


@admin_required
def livreur_toggle(request, pk):
    """Active / désactive un livreur indépendant (sans le supprimer)."""
    if request.method != 'POST':
        return redirect('core:admin_livreurs')

    livreur = get_object_or_404(
        User, pk=pk, role='livreur', restaurant_attache__isnull=True,
    )
    livreur.is_active = not livreur.is_active
    livreur.save(update_fields=['is_active'])

    etat = 'réactivé' if livreur.is_active else 'désactivé'
    AuditLog.objects.create(
        user=request.user, action='LIVREUR_INDEP_TOGGLE',
        model_name='User', object_id=str(livreur.pk),
        description={'is_active': livreur.is_active},
        ip_address=request.META.get('REMOTE_ADDR'),
    )
    messages.success(request, f'Livreur « {livreur.username} » {etat}.')
    return redirect('core:admin_livreurs')


@admin_required
def parametrage_view(request):
    """Réglages de la livraison libre (part livreur, seuil de paiement, quotas)."""
    config = ParametrageLivraison.get_solo()
    champs = [
        'pourcentage_livreur', 'seuil_paiement_auto', 'delai_relance_minutes',
        'max_abandons', 'fenetre_abandons_jours',
    ]

    if request.method == 'POST':
        try:
            for champ in champs:
                valeur = int(request.POST.get(champ, getattr(config, champ)))
                if valeur < 0:
                    raise ValueError(champ)
                setattr(config, champ, valeur)
        except (TypeError, ValueError):
            messages.error(request, 'Toutes les valeurs doivent être des entiers positifs.')
            return redirect('core:admin_livreur_parametrage')
        if config.pourcentage_livreur > 100:
            messages.error(request, 'La part du livreur ne peut pas dépasser 100 %.')
            return redirect('core:admin_livreur_parametrage')
        config.actif = request.POST.get('actif') == 'on'
        config.save()
        AuditLog.objects.create(
            user=request.user, action='LIVRAISON_PARAMETRAGE',
            model_name='ParametrageLivraison', object_id='1',
            description={c: getattr(config, c) for c in champs},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        messages.success(request, 'Paramétrage de la livraison enregistré.')
        return redirect('core:admin_livreur_parametrage')

    return render(request, 'admin_panel/livreurs/parametrage.html', {
        'config': config,
        'active_page': 'livreurs',
    })
