# ═══════════════════════════════════════════════════════════
#  Panier multi-restaurant — un checkout, plusieurs Commande.
#
#  Chaque restaurant du panier garde SA PROPRE Commande (ses propres
#  lignes, son propre frais de livraison selon SON barème, sa propre
#  part livreur, sa propre commission) : rien ne change dans la
#  comptabilité par commande. CommandeGroupe ne fait que les relier
#  pour que le client règle tout en une seule fois.
#
#  Le paiement Mobile Money combiné passe par PaiementGroupe — délibérément
#  SÉPARÉ de Transaction, pour ne rien changer à la comptabilité existante
#  (chaque Commande garde sa Transaction 'paiement_client' individuelle,
#  utilisée par les rapports admin/finances). PaiementGroupe ne sert qu'à
#  suivre le paiement CamerPay unique et, une fois confirmé, à propager la
#  confirmation à toutes les commandes du groupe (voir api_views.camerpay_notify).
# ═══════════════════════════════════════════════════════════

from django.db import models


class CommandeGroupe(models.Model):
    """Relie les Commande issues d'un même passage en caisse (panier
    contenant plusieurs restaurants). Existe même pour un groupe d'une
    seule commande, pour un traitement uniforme côté app."""
    client = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, related_name='commande_groupes',
    )
    montant_total = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Groupe de commandes'
        verbose_name_plural = 'Groupes de commandes'
        ordering = ['-created_at']

    def __str__(self):
        return f"Groupe #{self.pk} — {self.commandes.count()} commande(s)"

    @property
    def paiement_confirme(self):
        """Vrai quand TOUTES les commandes du groupe sont confirmées."""
        commandes = list(self.commandes.all())
        return bool(commandes) and all(c.paiement_confirme for c in commandes)


class PaiementGroupe(models.Model):
    """Paiement Mobile Money couvrant toutes les commandes d'un CommandeGroupe.

    Miroir volontairement minimal de Transaction (mêmes statuts, même rôle de
    référence CamerPay), mais séparé : voir l'en-tête du fichier.
    """
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('complete', 'Complétée'),
        ('echouee', 'Échouée'),
        ('remboursee', 'Remboursée'),
    ]
    groupe = models.OneToOneField(
        CommandeGroupe, on_delete=models.CASCADE, related_name='paiement',
    )
    montant = models.DecimalField(max_digits=12, decimal_places=0)
    mode_paiement = models.CharField(max_length=20, default='mtn_money')
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    # Référence envoyée à CamerPay (merchant_invoice_id), préfixée « EEUEZG- »
    # pour que le webhook distingue un paiement de groupe d'un paiement de
    # commande unique (préfixe « EEUEZ- ») ou de réservation (« RESA- »).
    reference = models.CharField(max_length=100, blank=True)
    provider_reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Paiement de groupe'
        verbose_name_plural = 'Paiements de groupe'
        ordering = ['-created_at']

    def __str__(self):
        return f"Paiement groupe #{self.groupe_id} — {self.montant} F ({self.statut})"
