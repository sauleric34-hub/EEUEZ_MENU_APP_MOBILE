from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Administrateur'),
        ('restaurant', 'Restaurant'),
        ('client', 'Client'),
        ('livreur', 'Livreur'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='client')
    telephone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"


class RestaurantProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='restaurant_profile')
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    adresse = models.CharField(max_length=300)
    ville = models.CharField(max_length=100)
    pays = models.CharField(max_length=100, default='Cameroun')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    logo = models.ImageField(upload_to='restaurants/logos/', blank=True, null=True)
    cover_image = models.ImageField(upload_to='restaurants/covers/', blank=True, null=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    is_verified = models.BooleanField(default=False)
    is_open = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Profil Restaurant'
        verbose_name_plural = 'Profils Restaurants'

    def __str__(self):
        return self.nom

    @property
    def note_moyenne(self):
        avis = self.avis_set.all()
        if not avis.exists():
            return 0
        return round(sum(a.note for a in avis) / avis.count(), 1)

    @property
    def total_commandes(self):
        return self.commandes.count()

    @property
    def chiffre_affaires(self):
        from django.db.models import Sum
        result = self.commandes.filter(statut='livree').aggregate(total=Sum('montant_total'))
        return result['total'] or 0


class Categorie(models.Model):
    nom = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icone = models.CharField(max_length=50, blank=True)

    class Meta:
        verbose_name = 'Catégorie'
        verbose_name_plural = 'Catégories'

    def __str__(self):
        return self.nom


class Plat(models.Model):
    restaurant = models.ForeignKey(RestaurantProfile, on_delete=models.CASCADE, related_name='plats')
    categorie = models.ForeignKey(Categorie, on_delete=models.SET_NULL, null=True, blank=True)
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    prix = models.DecimalField(max_digits=10, decimal_places=0)
    image = models.ImageField(upload_to='plats/', blank=True, null=True)
    is_available = models.BooleanField(default=True)
    is_popular = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    is_visible = models.BooleanField(default=True)
    allergies = models.CharField(max_length=300, blank=True)
    ingredients = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Plat'
        verbose_name_plural = 'Plats'

    def __str__(self):
        return f"{self.nom} — {self.restaurant.nom}"


class Commande(models.Model):
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('acceptee', 'Acceptée'),
        ('en_preparation', 'En préparation'),
        ('prete', 'Prête'),
        ('en_livraison', 'En livraison'),
        ('livree', 'Livrée'),
        ('refusee', 'Refusée'),
        ('annulee', 'Annulée'),
    ]
    client = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='commandes_client')
    restaurant = models.ForeignKey(RestaurantProfile, on_delete=models.SET_NULL, null=True, related_name='commandes')
    statut = models.CharField(max_length=30, choices=STATUT_CHOICES, default='en_attente')
    montant_total = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    commission_eeuez = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    montant_restaurant = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    adresse_livraison = models.CharField(max_length=300, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Commande'
        verbose_name_plural = 'Commandes'
        ordering = ['-created_at']

    def __str__(self):
        return f"Commande #{self.pk} — {self.restaurant}"

    def save(self, *args, **kwargs):
        if self.restaurant and self.montant_total:
            rate = self.restaurant.commission_rate / 100
            self.commission_eeuez = int(float(self.montant_total) * float(rate))
            self.montant_restaurant = int(float(self.montant_total)) - int(self.commission_eeuez)
        super().save(*args, **kwargs)


class LigneCommande(models.Model):
    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name='lignes')
    plat = models.ForeignKey(Plat, on_delete=models.SET_NULL, null=True)
    quantite = models.PositiveIntegerField(default=1)
    prix_unitaire = models.DecimalField(max_digits=10, decimal_places=0)

    def __str__(self):
        return f"{self.quantite}x {self.plat}"


class Livraison(models.Model):
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('assignee', 'Assignée'),
        ('en_collecte', 'En collecte'),
        ('en_livraison', 'En livraison'),
        ('livree', 'Livrée'),
        ('echec', 'Échec'),
    ]
    commande = models.OneToOneField(Commande, on_delete=models.CASCADE, related_name='livraison')
    livreur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='livraisons')
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    latitude_actuelle = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude_actuelle = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    estimated_delivery_time = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Livraison'
        verbose_name_plural = 'Livraisons'

    def __str__(self):
        return f"Livraison #{self.commande_id}"


class Avis(models.Model):
    commande = models.OneToOneField(Commande, on_delete=models.CASCADE, related_name='avis')
    client = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='avis_client')
    restaurant = models.ForeignKey(RestaurantProfile, on_delete=models.SET_NULL, null=True, related_name='avis_set')
    note = models.PositiveSmallIntegerField(choices=[(i, i) for i in range(1, 6)])
    commentaire = models.TextField(blank=True)
    reponse_restaurant = models.TextField(blank=True)
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Avis'
        verbose_name_plural = 'Avis'
        ordering = ['-created_at']

    def __str__(self):
        return f"Avis {self.note}/5 — {self.restaurant}"


MODE_PAIEMENT_CHOICES = [
    ('mtn_money', 'MTN Money'),
    ('orange_money', 'Orange Money'),
    ('carte', 'Carte Bancaire'),
    ('especes', 'Espèces'),
]


class Transaction(models.Model):
    TYPE_CHOICES = [
        ('paiement_client', 'Paiement Client'),
        ('commission_eeuez', 'Commission plateforme'),
        ('reversement_restaurant', 'Reversement Restaurant'),
    ]
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('complete', 'Complétée'),
        ('echouee', 'Échouée'),
        ('remboursee', 'Remboursée'),
    ]
    commande = models.ForeignKey(Commande, on_delete=models.CASCADE, related_name='transactions')
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    montant = models.DecimalField(max_digits=12, decimal_places=0)
    mode_paiement = models.CharField(max_length=20, choices=MODE_PAIEMENT_CHOICES, default='especes')
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Transaction'
        verbose_name_plural = 'Transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_type_display()} — {self.montant} FCFA"


class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=50, blank=True)
    description = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Log d'audit"
        verbose_name_plural = "Logs d'audit"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} par {self.user} — {self.created_at.strftime('%d/%m/%Y %H:%M')}"
