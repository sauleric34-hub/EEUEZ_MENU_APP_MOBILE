"""Workspace admin — gestion des livreurs INDÉPENDANTS.

Un livreur indépendant a le rôle « livreur » et n'est rattaché à aucun
restaurant (restaurant_attache = NULL). Ce sont eux qui prennent les commandes
mises en « livraison libre » par les restaurants.
"""

from django.contrib import messages
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.shortcuts import redirect, render, get_object_or_404

from core.models import AuditLog, Livraison
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
        )
        .order_by('-is_active', 'username')
    )

    return render(request, 'admin_panel/livreurs/index.html', {
        'livreurs': livreurs,
        'total': livreurs.count(),
        'actifs': sum(1 for l in livreurs if l.is_active),
        'active_page': 'livreurs',
    })


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
