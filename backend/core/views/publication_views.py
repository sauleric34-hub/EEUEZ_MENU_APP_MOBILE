# ═══════════════════════════════════════════════════════════
#  API du fil de publications (app mobile)
#
#  Rappel des règles : aucune publication n'est modifiable (pas de PUT/PATCH
#  ici, volontairement), et « supprimer » masque sans détruire.
# ═══════════════════════════════════════════════════════════

import json

from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import (
    Publication, PublicationLike, PublicationCommentaire, Abonnement,
    RestaurantProfile,
)
from .. import fidelite
from ..publications_utils import creer_medias, valider_medias
from ..recommendation_publications import classer_publications
from ..serializers_publications import PublicationSerializer, CommentaireSerializer


def _contexte(request, publications):
    """Prépare le contexte du serializer : ids likés + restaurants suivis,
    chargés en 2 requêtes au total (jamais une par publication)."""
    ctx = {'request': request, 'likes_ids': set(), 'suivis_ids': set()}
    user = getattr(request, 'user', None)
    if not user or user.is_anonymous or not publications:
        return ctx
    ids = [p.pk for p in publications]
    resto_ids = {p.restaurant_id for p in publications}
    ctx['likes_ids'] = set(
        PublicationLike.objects
        .filter(client=user, publication_id__in=ids)
        .values_list('publication_id', flat=True)
    )
    ctx['suivis_ids'] = set(
        Abonnement.objects
        .filter(client=user, restaurant_id__in=resto_ids)
        .values_list('restaurant_id', flat=True)
    )
    return ctx


