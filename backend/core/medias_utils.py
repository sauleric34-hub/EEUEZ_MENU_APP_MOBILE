"""Fabrication des dérivés d'image (aperçu léger + placeholder flou).

Pourquoi : une photo de téléphone pèse 3 à 5 Mo en 4000×3000 px, alors qu'elle
s'affiche dans un carré de ~400 px. Servir l'original, c'est faire télécharger
cent fois trop d'octets sur un réseau mobile — d'où les secondes d'attente.

On produit donc deux dérivés à l'enregistrement :
  • un aperçu    : JPEG progressif ~1080 px, ce que le fil affiche réellement ;
  • un flou      : miniature de 24 px encodée en base64, livrée AVEC le JSON.

Le flou tient en quelques centaines d'octets : il s'affiche instantanément, et
l'aperçu se fond par-dessus une fois chargé. C'est la technique qui donne
l'impression d'un fil « déjà là » plutôt que d'une grille de carrés vides.
"""

import base64
from io import BytesIO

from django.core.files.base import ContentFile
from django.db import models
from PIL import Image as PILImage, ImageOps

# Largeur cible de l'aperçu. 1080 px couvre les écrans à forte densité sans
# excès : au-delà, l'œil ne distingue plus rien sur un téléphone.
LARGEUR_APERCU = 1080
QUALITE_APERCU = 82

# Taille du placeholder flou. 24 px suffisent : il est de toute façon étiré et
# flouté à l'affichage, et l'on veut rester sous le kilooctet.
TAILLE_FLOU = 24
QUALITE_FLOU = 40


def _ouvrir_redresse(fichier):
    """Ouvre l'image et corrige son orientation.

    exif_transpose est indispensable : sans lui, les photos prises en portrait
    s'affichent couchées, car les téléphones enregistrent le capteur tel quel
    et décrivent la rotation dans l'EXIF.
    """
    fichier.open('rb')
    try:
        image = PILImage.open(fichier)
        image = ImageOps.exif_transpose(image)
        # Convertit en RGB : le JPEG ne gère ni la transparence ni les palettes.
        # Un PNG transparent serait sinon rendu avec un fond noir.
        if image.mode in ('RGBA', 'LA', 'P'):
            fond = PILImage.new('RGB', image.size, (255, 255, 255))
            image = image.convert('RGBA')
            fond.paste(image, mask=image.split()[-1])
            image = fond
        else:
            image = image.convert('RGB')
        image.load()
        return image
    finally:
        fichier.close()


def fabriquer_apercu(fichier):
    """Renvoie (ContentFile JPEG, flou_base64), ou (None, '') si illisible.

    Ne lève jamais : un fichier corrompu ou un format exotique ne doit pas
    faire échouer la publication. On retombe alors sur l'original.
    """
    try:
        image = _ouvrir_redresse(fichier)
    except Exception:
        return None, ''

    try:
        if image.width > LARGEUR_APERCU:
            hauteur = round(image.height * LARGEUR_APERCU / image.width)
            image = image.resize((LARGEUR_APERCU, hauteur), PILImage.LANCZOS)

        tampon = BytesIO()
        # progressive=True : l'image s'affine de haut en bas pendant le
        # téléchargement au lieu de rester blanche jusqu'au dernier octet.
        image.save(
            tampon, format='JPEG', quality=QUALITE_APERCU,
            optimize=True, progressive=True,
        )
        apercu = ContentFile(tampon.getvalue())

        return apercu, fabriquer_flou(image)
    except Exception:
        return None, ''


def fabriquer_flou(image):
    """Miniature encodée en data-URI, à afficher pendant le chargement."""
    try:
        petite = image.copy()
        petite.thumbnail((TAILLE_FLOU, TAILLE_FLOU), PILImage.LANCZOS)
        tampon = BytesIO()
        petite.save(tampon, format='JPEG', quality=QUALITE_FLOU)
        encode = base64.b64encode(tampon.getvalue()).decode('ascii')
        return f'data:image/jpeg;base64,{encode}'
    except Exception:
        return ''


def chemin_apercu(instance, nom_fichier):
    """Range les aperçus par modèle : apercus/plat/12.jpg.

    Sans cette séparation, un Plat et un PublicationMedia de même identifiant
    viseraient tous deux « apercus/12.jpg ».
    """
    modele = instance._meta.model_name
    return f'apercus/{modele}/{nom_fichier}'


class ApercuMixin(models.Model):
    """Ajoute un aperçu allégé + un placeholder flou à un modèle porteur d'image.

    Les classes filles indiquent le champ source via SOURCE_IMAGE et le dossier
    de destination via DOSSIER_APERCU.
    """

    # Nom du champ contenant le fichier d'origine.
    SOURCE_IMAGE = 'image'

    apercu = models.ImageField(upload_to=chemin_apercu, null=True, blank=True)
    flou = models.TextField(blank=True, default='')

    class Meta:
        abstract = True

    def _source(self):
        return getattr(self, self.SOURCE_IMAGE, None)

    def _doit_generer(self):
        return bool(self._source()) and not self.apercu

    def save(self, *args, **kwargs):
        besoin = self._doit_generer()
        super().save(*args, **kwargs)

        if besoin:
            apercu, flou = fabriquer_apercu(self._source())
            if apercu:
                # save=False puis update_fields ciblé : on ne repasse pas dans
                # la génération, ce qui bouclerait sans fin.
                self.apercu.save(f'{self.pk}.jpg', apercu, save=False)
                self.flou = flou
                super().save(update_fields=['apercu', 'flou'])

    @property
    def url_affichage(self):
        """Aperçu s'il existe, sinon l'original (médias antérieurs, formats
        que Pillow n'a pas su lire)."""
        source = self._source()
        if self.apercu:
            return self.apercu.url
        return source.url if source else None
