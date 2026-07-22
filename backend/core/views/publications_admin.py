# ═══════════════════════════════════════════════════════════
#  Modération des publications (administrateur)
#
#  Seul endroit de l'application où une publication peut être DÉTRUITE.
#  Partout ailleurs (client, restaurant) la suppression est « douce » :
#  la ligne survit, masquée. L'admin voit tout, y compris le supprimé.
# ═══════════════════════════════════════════════════════════

from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from core import fidelite
from core.models import (
    AuditLog, ParametrageFidelite, Publication, PublicationCommentaire,
)

from .dashboard import admin_required


def _journaliser(request, action, objet, description):
    AuditLog.objects.create(
        user=request.user, action=action,
        model_name=objet.__class__.__name__, object_id=str(objet.pk),
        description=description, ip_address=request.META.get('REMOTE_ADDR'),
    )


@admin_required
def publications_view(request):
    """Liste TOUTES les publications, y compris celles supprimées côté client
    ou restaurant — c'est la seule vue qui ne filtre rien."""
    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'supprimer_definitivement':
            pub = get_object_or_404(Publication, pk=request.POST.get('publication_id'))
            # On journalise AVANT destruction : après, l'objet n'existe plus.
            _journaliser(request, 'PUBLICATION_SUPPRESSION_DEFINITIVE', pub, {
                'restaurant': pub.restaurant.nom if pub.restaurant else None,
                'auteur': pub.auteur.username if pub.auteur else None,
                'statut': pub.statut,
                'supprime_par': pub.supprime_par,
                'texte': pub.texte[:200],
            })
            # Les points gagnés grâce à cette publication sont repris.
            fidelite.annuler_points_publication(pub)
            pub.delete()
            messages.success(request, 'Publication définitivement supprimée de la base.')

        elif action == 'supprimer_commentaire':
            com = get_object_or_404(
                PublicationCommentaire, pk=request.POST.get('commentaire_id'),
            )
            _journaliser(request, 'COMMENTAIRE_SUPPRESSION_ADMIN', com, {
                'publication': com.publication_id,
                'auteur': com.auteur.username if com.auteur else None,
                'texte': com.texte[:200],
            })
            # Suppression douce, comme pour l'auteur et le restaurant : détruire
            # la ligne ferait perdre la trace des points déjà attribués grâce à
            # ce commentaire, qui ne pourraient alors plus être repris.
            com.supprime_par = 'admin'
            com.supprime_le = timezone.now()
            com.save(update_fields=['supprime_par', 'supprime_le'])
            messages.success(request, 'Commentaire masqué partout dans l\'application.')

        elif action == 'restaurer':
            pub = get_object_or_404(Publication, pk=request.POST.get('publication_id'))
            pub.supprime_par = ''
            pub.supprime_le = None
            pub.save(update_fields=['supprime_par', 'supprime_le'])
            _journaliser(request, 'PUBLICATION_RESTAUREE', pub, {'statut': pub.statut})
            messages.success(request, 'Publication restaurée — de nouveau visible.')

        else:
            messages.error(request, 'Action inconnue.')
        return redirect('core:admin_publications')

    qs = Publication.objects.all().select_related(
        'restaurant', 'auteur', 'plat',
    ).prefetch_related('medias').annotate(
        nb_likes=Count('likes', distinct=True),
        nb_commentaires=Count('commentaires', distinct=True),
    )

    # Filtres
    etat = request.GET.get('etat', '')
    recherche = (request.GET.get('q') or '').strip()
    if etat == 'supprimees':
        qs = qs.exclude(supprime_par='')
    elif etat == 'attente':
        qs = qs.filter(statut='en_attente', supprime_par='')
    elif etat == 'visibles':
        qs = qs.filter(statut='publiee', supprime_par='')
    if recherche:
        qs = qs.filter(
            Q(texte__icontains=recherche)
            | Q(restaurant__nom__icontains=recherche)
            | Q(auteur__username__icontains=recherche),
        )

    page = Paginator(qs.order_by('-created_at'), 20).get_page(request.GET.get('page'))

    return render(request, 'admin_panel/publications/index.html', {
        'page_obj': page,
        'etat': etat,
        'q': recherche,
        'total': Publication.objects.count(),
        'nb_supprimees': Publication.objects.exclude(supprime_par='').count(),
        'active_page': 'publications',
    })


@admin_required
def publication_detail(request, pk):
    """Fiche complète : médias et fil de commentaires modérable."""
    pub = get_object_or_404(
        Publication.objects.select_related('restaurant', 'auteur', 'plat'), pk=pk,
    )
    return render(request, 'admin_panel/publications/detail.html', {
        'pub': pub,
        'medias': pub.medias.all(),
        'commentaires': pub.commentaires.select_related('auteur').order_by('created_at'),
        'active_page': 'publications',
    })


@admin_required
def fidelite_config(request):
    """Réglage du programme de fidélité (gains, conversion, niveaux)."""
    config = ParametrageFidelite.get_solo()

    if request.method == 'POST':
        champs_entiers = [
            'points_publication_validee', 'points_par_like', 'points_par_commentaire',
            'points_par_unite', 'valeur_unite', 'seuil_minimum_conversion',
            'reduction_max_pourcentage', 'seuil_bronze', 'seuil_argent', 'seuil_or',
        ]
        try:
            for champ in champs_entiers:
                valeur = int(request.POST.get(champ, getattr(config, champ)))
                if valeur < 0:
                    raise ValueError(champ)
                setattr(config, champ, valeur)
        except (TypeError, ValueError):
            messages.error(request, 'Toutes les valeurs doivent être des entiers positifs.')
            return redirect('core:admin_fidelite')

        if config.points_par_unite == 0:
            messages.error(request, 'Le nombre de points par unité ne peut pas être nul.')
            return redirect('core:admin_fidelite')

        config.actif = request.POST.get('actif') == 'on'
        config.save()
        _journaliser(request, 'FIDELITE_PARAMETRAGE', config, {
            champ: getattr(config, champ) for champ in champs_entiers
        })
        messages.success(request, 'Paramétrage de la fidélité enregistré.')
        return redirect('core:admin_fidelite')

    return render(request, 'admin_panel/publications/fidelite.html', {
        'config': config,
        'exemple': config.points_vers_fcfa(config.seuil_minimum_conversion),
        'active_page': 'fidelite',
    })
