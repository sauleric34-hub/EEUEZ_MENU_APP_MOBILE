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
