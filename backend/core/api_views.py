from rest_framework import status, views, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import hashlib
import hmac
import json
import uuid
import requests as http_requests

from .models import User, RestaurantProfile, Plat, Commande, LigneCommande, Livraison, Avis, Transaction
from .serializers import (
    UserSerializer, RestaurantProfileSerializer, PlatSerializer, 
    CommandeSerializer, LivraisonSerializer
)
from .utils import geo
from .delivery import finaliser_livraison

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

        sous_total_client = 0  # ce que paie le client (prix de base + %)
        sous_total_base = 0    # ce qui revient au restaurant (prix de base)
        for item in items:
            try:
                plat = Plat.objects.get(id=item['plat_id'], restaurant=restaurant)
            except (Plat.DoesNotExist, KeyError):
                continue
            qte = max(1, int(item.get('quantite', 1)))
            prix_base = int(plat.prix)
            prix_client = plat.prix_client  # prix de base majoré du pourcentage
            LigneCommande.objects.create(
                commande=commande, plat=plat, quantite=qte, prix_unitaire=prix_client,
            )
            sous_total_client += prix_client * qte
            sous_total_base += prix_base * qte

        if sous_total_client == 0:
            commande.delete()
            return Response({"error": "Aucun plat valide dans la commande"}, status=status.HTTP_400_BAD_REQUEST)

        frais_liv = float(restaurant.frais_livraison)
        # Le client paie les plats majorés + la livraison
        commande.montant_total = sous_total_client + frais_liv
        # Le restaurant ne perçoit que ses prix de base ; la majoration revient à la plateforme
        commande.montant_restaurant = sous_total_base
        commande.commission_eeuez = sous_total_client - sous_total_base
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

    # ── Initiation du paiement mobile money via Monetbil ─────────────────────
    @action(detail=True, methods=['post'], url_path='initier_paiement')
    def initier_paiement(self, request, pk=None):
        """
        POST /api/client/commandes/{id}/initier_paiement/
        Body (optionnel) : { "phone": "6XXXXXXXX" }
        Retourne : { "payment_url": "https://..." }

        Appelle l'API Monetbil Widget v2.1 côté serveur et retourne
        l'URL de paiement à afficher dans le WebView de l'app mobile.
        Le service_secret ne quitte jamais le backend.
        """
        commande = self.get_object()  # vérifie que la commande appartient au client
        transaction = Transaction.objects.filter(
            commande=commande,
            mode_paiement__in=['mtn_money', 'orange_money'],
            statut='en_attente',
        ).first()
        if not transaction:
            return Response(
                {'error': 'Aucune transaction mobile money en attente pour cette commande.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Référence unique : on réutilise celle déjà stockée ou on en génère une
        payment_ref = transaction.reference or f'EEUEZ-{commande.id}-{uuid.uuid4().hex[:8].upper()}'
        if not transaction.reference:
            transaction.reference = payment_ref
            transaction.save(update_fields=['reference'])

        phone = (request.data.get('phone') or '').strip() or getattr(request.user, 'telephone', '') or ''

        service_key = settings.MONETBIL_SERVICE_KEY
        app_base    = settings.APP_BASE_URL
        notify_url  = f'{app_base}/api/monetbil/notify/'
        return_url  = f'{app_base}/payment/success/?ref={payment_ref}'

        payload = {
            'amount':      int(commande.montant_total),
            'currency':    'XAF',
            'country':     'CM',
            'locale':      'fr',
            'payment_ref': payment_ref,
            'item_ref':    str(commande.id),
            'notify_url':  notify_url,
            'return_url':  return_url,
            'email':       request.user.email or '',
            'first_name':  request.user.first_name or '',
            'last_name':   request.user.last_name or '',
        }
        if phone:
            payload['phone'] = phone

        try:
            resp = http_requests.post(
                f'https://api.monetbil.com/widget/v2.1/{service_key}',
                data=payload,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            return Response(
                {'error': f'Impossible de contacter Monetbil : {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not data.get('success'):
            return Response(
                {'error': data.get('message', 'Échec initialisation paiement Monetbil')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'payment_url': data['payment_url'], 'payment_ref': payment_ref})

    @action(detail=True, methods=['post'])
    def confirmer_reception(self, request, pk=None):
        """Le client confirme avoir reçu sa commande en scannant le QR du
        livreur ou en saisissant le code. Cela termine la livraison et
        débloque l'argent du restaurant."""
        commande = self.get_object()  # limité aux commandes du client (get_queryset)
        livraison = getattr(commande, 'livraison', None)
        if not livraison or livraison.statut != 'en_livraison':
            return Response(
                {"error": "Cette commande n'est pas en cours de livraison."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Le QR encode « EEUEZ:<id>:<code> » ; on accepte aussi le code seul.
        raw = (request.data.get('code') or '').strip().upper()
        code = raw.split(':')[-1] if ':' in raw else raw
        if not livraison.code_confirmation or code != livraison.code_confirmation:
            return Response(
                {"error": "Code de confirmation invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        finaliser_livraison(livraison)
        return Response(CommandeSerializer(commande).data)

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

        # Finalise via le helper partagé (crédite le livreur, débloque l'argent resto)
        finaliser_livraison(livraison)
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


# ═══════════════════════════════════════════════════════════════════════════════
#  MONETBIL — Webhook & page de retour
# ═══════════════════════════════════════════════════════════════════════════════

@csrf_exempt
@require_POST
def monetbil_notify(request):
    """
    POST /api/monetbil/notify/
    Callback serveur-à-serveur envoyé par Monetbil après chaque tentative de paiement.
    Met à jour le statut de la Transaction et de la Commande en base.
    """
    try:
        # Monetbil envoie les données en form-urlencoded
        payment_ref  = request.POST.get('payment_ref', '')
        payment_status = request.POST.get('status', '')   # 'success' | 'failed' | 'cancelled'
        transaction_id = request.POST.get('transaction_id', '')

        if not payment_ref:
            return HttpResponse('payment_ref manquant', status=400)

        try:
            txn = Transaction.objects.get(reference=payment_ref)
        except Transaction.DoesNotExist:
            # Référence inconnue — on répond 200 pour éviter les retentatives Monetbil
            return HttpResponse('OK')

        if payment_status == 'success':
            txn.statut = 'complete'
            txn.save(update_fields=['statut'])
            # Marque la commande comme payée (passe en_attente → déjà en_attente mais paiement OK)
            commande = txn.commande
            if commande and commande.statut == 'en_attente':
                # Le paiement est confirmé ; le restaurant peut maintenant la voir
                commande.statut = 'en_attente'   # inchangé, c'est le resto qui l'accepte
                commande.save(update_fields=['statut'])
        elif payment_status in ('failed', 'cancelled'):
            txn.statut = 'echouee'
            txn.save(update_fields=['statut'])

        return HttpResponse('OK')
    except Exception:
        return HttpResponse('Erreur interne', status=500)


def monetbil_return(request):
    """
    GET /payment/success/?ref=EEUEZ-xxx
    Page de retour après paiement. Le WebView de l'app mobile surveille cette URL.
    """
    ref = request.GET.get('ref', '')
    success = False
    if ref:
        txn = Transaction.objects.filter(reference=ref, statut='complete').first()
        success = txn is not None

    if success:
        html = """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement réussi — EEUEZ</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; display: flex; flex-direction: column; align-items: center;
           justify-content: center; background: #0d1117; font-family: -apple-system, sans-serif; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 24px;
            padding: 48px 36px; text-align: center; max-width: 360px; width: 90%; }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #58a6ff; font-size: 22px; margin-bottom: 10px; }
    p  { color: #8b949e; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Paiement réussi !</h1>
    <p>Votre commande a été confirmée.<br>Vous pouvez suivre sa progression dans l'application.</p>
  </div>
</body>
</html>"""
    else:
        html = """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement en cours — EEUEZ</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; display: flex; flex-direction: column; align-items: center;
           justify-content: center; background: #0d1117; font-family: -apple-system, sans-serif; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 24px;
            padding: 48px 36px; text-align: center; max-width: 360px; width: 90%; }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #f0883e; font-size: 22px; margin-bottom: 10px; }
    p  { color: #8b949e; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⏳</div>
    <h1>Vérification en cours</h1>
    <p>Votre paiement est en cours de validation.<br>Retournez dans l'application pour suivre l'état de votre commande.</p>
  </div>
</body>
</html>"""

    return HttpResponse(html, content_type='text/html')