# ─── FIL ─────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def feed(request):
    """
    GET /api/client/publications/feed?page=1&taille=10&curseur=...
    Le curseur fige le classement : il DOIT être renvoyé tel quel pour les
    pages suivantes, sinon doublons et trous pendant le défilement.
    """
    try:
        page = int(request.GET.get('page', 1))
        taille = int(request.GET.get('taille', 10))
    except (TypeError, ValueError):
        page, taille = 1, 10

    user = request.user if request.user.is_authenticated else None
    publications, curseur, a_suivant = classer_publications(
        user=user, curseur=request.GET.get('curseur'), page=page, taille=taille,
    )
    ctx = _contexte(request, publications)
    return Response({
        'resultats': PublicationSerializer(publications, many=True, context=ctx).data,
        'curseur': curseur,
        'a_suivant': a_suivant,
    })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def publication_detail(request, id):
    pub = Publication.objects.visibles().filter(pk=id).select_related(
        'restaurant', 'auteur', 'plat',
    ).prefetch_related('medias').first()
    if not pub:
        return Response({'error': 'Publication introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    ctx = _contexte(request, [pub])
    data = PublicationSerializer(pub, context=ctx).data
    commentaires = pub.commentaires.filter(supprime_par='').select_related('auteur')[:50]
    data['commentaires'] = CommentaireSerializer(
        commentaires, many=True, context={'request': request},
    ).data
    return Response(data)


# ─── LIKE ────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def toggle_like(request, id):
    """Bascule le like. Renvoie la liste complète des ids likés pour que
    l'app se resynchronise en un seul aller-retour (comme les favoris)."""
    pub = Publication.objects.visibles().filter(pk=id).first()
    if not pub:
        return Response({'error': 'Publication introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    existant = PublicationLike.objects.filter(publication=pub, client=request.user).first()
    if existant:
        existant.delete()
        liked = False
    else:
        PublicationLike.objects.create(publication=pub, client=request.user)
        liked = True
        # Points crédités à la création uniquement : retirer son like ne
        # débite jamais l'auteur (sinon on pourrait vider son solde).
        fidelite.crediter_like_recu(pub, request.user)

    ids = list(
        PublicationLike.objects.filter(client=request.user)
        .values_list('publication_id', flat=True)
    )
    return Response({
        'liked': liked,
        'publication': pub.pk,
        'publications_likees': ids,
        'nombre_likes': pub.likes.count(),
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def publications_likees(request):
    """Alimente l'onglet « Publications » de la page des likes."""
    pubs = list(
        Publication.objects.visibles()
        .filter(likes__client=request.user)
        .select_related('restaurant', 'auteur', 'plat')
        .prefetch_related('medias')
        .order_by('-likes__created_at')
    )
    ctx = _contexte(request, pubs)
    return Response(PublicationSerializer(pubs, many=True, context=ctx).data)


# ─── PAGE DE REBOND (lien partagé) ───────────────────────────
def publication_rebond(request, id):
    """
    GET /publication/<id>/  — page web ouverte depuis un lien partagé.

    Un lien « menu:// » n'est pas cliquable dans WhatsApp ou un SMS : on
    partage donc une URL https, et c'est cette page qui rebondit vers
    l'application. Elle porte aussi les métadonnées Open Graph pour que
    l'aperçu du lien soit soigné dans les messageries.
    """
    pub = Publication.objects.visibles().filter(pk=id).select_related(
        'restaurant', 'auteur',
    ).prefetch_related('medias').first()

    lien_app = f'menu://publication/{id}'

    if not pub:
        contexte = {
            'titre': 'Publication indisponible',
            'description': "Cette publication n'existe plus ou a été retirée.",
            'image': None,
            'lien_app': lien_app,
            'lien_app_json': json.dumps(lien_app),
        }
        return render(request, 'publication_rebond.html', contexte, status=404)

    # Première image du carrousel pour l'aperçu (une vidéo ne s'affiche pas).
    media = pub.medias.filter(type='image').first()
    image = request.build_absolute_uri(media.fichier.url) if media else None

    auteur = pub.auteur.get_full_name() or pub.auteur.username if pub.auteur else None
    titre = f'{pub.restaurant.nom} sur Menu' if pub.restaurant else 'Menu'
    description = pub.texte[:180] or (
        f'Une publication de {auteur}' if auteur else 'Découvrez cette publication'
    )

    return render(request, 'publication_rebond.html', {
        'titre': titre,
        'description': description,
        'image': image,
        'lien_app': lien_app,
        'lien_app_json': json.dumps(lien_app),
    })


# ─── FIDÉLITÉ ────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def fidelite_apercu(request):
    """
    GET /api/client/fidelite?montant=12000
    Solde, niveau et réduction applicable au panier — calculée par le serveur,
    afin que l'app n'ait aucune règle métier codée en dur.
    """
    reglages = fidelite.config()
    try:
        montant = int(float(request.GET.get('montant') or 0))
    except (TypeError, ValueError):
        montant = 0

    points, reduction = fidelite.calculer_reduction(request.user, montant)
    solde = int(request.user.points_solde or 0)

    return Response({
        'solde': solde,
        'niveau': fidelite.niveau(solde),
        'actif': reglages.actif,
        'seuil_minimum': reglages.seuil_minimum_conversion,
        'points_par_unite': reglages.points_par_unite,
        'valeur_unite': reglages.valeur_unite,
        'reduction_max_pourcentage': reglages.reduction_max_pourcentage,
        # Applicable ici et maintenant, tous plafonds appliqués :
        'points_utilisables': points,
        'reduction': reduction,
    })


# ─── CONTRIBUTIONS CLIENT ────────────────────────────────────
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def contribuer(request, id):
    """
    POST /api/client/restaurants/<id>/publications  (multipart)
    Champs : texte, plat_id (facultatif), medias[] (fichiers).

    La contribution part en « en_attente » : elle n'apparaît dans le fil
    qu'une fois validée par le restaurant.
    """
    if request.user.role != 'client':
        return Response(
            {'error': 'Seuls les clients peuvent proposer une publication.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    resto = RestaurantProfile.objects.filter(pk=id).first()
    if not resto:
        return Response({'error': 'Restaurant introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    texte = (request.data.get('texte') or '').strip()
    fichiers = request.FILES.getlist('medias')
    if not texte and not fichiers:
        return Response(
            {'error': 'Ajoutez un texte ou au moins une photo/vidéo.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    erreur = valider_medias(fichiers)
    if erreur:
        return Response({'error': erreur}, status=status.HTTP_400_BAD_REQUEST)

    # Le plat proposé doit appartenir au restaurant ciblé.
    plat = None
    plat_id = request.data.get('plat_id')
    if plat_id:
        plat = resto.plats.filter(pk=plat_id).first()

    pub = Publication.objects.create(
        restaurant=resto, auteur=request.user, texte=texte, plat=plat, statut='en_attente',
    )
    creer_medias(pub, fichiers)

    ctx = _contexte(request, [pub])
    return Response(
        PublicationSerializer(pub, context=ctx).data, status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def mes_publications(request):
    """Contributions de l'utilisateur — tous statuts (il voit ses « en attente »),
    hors celles qu'il a lui-même supprimées."""
    pubs = list(
        Publication.objects.filter(auteur=request.user, supprime_par='')
        .select_related('restaurant', 'auteur', 'plat')
        .prefetch_related('medias')
        .order_by('-created_at')
    )
    ctx = _contexte(request, pubs)
    return Response(PublicationSerializer(pubs, many=True, context=ctx).data)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def publication_delete(request, id):
    """Suppression douce par l'auteur : masquée dans le fil, dans le workspace
    du restaurant et dans son profil — mais conservée pour l'administrateur."""
    pub = get_object_or_404(Publication, pk=id)
    if pub.auteur_id != request.user.pk:
        return Response(
            {'error': 'Vous ne pouvez supprimer que vos propres publications.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    pub.supprime_par = 'client'
    pub.supprime_le = timezone.now()
    pub.save(update_fields=['supprime_par', 'supprime_le'])
    return Response(status=status.HTTP_204_NO_CONTENT)


# ─── COMMENTAIRES ────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticatedOrReadOnly])
def commentaires(request, id):
    pub = Publication.objects.visibles().filter(pk=id).first()
    if not pub:
        return Response({'error': 'Publication introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        qs = pub.commentaires.filter(supprime_par='').select_related('auteur')
        return Response(
            CommentaireSerializer(qs, many=True, context={'request': request}).data
        )

    texte = (request.data.get('texte') or '').strip()
    if not texte:
        return Response({'error': 'Le commentaire est vide.'}, status=status.HTTP_400_BAD_REQUEST)

    commentaire = PublicationCommentaire.objects.create(
        publication=pub, auteur=request.user, texte=texte,
    )
    fidelite.crediter_commentaire_recu(commentaire)
    return Response(
        CommentaireSerializer(commentaire, context={'request': request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def commentaire_delete(request, id):
    """Suppression douce : l'auteur, le restaurant propriétaire ou l'admin."""
    commentaire = get_object_or_404(
        PublicationCommentaire.objects.select_related('publication'), pk=id,
    )
    user = request.user
    resto = getattr(user, 'restaurant_profile', None)

    if user.role == 'admin':
        par = 'admin'
    elif commentaire.auteur_id == user.pk:
        par = 'auteur'
    elif resto and commentaire.publication.restaurant_id == resto.pk:
        par = 'restaurant'
    else:
        return Response(
            {'error': "Vous ne pouvez pas supprimer ce commentaire."},
            status=status.HTTP_403_FORBIDDEN,
        )

    commentaire.supprime_par = par
    commentaire.supprime_le = timezone.now()
    commentaire.save(update_fields=['supprime_par', 'supprime_le'])
    return Response(status=status.HTTP_204_NO_CONTENT)
