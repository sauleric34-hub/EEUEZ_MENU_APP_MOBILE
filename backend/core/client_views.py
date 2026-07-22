# ═══════════════════════════════════════════════════════════
#  Vues API dédiées à l'application mobile client
# ═══════════════════════════════════════════════════════════

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from datetime import timedelta

from django.db.models import Avg, Count, Sum
from django.utils import timezone

from .models import (
    RestaurantProfile, Plat, Categorie, Commande, Favori, Abonnement, Avis,
    PlatNote, Conversation, Message, AdresseLivraison,
)
from .serializers import (
    RestaurantProfileSerializer, PlatSerializer, CategorieSerializer,
    FavoriSerializer, AbonnementSerializer, AvisSerializer,
    ConversationSerializer, MessageSerializer, AdresseLivraisonSerializer,
)
from . import recommendation
from .utils import geo


def _parse_coord(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ─── RESTAURANTS ─────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def restaurants_list(request):
    qs = RestaurantProfile.objects.filter(is_open=True, is_verified=True).order_by('-id')
    q = request.GET.get('q', '').strip()
    if q:
        qs = qs.filter(nom__icontains=q)
    return Response(RestaurantProfileSerializer(qs, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def restaurant_detail(request, id):
    try:
        r = RestaurantProfile.objects.get(id=id)
    except RestaurantProfile.DoesNotExist:
        return Response({'error': 'Restaurant introuvable'}, status=status.HTTP_404_NOT_FOUND)
    data = RestaurantProfileSerializer(r, context={'request': request}).data
    plats = Plat.objects.filter(restaurant=r, is_available=True, is_visible=True)
    data['plats'] = PlatSerializer(plats, many=True, context={'request': request}).data
    return Response(data)


# ─── PLATS ───────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def plats_list(request):
    qs = Plat.objects.filter(is_available=True, is_visible=True).select_related('restaurant', 'categorie')
    restaurant = request.GET.get('restaurant')
    categorie = request.GET.get('categorie')
    popular = request.GET.get('popular')
    q = request.GET.get('q', '').strip()
    if restaurant:
        qs = qs.filter(restaurant_id=restaurant)
    if categorie:
        qs = qs.filter(categorie__nom__iexact=categorie)
    if popular in ('1', 'true', 'True'):
        qs = qs.filter(is_popular=True)
    if q:
        qs = qs.filter(nom__icontains=q)
    return Response(PlatSerializer(qs.order_by('-id'), many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def plat_detail(request, id):
    try:
        p = Plat.objects.select_related('restaurant', 'categorie').get(id=id)
    except Plat.DoesNotExist:
        return Response({'error': 'Plat introuvable'}, status=status.HTTP_404_NOT_FOUND)
    return Response(PlatSerializer(p, context={'request': request}).data)


# ─── CATÉGORIES ──────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def categories_list(request):
    return Response(CategorieSerializer(Categorie.objects.all().order_by('id'), many=True).data)


# ─── FAVORIS ─────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def favoris(request):
    if request.method == 'GET':
        qs = Favori.objects.filter(client=request.user).select_related('plat')
        return Response(FavoriSerializer(qs, many=True).data)

    plat_id = request.data.get('plat')
    if not plat_id:
        return Response({'error': 'plat requis'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        plat = Plat.objects.get(id=plat_id)
    except Plat.DoesNotExist:
        return Response({'error': 'Plat introuvable'}, status=status.HTTP_404_NOT_FOUND)

    fav = Favori.objects.filter(client=request.user, plat=plat).first()
    if fav:
        fav.delete()
        liked = False
    else:
        Favori.objects.create(client=request.user, plat=plat)
        liked = True
    ids = list(Favori.objects.filter(client=request.user).values_list('plat_id', flat=True))
    return Response({'liked': liked, 'plat': plat.id, 'favoris': ids})


# ─── ABONNEMENTS ─────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def abonnements(request):
    if request.method == 'GET':
        qs = Abonnement.objects.filter(client=request.user).select_related('restaurant')
        return Response(AbonnementSerializer(qs, many=True).data)

    resto_id = request.data.get('restaurant')
    if not resto_id:
        return Response({'error': 'restaurant requis'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        resto = RestaurantProfile.objects.get(id=resto_id)
    except RestaurantProfile.DoesNotExist:
        return Response({'error': 'Restaurant introuvable'}, status=status.HTTP_404_NOT_FOUND)

    ab = Abonnement.objects.filter(client=request.user, restaurant=resto).first()
    if ab:
        ab.delete()
        following = False
    else:
        Abonnement.objects.create(client=request.user, restaurant=resto)
        following = True
    ids = list(Abonnement.objects.filter(client=request.user).values_list('restaurant_id', flat=True))
    return Response({'following': following, 'restaurant': resto.id, 'abonnements': ids})


# ─── ADRESSES DE LIVRAISON ENREGISTRÉES ──────────────────────
def _to_coord(v):
    try:
        return round(float(v), 6)
    except (TypeError, ValueError):
        return None


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def adresses(request):
    """GET : mes lieux enregistrés. POST : enregistrer un nouveau lieu (GPS)."""
    if request.method == 'GET':
        qs = AdresseLivraison.objects.filter(client=request.user)
        return Response(AdresseLivraisonSerializer(qs, many=True).data)

    lat = _to_coord(request.data.get('latitude'))
    lon = _to_coord(request.data.get('longitude'))
    adresse = (request.data.get('adresse') or '').strip()
    if lat is None or lon is None or not adresse:
        return Response({'error': 'Adresse et coordonnées GPS requises.'}, status=status.HTTP_400_BAD_REQUEST)

    is_default = str(request.data.get('is_default', '')).lower() in ('1', 'true', 'on')
    # Première adresse du client → défaut d'office
    if not AdresseLivraison.objects.filter(client=request.user).exists():
        is_default = True
    if is_default:
        AdresseLivraison.objects.filter(client=request.user).update(is_default=False)

    adr = AdresseLivraison.objects.create(
        client=request.user, label=(request.data.get('label') or '').strip(),
        adresse=adresse, details=(request.data.get('details') or '').strip(),
        latitude=lat, longitude=lon, is_default=is_default,
    )
    return Response(AdresseLivraisonSerializer(adr).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def adresse_detail(request, id):
    """DELETE : supprimer. PATCH : définir comme adresse par défaut."""
    try:
        adr = AdresseLivraison.objects.get(id=id, client=request.user)
    except AdresseLivraison.DoesNotExist:
        return Response({'error': 'Adresse introuvable'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        adr.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    AdresseLivraison.objects.filter(client=request.user).update(is_default=False)
    adr.is_default = True
    adr.save(update_fields=['is_default'])
    return Response(AdresseLivraisonSerializer(adr).data)


# ─── NOTATION D'UN PLAT ──────────────────────────────────────
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def noter_plat(request, id):
    """POST {note: 1..5} — crée ou met à jour la note du client pour ce plat."""
    try:
        plat = Plat.objects.get(id=id)
    except Plat.DoesNotExist:
        return Response({'error': 'Plat introuvable'}, status=status.HTTP_404_NOT_FOUND)

    try:
        note = int(request.data.get('note'))
    except (TypeError, ValueError):
        return Response({'error': 'note invalide'}, status=status.HTTP_400_BAD_REQUEST)
    note = max(1, min(5, note))

    PlatNote.objects.update_or_create(
        client=request.user, plat=plat, defaults={'note': note},
    )
    avg = plat.notes.aggregate(a=Avg('note'))['a'] or note
    return Response({
        'ma_note': note,
        'note': round(avg, 1),
        'nombre_notes': plat.notes.count(),
    })


# ─── MESSAGERIE CLIENT ↔ RESTAURANT ──────────────────────────
WELCOME_TEXT = "Bonjour ! Merci de votre intérêt pour « {plat} ». Comment pouvons-nous vous aider ?"


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def conversations(request):
    """GET : mes conversations. POST {plat} : ouvre (ou retrouve) la discussion sur ce plat."""
    if request.method == 'GET':
        qs = Conversation.objects.filter(client=request.user).select_related('plat', 'restaurant')
        return Response(ConversationSerializer(qs, many=True, context={'request': request}).data)

    plat_id = request.data.get('plat')
    try:
        plat = Plat.objects.select_related('restaurant').get(id=plat_id)
    except (Plat.DoesNotExist, ValueError, TypeError):
        return Response({'error': 'Plat introuvable'}, status=status.HTTP_404_NOT_FOUND)

    conv, created = Conversation.objects.get_or_create(
        client=request.user, plat=plat,
        defaults={'restaurant': plat.restaurant},
    )
    if created:
        Message.objects.create(
            conversation=conv, sender='restaurant',
            texte=WELCOME_TEXT.format(plat=plat.nom),
        )
    return Response(
        ConversationSerializer(conv, context={'request': request}).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def conversation_messages(request, id):
    """GET : messages (marque les réponses resto comme lues). POST {texte} : envoie."""
    try:
        conv = Conversation.objects.get(id=id, client=request.user)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation introuvable'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        conv.messages.filter(sender='restaurant', is_read=False).update(is_read=True)
        return Response(MessageSerializer(conv.messages.all(), many=True).data)

    texte = (request.data.get('texte') or '').strip()
    image = request.FILES.get('image')
    if not texte and not image:
        return Response({'error': 'Message vide'}, status=status.HTTP_400_BAD_REQUEST)
    msg = Message.objects.create(conversation=conv, sender='client', texte=texte, image=image)
    conv.save(update_fields=['updated_at'])
    return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)


# ─── RECOMMANDATIONS PERSONNALISÉES ──────────────────────────
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def recommandations(request):
    """
    GET /api/client/recommandations?lat=&lon=&limit=
    Plats et restaurants classés par pertinence : proximité d'abord,
    puis commandes, likes, fraîcheur et notoriété du restaurant.
    Sans lat/lon, le classement retombe sur la popularité seule.
    """
    lat = _parse_coord(request.GET.get('lat'))
    lon = _parse_coord(request.GET.get('lon'))
    try:
        limit = min(50, max(1, int(request.GET.get('limit', 20))))
    except ValueError:
        limit = 20

    plats_payload = []
    for plat, score, dist, detail in recommendation.recommander_plats(lat, lon, limit=limit):
        data = PlatSerializer(plat, context={'request': request}).data
        data['score'] = score
        data['distance_km'] = dist
        data['temps_estime'] = (
            geo.estimer_temps_livraison(dist, plat.restaurant.temps_livraison_moyen)
            if dist is not None else None
        )
        data['score_detail'] = detail
        plats_payload.append(data)

    restos_payload = []
    for resto, score, dist in recommendation.recommander_restaurants(lat, lon, limit=limit):
        data = RestaurantProfileSerializer(resto, context={'request': request}).data
        data['score'] = score
        data['distance_km'] = dist
        data['temps_estime'] = (
            geo.estimer_temps_livraison(dist, resto.temps_livraison_moyen)
            if dist is not None else None
        )
        restos_payload.append(data)

    return Response({
        'position_utilisee': lat is not None and lon is not None,
        'plats': plats_payload,
        'restaurants': restos_payload,
    })


# ─── AVIS ────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_avis(request, commande_id):
    try:
        commande = Commande.objects.get(id=commande_id, client=request.user)
    except Commande.DoesNotExist:
        return Response({'error': 'Commande introuvable'}, status=status.HTTP_404_NOT_FOUND)
    if hasattr(commande, 'avis'):
        return Response({'error': 'Avis déjà déposé'}, status=status.HTTP_400_BAD_REQUEST)

    note = int(request.data.get('note', 5))
    avis = Avis.objects.create(
        commande=commande,
        client=request.user,
        restaurant=commande.restaurant,
        note=max(1, min(5, note)),
        commentaire=request.data.get('commentaire', ''),
    )
    return Response(AvisSerializer(avis).data, status=status.HTTP_201_CREATED)


# ─── Tendances (pour l'écran Notifications / découverte) ─────────────────────
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def tendances(request):
    """
    GET /api/client/tendances?jours=7
    Renvoie les plats les plus commandés sur la période (7 jours par défaut),
    les plats les plus aimés, et des recommandations personnalisées.
    """
    try:
        jours = max(1, min(90, int(request.GET.get('jours', 7))))
    except (TypeError, ValueError):
        jours = 7
    depuis = timezone.now() - timedelta(days=jours)
    base = Plat.objects.filter(is_available=True, is_visible=True).select_related('restaurant', 'categorie')
    ctx = {'request': request}

    # Les plus commandés sur la période (uniquement les commandes payées).
    top_commandes = (
        base.filter(
            lignecommande__commande__created_at__gte=depuis,
            lignecommande__commande__paiement_confirme=True,
        )
        .annotate(volume=Sum('lignecommande__quantite'))
        .filter(volume__gt=0)
        .order_by('-volume')[:10]
    )

    # Les plus aimés (tous temps confondus).
    top_likes = (
        base.annotate(nb_likes=Count('favoris', distinct=True))
        .filter(nb_likes__gt=0)
        .order_by('-nb_likes')[:10]
    )

    # Recommandations : proximité + popularité (réutilise le moteur existant).
    lat = _parse_coord(request.GET.get('lat'))
    lon = _parse_coord(request.GET.get('lon'))
    try:
        # recommander_plats renvoie des tuples (plat, score, distance, detail)
        reco_plats = [row[0] for row in recommendation.recommander_plats(lat, lon, limit=10)]
    except Exception:
        reco_plats = []

    return Response({
        'periode_jours': jours,
        'top_commandes': PlatSerializer(top_commandes, many=True, context=ctx).data,
        'top_likes': PlatSerializer(top_likes, many=True, context=ctx).data,
        'recommandations': PlatSerializer(reco_plats, many=True, context=ctx).data,
    })
