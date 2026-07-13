# ═══════════════════════════════════════════════════════════
#  Vues API — Galerie du restaurant & Réservations de table
# ═══════════════════════════════════════════════════════════

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse

from .models import RestaurantProfile, RestaurantMedia, Reservation, Plat, Livraison
from .serializers import RestaurantMediaSerializer, ReservationSerializer
from .monetbil import initier_widget
from .reservation_pdf import generer_ticket_pdf


# ─── GALERIE ─────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def galerie(request, id):
    """Galerie d'un restaurant : médias (photos/vidéos) + photos de ses plats."""
    try:
        resto = RestaurantProfile.objects.get(id=id)
    except RestaurantProfile.DoesNotExist:
        return Response({'error': 'Restaurant introuvable'}, status=status.HTTP_404_NOT_FOUND)

    medias = RestaurantMediaSerializer(resto.medias.all(), many=True).data
    # Photos des plats (image principale + galerie de chaque plat)
    plats_photos = []
    for plat in resto.plats.filter(is_visible=True):
        if plat.image:
            plats_photos.append({'type': 'image', 'url': plat.image.url, 'legende': plat.nom})
        for ph in plat.photos.all():
            if ph.image:
                plats_photos.append({'type': 'image', 'url': ph.image.url, 'legende': plat.nom})

    return Response({'medias': medias, 'plats_photos': plats_photos})


# ─── RÉSERVATIONS (client) ───────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def reservations(request):
    """GET : mes réservations. POST : créer une réservation (statut en_attente)."""
    if request.method == 'GET':
        qs = Reservation.objects.filter(client=request.user)
        return Response(ReservationSerializer(qs, many=True).data)

    data = request.data
    try:
        resto = RestaurantProfile.objects.get(id=data.get('restaurant'))
    except RestaurantProfile.DoesNotExist:
        return Response({'error': 'Restaurant introuvable'}, status=status.HTTP_404_NOT_FOUND)

    date_reservation = data.get('date_reservation')  # ISO « YYYY-MM-DDTHH:MM »
    if not date_reservation:
        return Response({'error': 'Date et heure requises.'}, status=status.HTTP_400_BAD_REQUEST)

    nom = (data.get('nom') or '').strip() or request.user.get_full_name() or request.user.username
    try:
        nombre = max(1, int(data.get('nombre_personnes', 1)))
    except (TypeError, ValueError):
        nombre = 1

    resa = Reservation.objects.create(
        client=request.user, restaurant=resto, nom=nom,
        date_reservation=date_reservation, nombre_personnes=nombre,
        notes=(data.get('notes') or '').strip(),
        prix=resto.prix_reservation,  # prix par défaut ; le resto peut l'ajuster à l'acceptation
        statut='en_attente',
    )
    return Response(ReservationSerializer(resa).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reservation_payer(request, id):
    """Initie le paiement Monetbil d'une réservation ACCEPTÉE."""
    try:
        resa = Reservation.objects.get(id=id, client=request.user)
    except Reservation.DoesNotExist:
        return Response({'error': 'Réservation introuvable'}, status=status.HTTP_404_NOT_FOUND)

    if resa.statut != 'acceptee':
        return Response(
            {'error': "Cette réservation n'est pas encore acceptée par le restaurant."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Réservation gratuite (prix 0) → confirmée directement, sans paiement.
    if int(resa.prix) <= 0:
        if not resa.code:
            resa.code = Livraison.generer_code()
        resa.statut = 'payee'
        resa.save(update_fields=['statut', 'code', 'updated_at'])
        return Response({'free': True})

    phone = (request.data.get('phone') or '').strip() or getattr(request.user, 'telephone', '') or ''
    payment_url, error = initier_widget(
        amount=int(resa.prix), payment_ref=f'RESA-{resa.id}', item_ref=resa.id,
        email=request.user.email, first_name=request.user.first_name,
        last_name=request.user.last_name, phone=phone,
    )
    if error:
        code = status.HTTP_502_BAD_GATEWAY if 'contacter' in error else status.HTTP_400_BAD_REQUEST
        return Response({'error': error}, status=code)
    return Response({'payment_url': payment_url, 'payment_ref': f'RESA-{resa.id}'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def reservation_ticket(request, id):
    """Ticket PDF (avec QR) d'une réservation payée."""
    try:
        resa = Reservation.objects.get(id=id, client=request.user)
    except Reservation.DoesNotExist:
        return Response({'error': 'Réservation introuvable'}, status=status.HTTP_404_NOT_FOUND)

    if resa.statut != 'payee':
        return Response({'error': 'Ticket disponible seulement après paiement.'},
                        status=status.HTTP_400_BAD_REQUEST)

    pdf = generer_ticket_pdf(resa)
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="ticket-reservation-{resa.id}.pdf"'
    return response
