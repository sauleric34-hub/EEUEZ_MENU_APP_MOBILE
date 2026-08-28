# ═══════════════════════════════════════════════════════════
#  Livraison libre — paramétrage, paiement des livreurs,
#  abandons et appareils push.
#
#  Séparé de models.py pour ne pas l'alourdir ; ré-exporté à la
#  fin de models.py (« from core.models import PaiementLivreur »).
# ═══════════════════════════════════════════════════════════

from django.db import models
from django.utils import timezone


# Opérateurs mobile money acceptés pour un décaissement (mêmes valeurs que
# core.payout.OPERATEUR_CAMERPAY côté clé).
OPERATEUR_CHOICES = [
    ('mtn_money', 'MTN Money'),
    ('orange_money', 'Orange Money'),
]


class ParametrageLivraison(models.Model):
    """Réglages métier de la livraison libre (singleton, édité en back-office).

    Aucune de ces valeurs n'est codée en dur ailleurs : tout passe par ici,
    comme pour ParametrageFidelite.
    """

    # Part du livreur sur les frais de livraison réellement payés par le client.
    pourcentage_livreur = models.PositiveIntegerField(
        default=70, help_text='Part du livreur sur les frais de livraison, en %.',
    )
    # Décaissement automatique dès que le solde du livreur atteint ce montant.
    seuil_paiement_auto = models.PositiveIntegerField(
        default=5000, help_text='Solde livreur (FCFA) déclenchant un versement automatique.',
    )
    # Une mission prise mais jamais démarrée est remise au pool après ce délai.
    delai_relance_minutes = models.PositiveIntegerField(
        default=20, help_text='Minutes avant de remettre au pool une mission prise mais pas démarrée.',
    )
    # Auto-désactivation d'un livreur qui abandonne trop.
    max_abandons = models.PositiveIntegerField(
        default=3, help_text="Nombre d'abandons sur la fenêtre avant désactivation automatique.",
    )
    fenetre_abandons_jours = models.PositiveIntegerField(
        default=7, help_text="Fenêtre glissante (jours) sur laquelle on compte les abandons.",
    )

    actif = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Paramétrage livraison'
        verbose_name_plural = 'Paramétrage livraison'

    def __str__(self):
        return 'Paramétrage de la livraison libre'

    @classmethod
    def get_solo(cls):
        """Récupère (ou crée) l'unique ligne de configuration."""
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    def part_livreur(self, frais_livraison):
        """Montant dû au livreur pour des frais de livraison donnés."""
        return round(float(frais_livraison or 0) * self.pourcentage_livreur / 100)


class PaiementLivreur(models.Model):
    """Décaissement des gains d'un livreur indépendant.

    Calqué sur RetraitFonds (restaurants) : un HTTP 2xx du fournisseur signifie
    « demande acceptée », pas « argent versé » — d'où le statut « approuvé ».
    """
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('approuve', 'Approuvé'),
        ('paye', 'Payé'),
        ('refuse', 'Refusé'),
    ]
    livreur = models.ForeignKey(
        'core.User', on_delete=models.CASCADE, related_name='paiements_livreur',
    )
    montant = models.DecimalField(max_digits=12, decimal_places=0)
    operateur = models.CharField(max_length=20, choices=OPERATEUR_CHOICES, default='mtn_money')
    numero = models.CharField(max_length=50, blank=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    # Suivi du décaissement (payout CamerPay ou traitement manuel).
    payout_reference = models.CharField(max_length=100, blank=True)
    payout_message = models.CharField(max_length=250, blank=True)
    # Déclenché automatiquement (seuil atteint) ou à la main par un admin.
    auto = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Paiement livreur'
        verbose_name_plural = 'Paiements livreurs'
        ordering = ['-created_at']

    def __str__(self):
        return f"Paiement {self.montant} F — {self.livreur} ({self.statut})"


class AbandonLivraison(models.Model):
    """Trace d'une mission abandonnée (par le livreur ou par timeout).

    Sert à compter les abandons sur une fenêtre glissante pour l'auto-blocage.
    """
    livreur = models.ForeignKey(
        'core.User', on_delete=models.CASCADE, related_name='abandons_livraison',
    )
    commande = models.ForeignKey(
        'core.Commande', on_delete=models.SET_NULL, null=True, related_name='abandons',
    )
    motif = models.CharField(max_length=250, blank=True)
    # True = remise au pool automatique (timeout), False = abandon volontaire.
    auto = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Abandon de livraison"
        verbose_name_plural = "Abandons de livraison"
        ordering = ['-created_at']

    def __str__(self):
        return f"Abandon commande #{self.commande_id} par {self.livreur}"


class AppareilPush(models.Model):
    """Jeton de notification push Expo d'un appareil d'un utilisateur."""
    PLATEFORME_CHOICES = [
        ('ios', 'iOS'),
        ('android', 'Android'),
        ('web', 'Web'),
    ]
    user = models.ForeignKey(
        'core.User', on_delete=models.CASCADE, related_name='appareils_push',
    )
    expo_token = models.CharField(max_length=255, unique=True)
    plateforme = models.CharField(max_length=10, choices=PLATEFORME_CHOICES, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Appareil push'
        verbose_name_plural = 'Appareils push'

    def __str__(self):
        return f"{self.user} — {self.plateforme or '?'}"
