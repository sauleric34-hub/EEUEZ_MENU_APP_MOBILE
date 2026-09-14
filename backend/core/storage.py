# ═══════════════════════════════════════════════════════════
#  Stockage de fichiers tolérant aux noms accentués
#  Certains hébergements tournent en locale ASCII/POSIX : y écrire
#  un fichier au nom accentué (« téléchargement.png ») lève une
#  UnicodeEncodeError. On translittère donc tout nom de fichier en
#  ASCII avant l'enregistrement (é→e, à→a, …).
# ═══════════════════════════════════════════════════════════

import os
import unicodedata
import uuid

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.text import get_valid_filename


class ASCIIFileSystemStorage(FileSystemStorage):
    def get_valid_name(self, name):
        # Translittère les accents puis retire tout caractère non-ASCII.
        name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
        name = get_valid_filename(name)
        root, ext = os.path.splitext(name)
        if not root:  # nom devenu vide (ex. fichier uniquement en caractères non latins)
            root = uuid.uuid4().hex[:12]
        return super().get_valid_name(root + ext)


class DocumentKYBStorage(ASCIIFileSystemStorage):
    """Stockage DÉDIÉ des pièces KYB (CNI, RCCM…) des partenaires API.

    Racine délibérément HORS de MEDIA_ROOT et sans `base_url` : la route
    `re_path(r'^media/...')` (backend/urls.py) sert tout MEDIA_ROOT sans
    authentification — adapté à un logo de restaurant, pas à une pièce
    d'identité. En vivant hors de cet arbre, ces fichiers ne sont JAMAIS
    accessibles par cette route, quel que soit le chemin deviné. Le seul accès
    passe par la vue `admin_required` qui les stream (core/views/partenaires_admin.py).
    """
    def __init__(self):
        super().__init__(location=str(settings.BASE_DIR / 'kyb_private'), base_url=None)

    def url(self, name):
        raise NotImplementedError(
            "Les pièces KYB n'ont pas d'URL publique — servez-les via une vue admin_required."
        )


kyb_storage = DocumentKYBStorage()
