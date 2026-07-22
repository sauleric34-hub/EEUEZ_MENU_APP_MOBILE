from django.shortcuts import render
from django.db.models import Count, Avg, Q, F, FloatField, Value, ExpressionWrapper
from django.db.models.functions import Coalesce, Cast
from core.models import RestaurantProfile, Plat, Categorie

# Nombre de notes en dessous duquel on tempère la moyenne d'un établissement.
# Sans ce garde-fou, un restaurant avec une seule note de 5/5 passerait devant
# un autre qui tient 4,8 sur deux cents notes — la vitrine serait trompeuse.
SEUIL_CONFIANCE = 5

# Repli quand la plateforme n'a encore aucune note : moyenne neutre sur 5.
NOTE_NEUTRE = 3.5


def _score_bayesien(globale):
    """Score de classement : (v·R + m·C) / (v + m).

        v = nombre de notes, R = moyenne de l'objet,
        m = SEUIL_CONFIANCE,  C = moyenne de la plateforme

    Un objet peu noté est tiré vers C ; il ne s'en écarte qu'en accumulant des
    notes réelles. C'est ce qui empêche une note isolée de 5/5 de coiffer une
    moyenne de 4,8 établie sur des centaines d'avis.

    Tout est explicitement typé en flottant (Cast + ExpressionWrapper) : sans
    cela, le type du résultat dépendrait du moteur de base de données, et un
    COUNT entier pourrait déclencher une division entière côté MySQL alors que
    SQLite — utilisé par les tests — donnerait le bon résultat.
    """
    notes = Cast(F('nb_notes'), FloatField())
    moyenne = Coalesce(F('note_avg'), Value(0.0), output_field=FloatField())
    return ExpressionWrapper(
        (moyenne * notes + Value(float(globale) * SEUIL_CONFIANCE))
        / (notes + Value(float(SEUIL_CONFIANCE))),
        output_field=FloatField(),
    )


def _note_moyenne_globale():
    """Moyenne de toutes les notes de plats visibles, tous restaurants confondus.

    Sert de « point d'ancrage » au score bayésien : un établissement peu noté
    est tiré vers cette moyenne, et s'en éloigne à mesure qu'il accumule des
    notes réelles.
    """
    moyenne = Plat.objects.filter(is_visible=True).aggregate(
        m=Avg('notes__note'),
    )['m']
    return float(moyenne) if moyenne is not None else NOTE_NEUTRE


def landing_view(request):
    globale = _note_moyenne_globale()

    # ── Restaurants ──────────────────────────────────────────
    # La note affichée s'appuie sur les notes de PLATS, comme la propriété
    # RestaurantProfile.note_moyenne utilisée par l'application : les deux
    # surfaces montrent ainsi la même étoile. La différence : on pondère ici
    # par le nombre de notes plutôt que par le nombre de commandes, car cela
    # se calcule en une seule requête SQL (la propriété, elle, fait une
    # requête par plat et ne permet pas de trier en base).
    #
    # distinct=True sur chaque Count est indispensable : sans lui, les
    # jointures multiples (notes + commandes + plats) se multiplient entre
    # elles et gonflent tous les compteurs.
    restaurants = RestaurantProfile.objects.filter(
        is_verified=True, is_open=True, user__is_active=True,
    ).annotate(
        note_avg=Avg('plats__notes__note', filter=Q(plats__is_visible=True)),
        nb_notes=Count('plats__notes', distinct=True, filter=Q(plats__is_visible=True)),
        nb_commandes=Count('commandes', distinct=True),
        nb_plats=Count(
            'plats', distinct=True,
            filter=Q(plats__is_visible=True, plats__is_available=True),
        ),
    ).annotate(
        score=_score_bayesien(globale),
    ).order_by('-score', '-nb_commandes', 'nom')[:6]

    categories = Categorie.objects.annotate(nb=Count('plat', distinct=True)).order_by('-nb')[:6]

    # ── Plats ────────────────────────────────────────────────
    # Même logique de score, appliquée aux notes du plat lui-même.
    # On ne trie plus par '-restaurant__commandes' : cette jointure sur une
    # relation inverse dupliquait chaque plat autant de fois qu'il y avait de
    # commandes au restaurant, et la grille affichait des doublons.
    plats_vedette = Plat.objects.filter(
        is_available=True, is_visible=True,
    ).select_related('restaurant').annotate(
        note_avg=Avg('notes__note'),
        nb_notes=Count('notes', distinct=True),
    ).annotate(
        score=_score_bayesien(globale),
    ).order_by('-score', '-is_featured', 'nom')[:8]

    stats = {
        'restaurants': RestaurantProfile.objects.filter(is_verified=True).count(),
        'plats': Plat.objects.filter(is_available=True).count(),
        'villes': RestaurantProfile.objects.filter(
            is_verified=True,
        ).exclude(ville='').values('ville').distinct().count(),
    }

    return render(request, 'landing.html', {
        'restaurants': restaurants,
        'categories': categories,
        'plats_vedette': plats_vedette,
        'stats': stats,
    })
