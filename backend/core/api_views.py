from rest_framework import status, views, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone
import json

from .models import User, RestaurantProfile, Plat, Commande, LigneCommande, Livraison, Avis, Transaction
from .serializers import (
    UserSerializer, RestaurantProfileSerializer, PlatSerializer, 
    CommandeSerializer, LivraisonSerializer
)
from .utils import geo

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

# --- AUTH ---
class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(username=email, password=password)
        if not user:
            user = authenticate(email=email, password=password)
            
        if user:
            tokens = get_tokens_for_user(user)
            user_data = UserSerializer(user).data
            return Response({'token': tokens['access'], 'refresh': tokens['refresh'], 'user': user_data})
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

class RegisterView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'

    def post(self, request, role):
        if role not in ['client', 'restaurant', 'livreur']:
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
            
        data = request.data
        username = data.get('email', data.get('username'))
        if User.objects.filter(username=username).exists():
            return Response({'error': 'User already exists'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.create_user(
            username=username,
            email=data.get('email'),
            password=data.get('password'),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            telephone=data.get('telephone', ''),
            allergies=data.get('allergies', ''),
            role=role
        )
        
        if role == 'restaurant':
            RestaurantProfile.objects.create(
                user=user,
                nom=data.get('nom_restaurant', 'Nouveau Restaurant'),
                adresse=data.get('adresse', '')
            )
            
        tokens = get_tokens_for_user(user)
        return Response(
            {'token': tokens['access'], 'refresh': tokens['refresh'], 'user': UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def ping_view(request):
    return Response({"status": "ok", "message": "Pong from Python API"})

# --- CLIENT ---
class ClientProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        user = request.user
        for field in ('first_name', 'last_name', 'telephone', 'allergies'):
            if field in request.data:
                setattr(user, field, request.data.get(field) or '')
        if 'avatar' in request.FILES:
            user.avatar = request.FILES['avatar']
        user.save()
        return Response(UserSerializer(user).data)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def nearby_restaurants(request):
    lat = float(request.GET.get('lat', 3.848))
    lon = float(request.GET.get('lon', 11.502))
    rayon = float(request.GET.get('rayon', 10.0))
    
    restaurants = RestaurantProfile.objects.filter(is_open=True, is_verified=True)
    results = []
    for r in restaurants:
        dist = geo.calculer_distance(lat, lon, r.latitude, r.longitude)
        if dist <= rayon:
            data = RestaurantProfileSerializer(r).data
            data['distance'] = dist
            data['tempsLivraisonEstime'] = geo.estimer_temps_livraison(dist, r.temps_livraison_moyen)
            results.append(data)
            
    return Response(results)

class ClientCommandeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CommandeSerializer

    def get_queryset(self):
        return Commande.objects.filter(client=self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        user = request.user
        data = request.data
        restaurant_id = data.get('restaurant')
        try:
            restaurant = RestaurantProfile.objects.get(id=restaurant_id)
        except RestaurantProfile.DoesNotExist:
            return Response({"error": "Restaurant introuvable"}, status=status.HTTP_404_NOT_FOUND)

        if not restaurant.is_open:
            return Response({"error": "Le restaurant est fermé"}, status=status.HTTP_400_BAD_REQUEST)

        items = data.get('items', [])
        if not items:
            return Response({"error": "Le panier est vide"}, status=status.HTTP_400_BAD_REQUEST)

        # Mode de paiement (par défaut : espèces à la livraison)
        VALID_MODES = {'especes', 'mtn_money', 'orange_money', 'carte'}
        mode_paiement = data.get('mode_paiement', 'especes')
        if mode_paiement not in VALID_MODES:
            mode_paiement = 'especes'

        def _coord(v):
            try:
                return round(float(v), 6)
            except (TypeError, ValueError):
                return None

        commande = Commande.objects.create(
            client=user,
            restaurant=restaurant,
            adresse_livraison=data.get('adresse_livraison', ''),
            latitude_livraison=_coord(data.get('latitude')),
            longitude_livraison=_coord(data.get('longitude')),
            notes=data.get('notes', ''),
            statut='en_attente',
            delai_estime=restaurant.temps_livraison_moyen,
        )

        sous_total = 0
        for item in items:
            try:
                plat = Plat.objects.get(id=item['plat_id'], restaurant=restaurant)
            except (Plat.DoesNotExist, KeyError):
                continue
            qte = max(1, int(item.get('quantite', 1)))
            prix = plat.prix
            LigneCommande.objects.create(
                commande=commande, plat=plat, quantite=qte, prix_unitaire=prix,
            )
            sous_total += float(prix) * qte

        if sous_total == 0:
            commande.delete()
            return Response({"error": "Aucun plat valide dans la commande"}, status=status.HTTP_400_BAD_REQUEST)

        frais_liv = float(restaurant.frais_livraison)
        commande.montant_total = sous_total + frais_liv
        commande.save()

        # Trace du paiement (espèces = à encaisser à la livraison)
        Transaction.objects.create(
            commande=commande,
            type='paiement_client',
            montant=commande.montant_total,
            mode_paiement=mode_paiement,
            statut='complete' if mode_paiement == 'especes' else 'en_attente',
        )

        return Response(CommandeSerializer(commande).data, status=status.HTTP_201_CREATED)

# --- RESTAURANT ---
class RestaurantWorkspaceView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        if request.user.role != 'restaurant':
            return Response({'error': 'Unauthorized'}, status=403)
        return Response(RestaurantProfileSerializer(request.user.restaurant_profile).data)

class RestaurantPlatViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PlatSerializer
    def get_queryset(self):
        return Plat.objects.filter(restaurant=self.request.user.restaurant_profile)
    def perform_create(self, serializer):
        serializer.save(restaurant=self.request.user.restaurant_profile)

class RestaurantCommandeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CommandeSerializer
    
    def get_queryset(self):
        return Commande.objects.filter(restaurant=self.request.user.restaurant_profile)
        
    @action(detail=True, methods=['put'])
    def accept(self, request, pk=None):
        commande = self.get_object()
        if commande.statut != 'en_attente':
            return Response({"error": "Commande ne peut pas être acceptée"}, status=400)
        commande.statut = 'acceptee'
        commande.save()
        return Response(CommandeSerializer(commande).data)
        
    @action(detail=True, methods=['put'])
    def refuse(self, request, pk=None):
        commande = self.get_object()
        commande.statut = 'refusee'
        commande.notes = request.data.get('raison', commande.notes)
        commande.save()
        return Response(CommandeSerializer(commande).data)

# --- LIVREUR ---
class LivreurMissionViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def list(self, request):
        # Liste des missions disponibles
        commandes = Commande.objects.filter(statut__in=['acceptee', 'prete'], livraison__isnull=True)
        return Response(CommandeSerializer(commandes, many=True).data)
        
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        try:
            commande = Commande.objects.get(id=pk)
        except Commande.DoesNotExist:
            return Response({"error": "Commande introuvable"}, status=404)
            
        if commande.statut not in ['acceptee', 'prete'] or hasattr(commande, 'livraison'):
            return Response({"error": "Déjà assignée ou statut invalide"}, status=400)
            
        livraison = Livraison.objects.create(
            commande=commande,
            livreur=request.user,
            statut='assignee'
        )
        commande.statut = 'en_preparation'
        commande.save()
        return Response(LivraisonSerializer(livraison).data)
        
    @action(detail=True, methods=['put'])
    def collected(self, request, pk=None):
        try:
            livraison = Livraison.objects.get(commande_id=pk)
        except Livraison.DoesNotExist:
            return Response({"error": "Livraison introuvable"}, status=404)
            
        livraison.statut = 'en_collecte'
        livraison.save()
        livraison.commande.statut = 'en_livraison'
        livraison.commande.save()
        return Response(LivraisonSerializer(livraison).data)
        
    @action(detail=True, methods=['put'])
    def delivered(self, request, pk=None):
        try:
            livraison = Livraison.objects.get(commande_id=pk)
        except Livraison.DoesNotExist:
            return Response({"error": "Livraison introuvable"}, status=404)
            
        livraison.statut = 'livree'
        livraison.delivered_at = timezone.now()
        livraison.save()
        
        commande = livraison.commande
        commande.statut = 'livree'
        commande.save()
        
        # Calcul des gains du livreur
        livreur = request.user
        gain = float(commande.restaurant.frais_livraison) * 0.7
        livreur.gain_total = float(livreur.gain_total) + gain
        livreur.nombre_livraisons += 1
        livreur.save()
        
        return Response(LivraisonSerializer(livraison).data)

# --- MAP ---
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def map_restaurants(request):
    return nearby_restaurants(request._request)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def map_restaurant_details(request, id):
    try:
        r = RestaurantProfile.objects.get(id=id)
        
        # Obtenir les 3 plats les plus populaires
        plats_populaires = Plat.objects.filter(restaurant=r, is_popular=True, is_available=True)[:3]
        plats_data = [{'id': p.id, 'nom': p.nom, 'prix': p.prix, 'image': p.image.url if p.image else None} for p in plats_populaires]
        
        dto = {
            "id": r.id,
            "nomEtablissement": r.nom,
            "description": r.description,
            "logo": r.logo.url if r.logo else None,
            "cover_image": r.cover_image.url if r.cover_image else None,
            "noteGlobale": r.note_moyenne,
            "isOuvert": r.is_open,
            "tempsLivraisonMoyen": r.temps_livraison_moyen,
            "fraisLivraison": r.frais_livraison,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "adresse": r.adresse,
            "platsPopulaires": plats_data
        }
        return Response(dto)
    except RestaurantProfile.DoesNotExist:
        return Response({"error": "Restaurant introuvable"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def map_restaurants_search(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return Response([])
        
    restaurants = RestaurantProfile.objects.filter(nom__icontains=query, is_open=True, is_verified=True)
    results = []
    for r in restaurants:
        data = {
            "id": r.id,
            "nom": r.nom,
            "categorie": "Restaurant", # default category since we removed categorie from model
            "note": r.note_moyenne,
            "isOuvert": r.is_open,
            "logo": r.logo.url if r.logo else None,
            "latitude": r.latitude,
            "longitude": r.longitude
        }
        results.append(data)
        
    return Response(results)
