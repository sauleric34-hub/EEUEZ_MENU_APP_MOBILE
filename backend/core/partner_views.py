# ═══════════════════════════════════════════════════════════
#  API Partenaires — surface publique (/api/partners/v1/)
#
#  Espace SÉPARÉ de core/api_urls.py (app mobile) : authentification,
#  sérialiseurs et throttling propres, pour ne jamais partager d'état ni de
#  contrat avec l'API interne. Voir le plan d'architecture pour le détail
#  des choix (clé + HMAC plutôt qu'OAuth2, commandes en espèces uniquement
#  en V1, etc.).
# ═══════════════════════════════════════════════════════════

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import (
    api_view, authentication_classes, permission_classes, throttle_classes, throttle_scope,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .checkout_groupe import RestaurantExclu, construire_commande, enregistrer_transaction_paiement
from .models import Categorie, Commande, DocumentKYB, Plat, RestaurantProfile
from .partner_auth import PartnerAPIKeyAuthentication
from .partner_emails import email_candidature_recue
from .partner_serializers import (
    DemandePartenaireSerializer, PartenaireCommandeSerializer, PartenairePlatSerializer,
    PartenaireRestaurantProfileSerializer,
)
from .permissions import AutoriseEcritureCommandes, EstPartenaireActif
from .partner_throttling import PartnerRateThrottle
from .models_partenaire import valider_document_kyb
from .serializers import CategorieSerializer

PARTNER_AUTH = [PartnerAPIKeyAuthentication]
PARTNER_PERM = [EstPartenaireActif]

# Champs de fichier acceptés pour la candidature — un mapping explicite plutôt
# qu'un upload générique : chaque document a un type métier connu d'avance.
CHAMPS_DOCUMENTS = {
    'fichier_rccm': DocumentKYB.TYPE_RCCM,
    'fichier_niu': DocumentKYB.TYPE_NIU,
    'fichier_piece_identite': DocumentKYB.TYPE_PIECE_IDENTITE,
    'fichier_autre': DocumentKYB.TYPE_AUTRE,
}


def _coord(v):
    try:
        return round(float(v), 6)
    except (TypeError, ValueError):
        return None


# ─── Candidature KYB (front door, sans clé) ───────────────────
@extend_schema(
    tags=['Candidature'], auth=[], request=DemandePartenaireSerializer,
    summary="Déposer une candidature partenaire (KYB)",
    description=(
        "Aucune authentification. Champs Partenaire en multipart/form-data, "
        "plus les fichiers optionnels fichier_rccm / fichier_niu / "
        "fichier_piece_identite / fichier_autre (PDF/JPG/PNG, 10 Mo max)."
    ),
    responses={201: OpenApiTypes.OBJECT},
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([PartnerRateThrottle])
@throttle_scope('partner_apply')
def deposer_candidature(request):
    """
    POST /api/partners/v1/apply
    multipart/form-data : champs Partenaire + fichiers optionnels
    (fichier_rccm, fichier_niu, fichier_piece_identite, fichier_autre).

    Aucune authentification : c'est la porte d'entrée avant tout accès.
    Throttle bas et dédié pour ne pas devenir un vecteur de spam vers la
    file de revue admin.
    """
    serializer = DemandePartenaireSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    fichiers_valides = {}
    for champ, type_document in CHAMPS_DOCUMENTS.items():
        fichier = request.FILES.get(champ)
        if fichier:
            try:
                valider_document_kyb(fichier)
            except ValidationError as e:
                return Response({'error': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
            fichiers_valides[type_document] = fichier

    with transaction.atomic():
        partenaire = serializer.save()
        for type_document, fichier in fichiers_valides.items():
            DocumentKYB.objects.create(partenaire=partenaire, type_document=type_document, fichier=fichier)

    email_candidature_recue(partenaire)

    return Response(
        {
            'id': partenaire.id,
            'statut': partenaire.statut,
            'message': "Candidature reçue. Un identifiant API vous sera communiqué après vérification.",
        },
        status=status.HTTP_201_CREATED,
    )


# ─── Catalogue (lecture) ──────────────────────────────────────
@extend_schema(
    tags=['Catalogue'], responses=PartenaireRestaurantProfileSerializer(many=True),
    summary="Lister les restaurants",
    parameters=[OpenApiParameter('q', OpenApiTypes.STR, description='Recherche par nom', required=False)],
)
@api_view(['GET'])
@authentication_classes(PARTNER_AUTH)
@permission_classes(PARTNER_PERM)
@throttle_classes([PartnerRateThrottle])
@throttle_scope('partner_catalog')
def restaurants_list(request):
    qs = RestaurantProfile.objects.filter(is_open=True, is_verified=True).prefetch_related('paliers_livraison').order_by('-id')
    q = request.GET.get('q', '').strip()
    if q:
        qs = qs.filter(nom__icontains=q)
    return Response(PartenaireRestaurantProfileSerializer(qs, many=True, context={'request': request}).data)


@extend_schema(tags=['Catalogue'], responses=PartenaireRestaurantProfileSerializer, summary="Détail d'un restaurant + ses plats")
@api_view(['GET'])
@authentication_classes(PARTNER_AUTH)
@permission_classes(PARTNER_PERM)
@throttle_classes([PartnerRateThrottle])
@throttle_scope('partner_catalog')
def restaurant_detail(request, id):
    try:
        r = RestaurantProfile.objects.get(id=id, is_verified=True)
    except RestaurantProfile.DoesNotExist:
        return Response({'error': 'Restaurant introuvable'}, status=status.HTTP_404_NOT_FOUND)
    data = PartenaireRestaurantProfileSerializer(r, context={'request': request}).data
    plats = Plat.objects.filter(restaurant=r, is_available=True, is_visible=True)
    data['plats'] = PartenairePlatSerializer(plats, many=True, context={'request': request}).data
    return Response(data)


@extend_schema(
    tags=['Catalogue'], responses=PartenairePlatSerializer(many=True), summary="Lister les plats",
    parameters=[
        OpenApiParameter('restaurant', OpenApiTypes.INT, description='Filtrer par restaurant', required=False),
        OpenApiParameter('categorie', OpenApiTypes.STR, description='Filtrer par nom de catégorie', required=False),
        OpenApiParameter('q', OpenApiTypes.STR, description='Recherche par nom', required=False),
    ],
)
@api_view(['GET'])
@authentication_classes(PARTNER_AUTH)
@permission_classes(PARTNER_PERM)
@throttle_classes([PartnerRateThrottle])
@throttle_scope('partner_catalog')
def plats_list(request):
    qs = Plat.objects.filter(
        is_available=True, is_visible=True, restaurant__is_verified=True,
    ).select_related('restaurant', 'categorie')
    restaurant = request.GET.get('restaurant')
    categorie = request.GET.get('categorie')
    q = request.GET.get('q', '').strip()
    if restaurant:
        qs = qs.filter(restaurant_id=restaurant)
    if categorie:
        qs = qs.filter(categorie__nom__iexact=categorie)
    if q:
        qs = qs.filter(nom__icontains=q)
    return Response(PartenairePlatSerializer(qs.order_by('-id'), many=True, context={'request': request}).data)


@extend_schema(tags=['Catalogue'], responses=PartenairePlatSerializer, summary="Détail d'un plat")
@api_view(['GET'])
@authentication_classes(PARTNER_AUTH)
@permission_classes(PARTNER_PERM)
@throttle_classes([PartnerRateThrottle])
@throttle_scope('partner_catalog')
def plat_detail(request, id):
    try:
        p = Plat.objects.select_related('restaurant', 'categorie').get(id=id, restaurant__is_verified=True)
    except Plat.DoesNotExist:
        return Response({'error': 'Plat introuvable'}, status=status.HTTP_404_NOT_FOUND)
    return Response(PartenairePlatSerializer(p, context={'request': request}).data)


@extend_schema(tags=['Catalogue'], responses=CategorieSerializer(many=True), summary="Lister les catégories de plats")
@api_view(['GET'])
@authentication_classes(PARTNER_AUTH)
@permission_classes(PARTNER_PERM)
@throttle_classes([PartnerRateThrottle])
@throttle_scope('partner_catalog')
def categories_list(request):
    return Response(CategorieSerializer(Categorie.objects.all().order_by('id'), many=True).data)


# ─── Commandes (écriture) ─────────────────────────────────────
@extend_schema(
    tags=['Commandes'], request=OpenApiTypes.OBJECT,
    responses={201: PartenaireCommandeSerializer, 200: PartenaireCommandeSerializer},
    summary="Créer une commande (réservé aux plans avec écriture de commandes)",
    description=(
        "V1 : mono-restaurant, mode_paiement='especes' uniquement. "
        "reference_externe est obligatoire et sert de clé d'idempotence."
    ),
    examples=[OpenApiExample(
        'Commande à emporter', value={
            'restaurant': 12, 'reference_externe': 'ORD-2026-000123',
            'items': [{'plat_id': 45, 'quantite': 2}],
            'emporter': True, 'mode_paiement': 'especes', 'notes': 'Sans piment',
        }, request_only=True,
    )],
)
@api_view(['POST'])
@authentication_classes(PARTNER_AUTH)
@permission_classes(PARTNER_PERM + [AutoriseEcritureCommandes])
@throttle_classes([PartnerRateThrottle])
@throttle_scope('partner_orders')
def creer_commande(request):
    """
    POST /api/partners/v1/commandes
    Body : { restaurant, reference_externe, items:[{plat_id, quantite, complements}],
             emporter, adresse_livraison, latitude, longitude, notes }

    V1 : mono-restaurant, paiement 'especes' uniquement (le partenaire a déjà
    encaissé son client final, ou paiement à la livraison/au retrait) — pas
    de collecte Mobile Money CamerPay pour le compte d'un tiers en V1.

    `reference_externe` est OBLIGATOIRE et sert de clé d'idempotence : une
    relance réseau avec la même valeur renvoie la commande déjà créée (200)
    au lieu d'en créer une deuxième.
    """
    data = request.data
    partenaire = request.partenaire

    reference_externe = str(data.get('reference_externe') or '').strip()
    if not reference_externe:
        return Response({'error': 'reference_externe requis'}, status=status.HTTP_400_BAD_REQUEST)

    existante = Commande.objects.filter(partenaire=partenaire, reference_externe=reference_externe).first()
    if existante:
        return Response(PartenaireCommandeSerializer(existante, context={'request': request}).data, status=status.HTTP_200_OK)

    mode_paiement = str(data.get('mode_paiement') or 'especes')
    if mode_paiement != 'especes':
        return Response(
            {'error': "Seul le mode de paiement 'especes' est accepté pour les commandes partenaires en V1."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    restaurant_id = data.get('restaurant')
    try:
        restaurant = RestaurantProfile.objects.get(id=restaurant_id, is_verified=True)
    except RestaurantProfile.DoesNotExist:
        return Response({'error': 'Restaurant introuvable'}, status=status.HTTP_404_NOT_FOUND)

    items = data.get('items', [])
    if not items:
        return Response({'error': 'Le panier est vide'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            commande = construire_commande(
                user=None, restaurant=restaurant, items=items,
                adresse_livraison=data.get('adresse_livraison', ''),
                latitude=_coord(data.get('latitude')), longitude=_coord(data.get('longitude')),
                notes=data.get('notes', ''), mode_paiement=mode_paiement,
                emporter=bool(data.get('emporter')),
            )
            commande.partenaire = partenaire
            commande.reference_externe = reference_externe
            taux = partenaire.plan_config['commission_pourcentage']
            if taux:
                commande.commission_partenaire = round(int(commande.montant_total) * taux / 100)
            commande.save(update_fields=['partenaire', 'reference_externe', 'commission_partenaire'])
            enregistrer_transaction_paiement(commande, mode_paiement)
    except RestaurantExclu as e:
        return Response({'error': e.message, 'motif': e.motif}, status=status.HTTP_400_BAD_REQUEST)
    except IntegrityError:
        # Course rare entre deux relances quasi simultanées de la même
        # reference_externe : la contrainte DB a tranché, on sert le gagnant.
        existante = Commande.objects.filter(partenaire=partenaire, reference_externe=reference_externe).first()
        if existante:
            return Response(PartenaireCommandeSerializer(existante, context={'request': request}).data, status=status.HTTP_200_OK)
        raise

    return Response(PartenaireCommandeSerializer(commande, context={'request': request}).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=['Commandes'], responses=PartenaireCommandeSerializer, summary="Statut d'une de vos commandes")
@api_view(['GET'])
@authentication_classes(PARTNER_AUTH)
@permission_classes(PARTNER_PERM)
@throttle_classes([PartnerRateThrottle])
@throttle_scope('partner_orders')
def commande_detail(request, id):
    try:
        commande = Commande.objects.get(id=id, partenaire=request.partenaire)
    except Commande.DoesNotExist:
        return Response({'error': 'Commande introuvable'}, status=status.HTTP_404_NOT_FOUND)
    return Response(PartenaireCommandeSerializer(commande, context={'request': request}).data)
