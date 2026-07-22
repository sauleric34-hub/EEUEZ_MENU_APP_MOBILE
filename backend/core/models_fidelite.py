# ═══════════════════════════════════════════════════════════
#  Fidélité — points, niveaux et paramétrage
#
#  Choix d'architecture : un GRAND LIVRE en ajout seul, pas un simple
#  compteur sur l'utilisateur. Raisons :
#   · un like est annulable — sans trace, on ne saurait pas si ce like a
#     déjà rapporté, et la boucle like/unlike/like deviendrait une machine
#     à points ;
#   · les points se dépensent au paiement : il faut un historique en cas
#     de litige ;
#   · l'administrateur doit pouvoir annuler les crédits d'une publication
#     détruite.
#  Le champ User.points_solde n'est qu'un CACHE du solde.
# ═══════════════════════════════════════════════════════════

from django.db import models


class MouvementPoints(models.Model):
    MOTIF_CHOICES = [
        ('publication_validee', 'Publication validée'),
        ('like_recu', 'Like reçu'),
        ('commentaire_recu', 'Commentaire reçu'),
        ('depense_commande', 'Réduction utilisée'),
        ('annulation', 'Annulation'),
        ('ajustement', 'Ajustement manuel'),
    ]

    client = models.ForeignKey(
        'User', on_delete=models.CASCADE, related_name='mouvements_points',
    )
    # Signé : +5, +1, -120…
    montant = models.IntegerField()
    motif = models.CharField(max_length=30, choices=MOTIF_CHOICES)
    # Origine du mouvement, pour l'idempotence et la traçabilité.
    source_type = models.CharField(max_length=20, blank=True, default='')
    source_id = models.CharField(max_length=50, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mouvement de points'
        verbose_name_plural = 'Mouvements de points'
        ordering = ['-created_at']
        # LE garde-fou anti-abus : un même événement ne peut créditer qu'une
        # seule fois, définitivement.
        unique_together = ('client', 'motif', 'source_type', 'source_id')
        indexes = [models.Index(fields=['client', '-created_at'])]

    def __str__(self):
        signe = '+' if self.montant >= 0 else ''
        return f'{signe}{self.montant} pts — {self.get_motif_display()} ({self.client})'


class ParametrageFidelite(models.Model):
    """Réglages métier du programme de fidélité (singleton, éditable en admin).

    Aucune valeur n'est codée en dur ailleurs : tout passe par ici.
    """

    # Gains
    points_publication_validee = models.PositiveIntegerField(default=5)
    points_par_like = models.PositiveIntegerField(default=1)
    points_par_commentaire = models.PositiveIntegerField(default=2)

    # Conversion en réduction : (points / points_par_unite) × valeur_unite
    points_par_unite = models.PositiveIntegerField(
        default=100, help_text='Nombre de points valant « valeur_unite » FCFA.',
    )
    valeur_unite = models.PositiveIntegerField(
        default=500, help_text='Réduction en FCFA obtenue pour « points_par_unite » points.',
    )
    seuil_minimum_conversion = models.PositiveIntegerField(
        default=100, help_text='Points minimum pour pouvoir convertir.',
    )
    reduction_max_pourcentage = models.PositiveIntegerField(
        default=30,
        help_text='Plafond de la réduction, en % du total de la commande.',
    )

    # Niveaux (badges)
    seuil_bronze = models.PositiveIntegerField(default=0)
    seuil_argent = models.PositiveIntegerField(default=500)
    seuil_or = models.PositiveIntegerField(default=2000)

    actif = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Paramétrage fidélité'
        verbose_name_plural = 'Paramétrage fidélité'

    def __str__(self):
        return 'Paramétrage du programme de fidélité'

    @classmethod
    def get_solo(cls):
        """Récupère (ou crée) l'unique ligne de configuration."""
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    def niveau(self, points):
        """Badge déduit du solde. Dérivé, jamais stocké : modifier un seuil
        reclasse tout le monde sans migration."""
        if points >= self.seuil_or:
            return 'or'
        if points >= self.seuil_argent:
            return 'argent'
        return 'bronze'

    def points_vers_fcfa(self, points):
        """Convertit des points en réduction (FCFA), hors plafond."""
        if not self.points_par_unite:
            return 0
        return (int(points) // self.points_par_unite) * self.valeur_unite
