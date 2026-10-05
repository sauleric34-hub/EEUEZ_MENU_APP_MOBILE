import unicodedata

from django.core.validators import RegexValidator
from django.db import models

from core.utils.geo import est_dans_le_rayon

hex_color = RegexValidator(
    regex=r'^#[0-9a-fA-F]{6}$',
    message="Couleur invalide — format attendu : #RRGGBB",
)


def normaliser_ville(nom):
    """Comparaison de villes insensible à la casse et aux accents."""
    sans_accents = unicodedata.normalize('NFD', nom or '')
    sans_accents = ''.join(c for c in sans_accents if unicodedata.category(c) != 'Mn')
    return ' '.join(sans_accents.lower().split())


class ZoneCiblage(models.Model):
    """Zone géographique réutilisable (cercle : centre + rayon) pour cibler
    des bannières — ex. « Douala Akwa », « Campus de Ngoa-Ekelle »."""

    nom = models.CharField(max_length=100)
    latitude = models.FloatField()
    longitude = models.FloatField()
    rayon_km = models.FloatField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Zone de ciblage'
        verbose_name_plural = 'Zones de ciblage'
        ordering = ['nom']

    def __str__(self):
        return self.nom

    def contient(self, lat, lon):
        return est_dans_le_rayon(self.latitude, self.longitude, lat, lon, self.rayon_km)


class Banniere(models.Model):
    """Bannière promotionnelle affichée en carrousel sur l'accueil client.

    4 éléments personnalisables par l'admin : texte, bouton « Commander »
    (visible seulement si relié à un plat), fond (image/couleur/dégradé) et
    image de droite. `updated_at` sert de signal de version : l'app mobile
    ne re-télécharge la liste complète que s'il a changé (cf. api-client-
    bannieres-version), pour éviter une requête lourde à chaque accueil.
    """

    FOND_CHOICES = [
        ('image', 'Image'),
        ('couleur', 'Couleur unie'),
        ('degrade', 'Dégradé'),
    ]

    # Repère admin uniquement — jamais montré au client.
    nom_interne = models.CharField(max_length=100)

    # ── 1. Texte ──────────────────────────────────────────────
    badge = models.CharField(max_length=40, blank=True)
    titre = models.TextField()
    sous_titre = models.CharField(max_length=200, blank=True)
    texte_couleur = models.CharField(max_length=7, default='#ffffff', validators=[hex_color])

    # ── 2. Bouton « Commander » ──────────────────────────────
    # Le bouton n'apparaît que si un plat est relié (cf. serializer / front).
    plat = models.ForeignKey(
        'Plat', on_delete=models.SET_NULL, null=True, blank=True, related_name='bannieres',
    )
    bouton_texte_couleur = models.CharField(max_length=7, default='#f26a1b', validators=[hex_color])
    bouton_fond_couleur = models.CharField(max_length=7, default='#ffffff', validators=[hex_color])

    # ── 3. Fond ───────────────────────────────────────────────
    fond_type = models.CharField(max_length=10, choices=FOND_CHOICES, default='image')
    fond_image = models.ImageField(upload_to='bannieres/fond/', blank=True, null=True)
    fond_couleur = models.CharField(max_length=7, default='#1f8a4c', validators=[hex_color])
    fond_degrade_debut = models.CharField(max_length=7, default='#f7891b', validators=[hex_color])
    fond_degrade_fin = models.CharField(max_length=7, default='#f2611b', validators=[hex_color])

    # ── 4. Image de droite ───────────────────────────────────
    image_droite = models.ImageField(upload_to='bannieres/droite/', blank=True, null=True)

    # ── 5. Ciblage (tous les critères se combinent) ─────────
    # Aucun critère = visible partout. Sinon, la bannière s'affiche dès que le
    # client correspond à AU MOINS UN critère : son pays, sa ville, une zone
    # réutilisable ou le cercle propre à la bannière.
    cible_pays = models.JSONField(default=list, blank=True)    # codes ISO : ['CM', 'CI']
    cible_villes = models.JSONField(default=list, blank=True)  # noms : ['Douala', 'Yaoundé']
    cible_zones = models.ManyToManyField(ZoneCiblage, blank=True, related_name='bannieres')
    cercle_lat = models.FloatField(null=True, blank=True)
    cercle_lon = models.FloatField(null=True, blank=True)
    cercle_rayon_km = models.FloatField(null=True, blank=True)

    # ── Gestion (liste illimitée, réordonnable, activable) ───
    ordre = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Bannière'
        verbose_name_plural = 'Bannières'
        ordering = ['ordre', 'id']

    def __str__(self):
        return self.nom_interne

    @property
    def a_un_cercle(self):
        return None not in (self.cercle_lat, self.cercle_lon, self.cercle_rayon_km)

    def correspond(self, pays='', ville='', lat=None, lon=None, zones=None):
        """La bannière doit-elle être montrée à ce client ?
        `zones` : zones déjà préchargées (évite une requête par bannière)."""
        zones = list(self.cible_zones.all()) if zones is None else zones
        if not (self.cible_pays or self.cible_villes or zones or self.a_un_cercle):
            return True  # aucun ciblage : partout
        if pays and pays.upper() in self.cible_pays:
            return True
        if ville:
            v = normaliser_ville(ville)
            if any(normaliser_ville(c) == v for c in self.cible_villes):
                return True
        if lat is not None and lon is not None:
            if self.a_un_cercle and est_dans_le_rayon(self.cercle_lat, self.cercle_lon, lat, lon, self.cercle_rayon_km):
                return True
            if any(z.contient(lat, lon) for z in zones):
                return True
        return False
