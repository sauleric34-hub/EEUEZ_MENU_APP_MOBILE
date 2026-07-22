# ═══════════════════════════════════════════════════════════
#  Publications — fil social (type Instagram)
#
#  Deux règles structurantes :
#   1. IMMUTABILITÉ — une publication ne peut jamais être modifiée.
#      Il n'y a donc volontairement pas de champ « updated_at », et save()
#      refuse toute écriture sur un champ de contenu après création.
#   2. SUPPRESSION PARTIELLE — supprimer masque partout dans l'app mais
#      conserve la ligne en base. Seul l'admin supprime réellement.
# ═══════════════════════════════════════════════════════════

from core.medias_utils import ApercuMixin
from django.core.exceptions import ValidationError
from django.db import models


class PublicationQuerySet(models.QuerySet):
    """Filtres de visibilité — à utiliser partout SAUF dans le workspace admin,
    qui doit voir les publications supprimées (avec leur statut)."""

    def visibles(self):
        """Fil d'accueil, page du restaurant, profil de l'auteur."""
        return self.filter(supprime_par='', statut='publiee')

    def moderables(self):
        """File d'attente de validation des contributions clients."""
        return self.filter(supprime_par='', statut='en_attente')

    def du_restaurant(self, restaurant):
        return self.filter(restaurant=restaurant, supprime_par='')


class Publication(models.Model):
    STATUT_CHOICES = [
        ('en_attente', 'En attente de validation'),
        ('publiee', 'Publiée'),
        ('refusee', 'Refusée'),
    ]
    SUPPRESSION_CHOICES = [
        ('', 'Active'),
        ('client', 'Supprimée par le client'),
        ('restaurant', 'Supprimée par le restaurant'),
    ]

    # Le restaurant est TOUJOURS renseigné : c'est lui qui possède le fil.
    restaurant = models.ForeignKey(
        'RestaurantProfile', on_delete=models.CASCADE, related_name='publications',
    )
    # auteur nul => publication faite par le restaurant lui-même.
    # auteur renseigné => contribution d'un client (à valider par le restaurant).
    auteur = models.ForeignKey(
        'User', on_delete=models.CASCADE, null=True, blank=True, related_name='publications',
    )
    texte = models.TextField(blank=True)
    # Plat associé : un clic dans l'app ouvre sa fiche. SET_NULL pour qu'une
    # suppression de plat ne détruise jamais une publication.
    plat = models.ForeignKey(
        'Plat', on_delete=models.SET_NULL, null=True, blank=True, related_name='publications',
    )
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='publiee')
    supprime_par = models.CharField(
        max_length=20, choices=SUPPRESSION_CHOICES, blank=True, default='',
    )
    supprime_le = models.DateTimeField(null=True, blank=True)
    # Garde-fou d'idempotence : empêche de recréditer les points si le
    # restaurant dé-valide puis re-valide une contribution.
    points_attribues = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = PublicationQuerySet.as_manager()

    class Meta:
        verbose_name = 'Publication'
        verbose_name_plural = 'Publications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['restaurant', 'statut', 'supprime_par']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        qui = self.auteur.username if self.auteur else self.restaurant.nom
        return f"Publication #{self.pk} — {qui}"

    # Champs qu'on autorise à faire évoluer après création (modération / points).
    CHAMPS_MODIFIABLES = {'statut', 'supprime_par', 'supprime_le', 'points_attribues'}

    def save(self, *args, **kwargs):
        """Garde-fou d'immutabilité : après création, seuls les champs de
        modération peuvent bouger.

        Un enregistrement SANS « update_fields » réécrit toutes les colonnes,
        texte compris : il est donc refusé au même titre qu'une modification
        explicite. Toute évolution légitime (modération, points) cible ses
        champs — c'est ce qui rend cette règle tenable.
        """
        if self.pk is not None:
            champs = kwargs.get('update_fields')
            if champs is None or not set(champs) <= self.CHAMPS_MODIFIABLES:
                raise ValidationError('Une publication ne peut pas être modifiée.')
        super().save(*args, **kwargs)

    @property
    def est_contribution(self):
        """True si la publication vient d'un client (et non du restaurant)."""
        return self.auteur_id is not None

    @property
    def est_supprimee(self):
        return bool(self.supprime_par)


class PublicationMedia(ApercuMixin, models.Model):
    """Photo ou vidéo d'une publication (carrousel : plusieurs par publication)."""

    TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Vidéo'),
    ]

    publication = models.ForeignKey(
        Publication, on_delete=models.CASCADE, related_name='medias',
    )
    # apercu / flou viennent du mixin (voir core/medias_utils.py).
    SOURCE_IMAGE = 'fichier'

    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='image')
    fichier = models.FileField(upload_to='publications/')
    ordre = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Média de publication'
        verbose_name_plural = 'Médias de publication'
        ordering = ['ordre', 'id']

    def _doit_generer(self):
        """Les vidéos ne passent pas par Pillow."""
        return self.type == 'image' and super()._doit_generer()

    def __str__(self):
        return f"{self.get_type_display()} #{self.pk} (pub {self.publication_id})"


class PublicationLike(models.Model):
    """« J'aime » sur une publication. Le retrait supprime la ligne (comme Favori),
    mais ne retire jamais les points déjà gagnés — cf. MouvementPoints."""

    publication = models.ForeignKey(
        Publication, on_delete=models.CASCADE, related_name='likes',
    )
    client = models.ForeignKey(
        'User', on_delete=models.CASCADE, related_name='publications_likees',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Like de publication'
        verbose_name_plural = 'Likes de publication'
        unique_together = ('publication', 'client')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.client} ♥ pub {self.publication_id}"


class PublicationCommentaire(models.Model):
    """Commentaire. Supprimable par son auteur, le restaurant ou l'admin ;
    la ligne survit en base (traçabilité des points déjà attribués)."""

    SUPPRESSION_CHOICES = [
        ('', 'Actif'),
        ('auteur', "Supprimé par l'auteur"),
        ('restaurant', 'Supprimé par le restaurant'),
        ('admin', "Supprimé par l'administrateur"),
    ]

    publication = models.ForeignKey(
        Publication, on_delete=models.CASCADE, related_name='commentaires',
    )
    auteur = models.ForeignKey(
        'User', on_delete=models.CASCADE, related_name='commentaires_publications',
    )
    texte = models.TextField()
    supprime_par = models.CharField(
        max_length=20, choices=SUPPRESSION_CHOICES, blank=True, default='',
    )
    supprime_le = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Commentaire de publication'
        verbose_name_plural = 'Commentaires de publication'
        ordering = ['created_at']
        indexes = [models.Index(fields=['publication', 'supprime_par'])]

    def __str__(self):
        return f"Commentaire #{self.pk} de {self.auteur} (pub {self.publication_id})"
