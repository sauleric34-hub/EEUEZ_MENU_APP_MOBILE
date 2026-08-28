from core.permissions import EstLivreur
from rest_framework import status, views, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import json
import uuid
import requests as http_requests

from .models import User, RestaurantProfile, Plat, Commande, LigneCommande, Livraison, Avis, Transaction, Reservation
from .models_livraison import ParametrageLivraison
from .serializers import (
    UserSerializer, RestaurantProfileSerializer, PlatSerializer,
    CommandeSerializer, LivraisonSerializer, LivraisonCourseSerializer,
    MissionPoolSerializer,
)
from .utils import geo
from .delivery import (
    finaliser_livraison, prendre_commande_libre, PriseImpossible, TransitionInvalide,
    est_livreur_independant, demarrer_course, recuperer_commande,
    marquer_livree_sans_code, abandonner_livraison, STATUTS_LIBERABLES, STATUTS_ACTIFS,
)
from .complements import resoudre_choix, enregistrer_choix, ComplementInvalide
from .camerpay import initier_paiement as camerpay_initier_paiement, verifier_signature_webhook, STATUT_PAR_CAMERPAY, PAYMENT_METHOD_PAR_MODE
from . import fidelite

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


class LivreurProfileView(views.APIView):
    """Profil livreur : identité + compte mobile money cible des versements."""
    permission_classes = [EstLivreur]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        user = request.user
        for field in ('first_name', 'last_name', 'telephone'):
            if field in request.data:
                setattr(user, field, request.data.get(field) or '')
        if 'paiement_numero' in request.data:
            user.paiement_numero = (request.data.get('paiement_numero') or '').strip()
        if 'paiement_operateur' in request.data:
            op = (request.data.get('paiement_operateur') or '').strip()
            user.paiement_operateur = op if op in ('mtn_money', 'orange_money') else ''
        user.save()
        return Response(UserSerializer(user).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def push_register(request):
    """Enregistre (ou rafraîchit) le jeton de notification push Expo d'un
    appareil. Un même jeton n'appartient qu'à un utilisateur à la fois."""
    from .models_livraison import AppareilPush

    token = (request.data.get('token') or '').strip()
    if not token:
        return Response({'error': 'token manquant'}, status=400)
    plateforme = (request.data.get('platform') or '').strip().lower()[:10]

    AppareilPush.objects.filter(expo_token=token).exclude(user=request.user).delete()
    AppareilPush.objects.update_or_create(
        expo_token=token,
        defaults={'user': request.user, 'plateforme': plateforme},
    )
    return Response({'ok': True})

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

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Création d'une commande.

        Toute la méthode est transactionnelle : si le débit des points échoue
        (solde insuffisant, concurrence), la commande entière est annulée —
        jamais de commande réduite sans points débités, ni l'inverse.
        """
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
        frais_plats = []       # frais de livraison des plats commandés
        for item in items:
            try:
                plat = Plat.objects.get(id=item['plat_id'], restaurant=restaurant)
            except (Plat.DoesNotExist, KeyError):
                continue
            qte = max(1, int(item.get('quantite', 1)))

            # Compléments : le supplément est recalculé depuis la base, jamais
            # repris de la requête — sinon un client modifié se paierait des
            # options gratuites.
            try:
                descriptions, supplement = resoudre_choix(
                    plat, item.get('complements'),
                )
            except ComplementInvalide as e:
                commande.delete()
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

            supplement = int(supplement)
            prix_base = int(plat.prix) + supplement
            # Le supplément s'ajoute après la majoration plateforme : il est
            # reversé au restaurant tel quel, sans commission.
            prix_client = plat.prix_client + supplement

            ligne = LigneCommande.objects.create(
                commande=commande, plat=plat, quantite=qte, prix_unitaire=prix_client,
            )
            enregistrer_choix(ligne, descriptions)

            sous_total_client += prix_client * qte
            sous_total_base += prix_base * qte
            frais_plats.append(float(plat.frais_livraison))

        if sous_total_client == 0:
            commande.delete()
            return Response({"error": "Aucun plat valide dans la commande"}, status=status.HTTP_400_BAD_REQUEST)

        # Frais de livraison = le plus élevé parmi les plats commandés (une seule livraison).
        # Repli sur le frais du restaurant si aucun plat n'en définit.
        frais_liv = max(frais_plats) if frais_plats else float(restaurant.frais_livraison)
        # On FIGE les frais et la part livreur sur la commande : ni le restaurant
        # ni la plateforme ne peuvent les faire varier après coup.
        commande.frais_livraison = int(round(frais_liv))
        commande.part_livreur = ParametrageLivraison.get_solo().part_livreur(frais_liv)
        # Le client paie les plats majorés + la livraison
        commande.montant_total = sous_total_client + frais_liv
        # Le restaurant ne perçoit que ses prix de base ; la majoration revient à la plateforme
        commande.montant_restaurant = sous_total_base
        commande.commission_eeuez = sous_total_client - sous_total_base

        # ── Réduction fidélité ────────────────────────────────────────────
        # Le montant est TOUJOURS recalculé côté serveur : le client demande
        # seulement à utiliser ses points, il n'en fixe jamais la valeur.
        if data.get('utiliser_points'):
            points, reduction = fidelite.calculer_reduction(user, commande.montant_total)
            if reduction > 0:
                mouvement = fidelite.depenser_points(user, commande, points)
                if mouvement:
                    commande.points_utilises = points
                    commande.reduction_points = reduction
                    commande.montant_total = commande.montant_total - reduction
                    # La plateforme finance la réduction sur sa marge : la part
                    # du restaurant et les frais du livreur restent intacts.
                    commande.commission_eeuez = commande.commission_eeuez - reduction

        # Mobile money : commande non confirmée tant que le paiement n'a pas abouti.
        commande.paiement_confirme = (mode_paiement == 'especes')
        commande.save()

        # Trace du paiement (espèces = à encaisser à la livraison)
        Transaction.objects.create(
            commande=commande,
            type='paiement_client',
            montant=commande.montant_total,
            mode_paiement=mode_paiement,
            statut='complete' if mode_paiement == 'especes' else 'en_attente',
        )

        return Response(
            CommandeSerializer(commande, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        """Annule une commande non encore payée (paiement mobile money abandonné)."""
        commande = self.get_object()  # limité aux commandes du client
        if commande.paiement_confirme:
            return Response(
                {'error': 'Commande déjà payée — annulation impossible.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Les points engagés sont rendus avant la destruction de la commande.
        fidelite.rembourser_points(commande)
        commande.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Initiation du paiement mobile money via CamerPay ─────────────────────
    @action(detail=True, methods=['post'], url_path='initier_paiement')
    def initier_paiement(self, request, pk=None):
        """
        POST /api/client/commandes/{id}/initier_paiement/
        Body (optionnel) : { "phone": "6XXXXXXXX" }
        Retourne : { "payment_url": "https://..." }

        Appelle l'API CamerPay (/payment/initiate) côté serveur et retourne
        l'URL de paiement à afficher dans le WebView de l'app mobile.
        Le token API ne quitte jamais le backend.
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

        transaction_uuid, pay_url, error = camerpay_initier_paiement(
            amount=int(commande.montant_total), merchant_invoice_id=payment_ref,
            payment_method=PAYMENT_METHOD_PAR_MODE.get(transaction.mode_paiement, ''),
            customer_phone=phone, customer_email=request.user.email,
            customer_name=f'{request.user.first_name} {request.user.last_name}'.strip(),
            callback_url=f'{settings.APP_BASE_URL}/api/camerpay/notify/',
            return_url=f'{settings.APP_BASE_URL}/payment/success/?ref={payment_ref}',
        )
        if error:
            code = status.HTTP_502_BAD_GATEWAY if 'contacter' in error else status.HTTP_400_BAD_REQUEST
            return Response({'error': error}, status=code)

        transaction.provider_reference = transaction_uuid
        transaction.save(update_fields=['provider_reference'])
        return Response({'payment_url': pay_url, 'payment_ref': payment_ref})

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

        finaliser_livraison(livraison, par='client')
        return Response(CommandeSerializer(commande, context={'request': request}).data)

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
        # Seules les commandes payées (ou espèces) sont visibles du restaurant.
        return Commande.objects.filter(
            restaurant=self.request.user.restaurant_profile, paiement_confirme=True,
        )
        
    @action(detail=True, methods=['put'])
    def accept(self, request, pk=None):
        commande = self.get_object()
        if commande.statut != 'en_attente':
            return Response({"error": "Commande ne peut pas être acceptée"}, status=400)
        commande.statut = 'acceptee'
        commande.save()
        return Response(CommandeSerializer(commande, context={'request': request}).data)

    @action(detail=True, methods=['put'])
    def refuse(self, request, pk=None):
        commande = self.get_object()
        commande.statut = 'refusee'
        commande.notes = request.data.get('raison', commande.notes)
        commande.save()
        return Response(CommandeSerializer(commande, context={'request': request}).data)

# --- LIVREUR ---
class LivreurMissionViewSet(viewsets.ViewSet):
    # EstLivreur (et non IsAuthenticated) : ces actions pilotent une livraison
    # dont dépend le versement des gains. Un compte client ne doit pas y accéder.
    # La finalisation (crédit livreur + déblocage argent resto) n'est JAMAIS
    # déclenchée par le livreur seul : elle passe par le client (code/QR) ou par
    # un admin (validation d'une course « sans code »).
    permission_classes = [EstLivreur]

    def _mission_du_livreur(self, pk):
        """Récupère la livraison SI elle appartient bien à ce livreur.

        Le filtre sur le livreur est le cœur du contrôle : sans lui, un livreur
        authentifié pourrait piloter les missions des autres."""
        return (
            Livraison.objects
            .select_related('commande', 'commande__restaurant', 'commande__client')
            .filter(commande_id=pk, livreur=self.request.user)
            .first()
        )

    def _audit(self, action, livraison, extra=None):
        from .models import AuditLog
        AuditLog.objects.create(
            user=self.request.user, action=action,
            model_name='Livraison', object_id=str(livraison.pk),
            description={'commande': livraison.commande_id, **(extra or {})},
            ip_address=self.request.META.get('REMOTE_ADDR'),
        )

    def _commande_data(self, commande):
        return CommandeSerializer(commande, context={'request': self.request}).data

    def list(self, request):
        """Pool des missions libres, AVANT acceptation — données client
        anonymisées (cf. MissionPoolSerializer). Un livreur attaché à un
        restaurant reçoit ses missions par son restaurant, pas ici."""
        if not est_livreur_independant(request.user):
            return Response([])
        commandes = Commande.objects.filter(
            livraison_libre=True,
            livraison__isnull=True,
            paiement_confirme=True,
            statut__in=STATUTS_LIBERABLES,
        ).select_related('restaurant').prefetch_related('lignes').order_by('created_at')
        return Response(MissionPoolSerializer(commandes, many=True).data)

    @action(detail=False, methods=['get'], url_path='mes_courses')
    def mes_courses(self, request):
        """Missions en cours du livreur — contact client visible (mission
        attribuée)."""
        livraisons = (
            Livraison.objects
            .filter(livreur=request.user, statut__in=STATUTS_ACTIFS)
            .select_related('commande', 'commande__restaurant', 'commande__client')
            .order_by('created_at')
        )
        return Response([
            {**self._commande_data(l.commande),
             'livraison': LivraisonCourseSerializer(l).data}
            for l in livraisons if l.commande
        ])

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        # Prise sûre face à la concurrence (verrou + re-vérification).
        try:
            livraison = prendre_commande_libre(pk, request.user)
        except PriseImpossible as e:
            return Response({"error": str(e)}, status=400)
        self._audit('MISSION_LIBRE_PRISE', livraison)
        return Response(self._commande_data(livraison.commande))

    @action(detail=True, methods=['post'])
    def depart(self, request, pk=None):
        livraison = self._mission_du_livreur(pk)
        if not livraison:
            return Response({"error": "Livraison introuvable"}, status=404)
        try:
            demarrer_course(livraison)
        except TransitionInvalide as e:
            return Response({"error": str(e)}, status=400)
        self._audit('LIVRAISON_DEPART', livraison)
        return Response(self._commande_data(livraison.commande))

    @action(detail=True, methods=['post'])
    def recuperer(self, request, pk=None):
        livraison = self._mission_du_livreur(pk)
        if not livraison:
            return Response({"error": "Livraison introuvable"}, status=404)
        try:
            recuperer_commande(livraison)
        except TransitionInvalide as e:
            return Response({"error": str(e)}, status=400)
        self._audit('LIVRAISON_RECUPEREE', livraison)
        _notifier_client_en_route(livraison)
        data = self._commande_data(livraison.commande)
        data['code_confirmation'] = livraison.code_confirmation
        return Response(data)

    @action(detail=True, methods=['post'], url_path='livrer_sans_code')
    def livrer_sans_code(self, request, pk=None):
        """Filet de sécurité : client injoignable / refuse de scanner. La course
        est close mais RIEN n'est crédité tant qu'un admin n'a pas validé."""
        livraison = self._mission_du_livreur(pk)
        if not livraison:
            return Response({"error": "Livraison introuvable"}, status=404)
        motif = (request.data.get('motif') or '').strip()
        if not motif:
            return Response({"error": "Un motif est obligatoire."}, status=400)
        try:
            marquer_livree_sans_code(livraison, motif)
        except TransitionInvalide as e:
            return Response({"error": str(e)}, status=400)
        return Response(self._commande_data(livraison.commande))

    @action(detail=True, methods=['post'])
    def abandonner(self, request, pk=None):
        livraison = self._mission_du_livreur(pk)
        if not livraison:
            return Response({"error": "Livraison introuvable"}, status=404)
        motif = (request.data.get('motif') or '').strip()
        abandonner_livraison(livraison, motif, auto=False)
        return Response({"ok": True})

    @action(detail=True, methods=['post'])
    def position(self, request, pk=None):
        livraison = self._mission_du_livreur(pk)
        if not livraison:
            return Response({"error": "Livraison introuvable"}, status=404)
        try:
            lat = float(request.data.get('lat'))
            lon = float(request.data.get('lon'))
        except (TypeError, ValueError):
            return Response({"error": "Coordonnées invalides"}, status=400)
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return Response({"error": "Coordonnées hors limites"}, status=400)
        livraison.latitude_actuelle = lat
        livraison.longitude_actuelle = lon
        livraison.save(update_fields=['latitude_actuelle', 'longitude_actuelle'])
        return Response({"ok": True})


def _notifier_client_en_route(livraison):
    try:
        from .push import envoyer_push
    except Exception:
        return
    c = livraison.commande
    if c and c.client_id:
        envoyer_push(
            [c.client], 'Votre livreur est en route',
            'Suivez sa progression en direct dans l\'app.',
            data={'type': 'commande', 'commande_id': c.pk},
        )

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
#  CAMERPAY — Webhook & page de retour
# ═══════════════════════════════════════════════════════════════════════════════

def _camerpay_notify_reservation(payment_ref, statut_interne):
    """Traite la notification CamerPay d'une réservation (ref « RESA-<id> »)."""
    try:
        resa_id = int(payment_ref.split('-')[1])
        resa = Reservation.objects.get(pk=resa_id)
    except (IndexError, ValueError, Reservation.DoesNotExist):
        return HttpResponse('OK')  # ref inconnue → 200 pour stopper les retentatives

    if resa.statut == 'payee':
        return HttpResponse('OK')  # idempotence

    if statut_interne == 'complete':
        if not resa.code:
            resa.code = Livraison.generer_code()
        resa.statut = 'payee'
        resa.save(update_fields=['statut', 'code', 'updated_at'])
    return HttpResponse('OK')


@csrf_exempt
@require_POST
def camerpay_notify(request):
    """
    POST /api/camerpay/notify/
    Webhook serveur-à-serveur envoyé par CamerPay à chaque changement d'état
    d'une transaction. Met à jour le statut de la Transaction et de la Commande
    (ou de la Réservation) en base.

    ⚠️ La doc CamerPay est incohérente selon les pages entre un body
    form-urlencoded (champ `uuid`) et un body JSON (champ `transaction_uuid`) —
    on accepte donc DÉLIBÉRÉMENT les deux formes plutôt que de parier sur l'une
    des deux (voir discussion en session : aucune ne peut être écartée avec
    certitude sans un paiement réel de confirmation).

    Sécurité : la signature HMAC-SHA256 est TOUJOURS vérifiée (pas de bascule
    dev/prod) — sans elle, une référence devinable (ex. « RESA-<id> ») pourrait
    être forgée pour marquer un paiement comme réussi sans payer. Le montant
    reçu est également recontrôlé contre celui attendu en base.
    """
    try:
        if 'application/json' in (request.content_type or ''):
            try:
                params = json.loads(request.body.decode('utf-8') or '{}')
            except (ValueError, UnicodeDecodeError):
                return HttpResponse('JSON invalide', status=400)
        else:
            params = request.POST

        def _champ(*noms):
            for nom in noms:
                valeur = params.get(nom)
                if valeur not in (None, ''):
                    return str(valeur)
            return ''

        txn_uuid        = _champ('uuid', 'transaction_uuid')
        invoice_id      = _champ('invoice_id')
        camerpay_statut = _champ('status')  # pending/processing/completed/failed/cancelled/refunded
        amount_recu     = _champ('amount')
        signature       = _champ('signature') or request.headers.get('X-CamerPay-Signature', '')

        if not invoice_id:
            return HttpResponse('invoice_id manquant', status=400)

        if not verifier_signature_webhook(
            uuid=txn_uuid, invoice_id=invoice_id, status=camerpay_statut,
            amount=amount_recu, signature=signature,
        ):
            return HttpResponse('Signature invalide ou absente', status=403)

        statut_interne = STATUT_PAR_CAMERPAY.get(camerpay_statut)  # None si pending/processing

        # ── Paiement d'une RÉSERVATION (ref « RESA-<id> ») ──────────────────
        if invoice_id.startswith('RESA-'):
            return _camerpay_notify_reservation(invoice_id, statut_interne)

        try:
            txn = Transaction.objects.get(reference=invoice_id)
        except Transaction.DoesNotExist:
            # Référence inconnue — on répond 200 pour éviter les retentatives CamerPay
            return HttpResponse('OK')

        # Idempotence : ne pas retraiter une transaction déjà finalisée
        if txn.statut == 'complete':
            return HttpResponse('OK')

        # Vérifie que le montant payé correspond bien à celui attendu
        try:
            if amount_recu and int(float(amount_recu)) != int(txn.montant):
                return HttpResponse('Montant incohérent', status=400)
        except (TypeError, ValueError):
            pass

        if not txn.provider_reference and txn_uuid:
            txn.provider_reference = txn_uuid

        if statut_interne == 'complete':
            txn.statut = 'complete'
            txn.save(update_fields=['statut', 'provider_reference'])
            # Paiement confirmé → la commande devient visible du restaurant.
            commande = txn.commande
            if commande and not commande.paiement_confirme:
                commande.paiement_confirme = True
                commande.save(update_fields=['paiement_confirme', 'updated_at'])
                # Si le restaurant l'avait déjà confiée au pool, elle n'était
                # pas notifiable tant qu'impayée : on prévient maintenant.
                if commande.livraison_libre and not hasattr(commande, 'livraison'):
                    try:
                        from .views.resto_ws import _notifier_pool_nouvelle_mission
                        _notifier_pool_nouvelle_mission(commande)
                    except Exception:
                        pass
        elif statut_interne in ('echouee', 'remboursee'):
            txn.statut = statut_interne
            txn.save(update_fields=['statut', 'provider_reference'])
        else:
            txn.save(update_fields=['provider_reference'])

        return HttpResponse('OK')
    except Exception:
        return HttpResponse('Erreur interne', status=500)


def camerpay_return(request):
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


def camerpay_failed(request):
    """
    GET /payment/failed/
    Page de retour en cas d'échec / annulation. Le WebView de l'app la détecte
    pour fermer le widget et informer l'utilisateur.
    """
    html = """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement échoué — EEUEZ</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; display: flex; flex-direction: column; align-items: center;
           justify-content: center; background: #0d1117; font-family: -apple-system, sans-serif; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 24px;
            padding: 48px 36px; text-align: center; max-width: 360px; width: 90%; }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #f85149; font-size: 22px; margin-bottom: 10px; }
    p  { color: #8b949e; font-size: 15px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Paiement échoué</h1>
    <p>Le paiement n'a pas abouti ou a été annulé.<br>Vous pouvez réessayer depuis l'application.</p>
  </div>
</body>
</html>"""
    return HttpResponse(html, content_type='text/html')
