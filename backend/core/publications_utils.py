# ═══════════════════════════════════════════════════════════
#  Règles partagées d'upload des publications
#  Utilisées par le workspace restaurant ET l'API des contributions clients.
# ═══════════════════════════════════════════════════════════

from .models import PublicationMedia

# Il n'y a pas de transcodage côté serveur : on refuse les vidéos trop
# lourdes plutôt que de livrer un flux illisible sur mobile.
MAX_MEDIAS_PAR_PUBLICATION = 10
MAX_TAILLE_VIDEO_MO = 50
MAX_TAILLE_IMAGE_MO = 15

EXTENSIONS_VIDEO = ('.mp4', '.mov', '.webm', '.m4v', '.3gp')

# Liste blanche d'images. Volontairement fermée, et sans SVG :
# les fichiers envoyés sont servis depuis le domaine du site, or un SVG peut
# embarquer du JavaScript — l'ouvrir exécuterait ce script sur notre origine.
# Même raisonnement pour tout format non listé (.html, .js…) : le navigateur
# les interpréterait au lieu de les afficher, ce qui donne un XSS stocké.
EXTENSIONS_IMAGE = ('.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif')

TYPES_MIME_AUTORISES = (
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v',
)


def est_video(fichier):
    """Type MIME d'abord, extension en repli (même logique que la galerie)."""
    ctype = (getattr(fichier, 'content_type', '') or '').lower()
    nom = (getattr(fichier, 'name', '') or '').lower()
    return ctype.startswith('video') or nom.endswith(EXTENSIONS_VIDEO)


def _extension_autorisee(nom):
    nom = (nom or '').lower()
    return nom.endswith(EXTENSIONS_IMAGE) or nom.endswith(EXTENSIONS_VIDEO)


def valider_medias(fichiers):
    """Retourne un message d'erreur en français, ou None si tout est conforme.

    Le contrôle du FORMAT est une mesure de sécurité, pas de confort : les
    fichiers sont servis depuis le domaine du site, donc un format exécutable
    par le navigateur (HTML, SVG…) permettrait d'exécuter du script sur notre
    origine et de voler la session d'un visiteur.
    """
    if len(fichiers) > MAX_MEDIAS_PAR_PUBLICATION:
        return f'{MAX_MEDIAS_PAR_PUBLICATION} médias maximum par publication.'

    for f in fichiers:
        nom = getattr(f, 'name', '') or ''
        if not _extension_autorisee(nom):
            return 'Format non pris en charge. Envoyez une photo (JPG, PNG, WEBP) ou une vidéo (MP4, MOV).'

        # Le type déclaré par le client est vérifié quand il est fourni ;
        # il est falsifiable, d'où le double contrôle avec l'extension.
        ctype = (getattr(f, 'content_type', '') or '').lower()
        if ctype and ctype not in TYPES_MIME_AUTORISES:
            return 'Format non pris en charge. Envoyez une photo (JPG, PNG, WEBP) ou une vidéo (MP4, MOV).'

        taille = getattr(f, 'size', 0) or 0
        if est_video(f):
            if taille > MAX_TAILLE_VIDEO_MO * 1024 * 1024:
                return f'Vidéo trop lourde ({MAX_TAILLE_VIDEO_MO} Mo maximum).'
        elif taille > MAX_TAILLE_IMAGE_MO * 1024 * 1024:
            return f'Image trop lourde ({MAX_TAILLE_IMAGE_MO} Mo maximum).'

    return None


def creer_medias(publication, fichiers):
    """Attache les fichiers à la publication en conservant l'ordre d'envoi."""
    for i, f in enumerate(fichiers):
        PublicationMedia.objects.create(
            publication=publication,
            type='video' if est_video(f) else 'image',
            fichier=f,
            ordre=i,
        )
