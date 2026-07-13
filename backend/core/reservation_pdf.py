# ═══════════════════════════════════════════════════════════
#  Génération du ticket de réservation en PDF (design + QR)
#  En-tête avec le nom et le logo de l'app + le logo du restaurant.
# ═══════════════════════════════════════════════════════════

import io
from pathlib import Path

import qrcode
from django.conf import settings
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

APP_NAME = 'EEUEZ'
APP_TAGLINE = 'Menu · Réservation'

# Palette de marque
ORANGE = (0.949, 0.416, 0.106)
ORANGE_D = (0.90, 0.32, 0.05)
GREEN = (0.122, 0.541, 0.298)
DARK = (0.09, 0.11, 0.13)
GREY = (0.45, 0.48, 0.5)
LIGHT = (0.93, 0.93, 0.93)


def _safe_image(path, max_px=240):
    """ImageReader depuis un chemin fichier, redimensionné pour alléger le PDF.
    Retourne None si absent/illisible."""
    try:
        if not path or not Path(str(path)).exists():
            return None
        from PIL import Image
        img = Image.open(str(path))
        img.thumbnail((max_px, max_px))
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGBA')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return ImageReader(buf)
    except Exception:
        return None


def _qr_image(payload):
    qr = qrcode.QRCode(version=1, box_size=10, border=1,
                       error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return ImageReader(buf)


def _rounded_logo(c, img, x, y, size, radius=3):
    """Dessine un logo dans un cadre blanc arrondi (fond propre)."""
    c.setFillColorRGB(1, 1, 1)
    c.roundRect(x, y, size, size, radius, fill=1, stroke=0)
    if img:
        pad = 1.2 * mm
        c.drawImage(img, x + pad, y + pad, size - 2 * pad, size - 2 * pad,
                    preserveAspectRatio=True, mask='auto')


def generer_ticket_pdf(reservation):
    """Retourne les octets d'un PDF ticket pour une réservation payée."""
    buf = io.BytesIO()
    W, H = A6
    c = canvas.Canvas(buf, pagesize=A6)
    resto = reservation.restaurant

    app_logo = _safe_image(Path(settings.BASE_DIR) / 'static' / 'logo.png')
    resto_logo = _safe_image(resto.logo.path if resto and getattr(resto, 'logo', None) else None)

    # ── Bandeau haut (marque de l'app) ────────────────────────
    band_h = 30 * mm
    c.setFillColorRGB(*ORANGE)
    c.rect(0, H - band_h, W, band_h, fill=1, stroke=0)
    c.setFillColorRGB(*ORANGE_D)
    c.rect(0, H - band_h, W, 2.2 * mm, fill=1, stroke=0)  # liseré bas

    _rounded_logo(c, app_logo, 8 * mm, H - 23 * mm, 15 * mm, radius=4)
    c.setFillColorRGB(1, 1, 1)
    c.setFont('Helvetica-Bold', 19)
    c.drawString(27 * mm, H - 14 * mm, APP_NAME)
    c.setFont('Helvetica', 8)
    c.drawString(27 * mm, H - 19 * mm, APP_TAGLINE)
    c.setFont('Helvetica-Bold', 8.5)
    c.drawRightString(W - 8 * mm, H - 14 * mm, 'TICKET')
    c.drawRightString(W - 8 * mm, H - 18.5 * mm, 'DE RÉSERVATION')

    # ── Restaurant ────────────────────────────────────────────
    ry = H - band_h - 16 * mm
    _rounded_logo(c, resto_logo, 8 * mm, ry, 13 * mm, radius=3)
    if not resto_logo:
        # placeholder vert avec initiale
        c.setFillColorRGB(*GREEN)
        c.roundRect(8 * mm, ry, 13 * mm, 13 * mm, 3, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont('Helvetica-Bold', 14)
        c.drawCentredString(14.5 * mm, ry + 4 * mm, (resto.nom[:1].upper() if resto else 'R'))
    c.setFillColorRGB(*GREY)
    c.setFont('Helvetica', 7.5)
    c.drawString(24 * mm, ry + 8.5 * mm, 'RESTAURANT')
    c.setFillColorRGB(*DARK)
    c.setFont('Helvetica-Bold', 12.5)
    c.drawString(24 * mm, ry + 2.5 * mm, (resto.nom if resto else '—')[:26])

    # ── Détails ───────────────────────────────────────────────
    y = ry - 8 * mm
    c.setStrokeColorRGB(*LIGHT)
    c.setLineWidth(0.6)
    c.line(8 * mm, y, W - 8 * mm, y)
    y -= 8 * mm

    def line(label, value):
        nonlocal y
        c.setFillColorRGB(*GREY)
        c.setFont('Helvetica', 7.5)
        c.drawString(8 * mm, y, label.upper())
        c.setFillColorRGB(*DARK)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(8 * mm, y - 5 * mm, str(value))
        y -= 11.5 * mm

    dt = reservation.date_reservation
    if isinstance(dt, str):
        from django.utils.dateparse import parse_datetime
        dt = parse_datetime(dt) or None
    date_str = dt.strftime('%d/%m/%Y à %H:%M') if hasattr(dt, 'strftime') else str(reservation.date_reservation)

    line('Réservé par', reservation.nom)
    line('Date & heure', date_str)
    line('Nombre de places', f'{reservation.nombre_personnes} personne(s)')
    prix = int(reservation.prix)
    line('Montant', f'{prix} FCFA' if prix > 0 else 'Gratuit')

    # ── QR + code ─────────────────────────────────────────────
    payload = f'EEUEZ-RESA:{reservation.id}:{reservation.code}'
    qr_size = 30 * mm
    c.drawImage(_qr_image(payload), W - qr_size - 8 * mm, 10 * mm, width=qr_size, height=qr_size)

    c.setFillColorRGB(*GREY)
    c.setFont('Helvetica', 7.5)
    c.drawString(8 * mm, 30 * mm, 'CODE')
    c.setFillColorRGB(*GREEN)
    c.setFont('Helvetica-Bold', 20)
    c.drawString(8 * mm, 22 * mm, reservation.code or '—')

    c.setFillColorRGB(*GREY)
    c.setFont('Helvetica', 6.5)
    c.drawString(8 * mm, 6 * mm, 'Présentez ce ticket (QR ou code) à votre arrivée.')

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.getvalue()
