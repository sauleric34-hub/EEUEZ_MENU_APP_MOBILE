# ═══════════════════════════════════════════════════════════
#  Vues API dédiées à l'application mobile client
# ═══════════════════════════════════════════════════════════

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import RestaurantProfile, Plat, Categorie, Commande, Favori, Abonnement, Avis
from .serializers import (
    RestaurantProfileSerializer, PlatSerializer, CategorieSerializer,
    FavoriSerializer, AbonnementSerializer, AvisSerializer,
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
    return Response(RestaurantProfileSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def restaurant_detail(request, id):
    try:
        r = RestaurantProfile.objects.get(id=id)
    except RestaurantProfile.DoesNotExist:
        return Response({'error': 'Restaurant introuvable'}, status=status.HTTP_404_NOT_FOUND)
    data = RestaurantProfileSerializer(r).data
    plats = Plat.objects.filter(restaurant=r, is_available=True, is_visible=True)
    data['plats'] = PlatSerializer(plats, many=True).data
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
    return Response(PlatSerializer(qs.order_by('-id'), many=True).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def plat_detail(request, id):
    try:
        p = Plat.objects.select_related('restaurant', 'categorie').get(id=id)
    except Plat.DoesNotExist:
        return Response({'error': 'Plat introuvable'}, status=status.HTTP_404_NOT_FOUND)
    return Response(PlatSerializer(p).data)


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
        data = PlatSerializer(plat).data
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
        data = RestaurantProfileSerializer(resto).data
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
