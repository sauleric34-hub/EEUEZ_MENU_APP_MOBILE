from django.core.validators import RegexValidator
from django.db import models

hex_color = RegexValidator(
    regex=r'^#[0-9a-fA-F]{6}$',
    message="Couleur invalide — format attendu : #RRGGBB",
)


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
