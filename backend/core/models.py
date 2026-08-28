import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from core.medias_utils import ApercuMixin
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
    allergies = models.CharField(max_length=300, blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    gain_total = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    nombre_livraisons = models.PositiveIntegerField(default=0)
    # Compte mobile money du livreur — cible des décaissements automatiques.
    # Tant qu'il est vide, aucun paiement n'est déclenché (les gains s'accumulent).
    paiement_numero = models.CharField(max_length=50, blank=True)
    paiement_operateur = models.CharField(max_length=20, blank=True)
    # Livreur rattaché à un restaurant (compte créé par ce restaurant)
    restaurant_attache = models.ForeignKey(
        'RestaurantProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='livreurs',
    )
    # Fidélité : cache du solde (la vérité est dans MouvementPoints).
    points_solde = models.PositiveIntegerField(default=0)
    # Graine de mélange du fil de publications : propre à l'utilisateur et
    # stable dans le temps, pour que son ordre lui soit personnel.
    feed_seed = models.UUIDField(default=uuid.uuid4, editable=False)

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"

    @property
    def niveau_fidelite(self):
        from .models_fidelite import ParametrageFidelite
        return ParametrageFidelite.get_solo().niveau(self.points_solde)

    @property
    def note_moyenne(self):
        """Note moyenne du livreur. Réservé pour une future notation client —
        renvoie 0.0 tant que le système de notation des livreurs n'existe pas.
        Placeholder consommé par CommandeSerializer.get_suivi."""
        return 0.0

    @property
    def solde_livreur(self):
        """Gains cumulés du livreur − paiements déjà émis (non refusés)."""
        from django.db.models import Sum
        verses = (
            self.paiements_livreur.exclude(statut='refuse')
            .aggregate(t=Sum('montant'))['t'] or 0
        )
        return float(self.gain_total or 0) - float(verses)


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
    temps_livraison_moyen = models.PositiveIntegerField(default=30)
    frais_livraison = models.DecimalField(max_digits=10, decimal_places=0, default=500)
    # Prix par défaut d'une réservation de table (modifiable par le restaurant)
    prix_reservation = models.DecimalField(max_digits=10, decimal_places=0, default=5000)
    # Note moyenne DÉNORMALISÉE : recalculée à chaque nouvelle note (signal) et
    # par la commande recalculer_notes. Sert à servir une liste de restaurants
    # sans requête par restaurant — indispensable sous charge (voir plus bas).
    note_cache = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Profil Restaurant'
        verbose_name_plural = 'Profils Restaurants'

    def __str__(self):
        return self.nom

    @property
    def note_moyenne(self):
        """Note du restaurant, servie depuis le cache dénormalisé.

        Aucune requête ici : c'était l'ancien coût (N requêtes par restaurant),
        qui rendait la sérialisation d'une liste de restaurants explosive sous
        charge. Le calcul réel vit dans recalculer_note(), déclenché à chaque
        nouvelle note.
        """
        return float(self.note_cache)

    def calculer_note(self):
        """Recalcule la note pondérée SANS l'enregistrer. Renvoie un float.

        Note = moyenne des notes de plats, pondérée par le nombre de commandes
        de chaque plat (les plats les plus commandés pèsent davantage). Le tout
        en UNE requête (annotations), là où l'ancienne version en faisait deux
        par plat.
        """
        from django.db.models import Avg, Sum
        from django.db.models.functions import Coalesce
        from django.db.models import Value

        plats = self.plats.annotate(
            avg_note=Avg('notes__note'),
            nb_commandes=Coalesce(Sum('lignecommande__quantite'), Value(0)),
        ).filter(avg_note__isnull=False).values_list('avg_note', 'nb_commandes')

        total_pondere = 0.0
        total_poids = 0.0
        simples = []
        for avg, nb in plats:
            poids = (nb or 0) + 1  # +1 : un plat noté jamais commandé compte un minimum
            total_pondere += float(avg) * poids
            total_poids += poids
            simples.append(float(avg))

        if total_poids:
            return round(total_pondere / total_poids, 1)
        if simples:
            return round(sum(simples) / len(simples), 1)
        return 0.0

    def recalculer_note(self, sauver=True):
        """Met à jour note_cache. Idempotent, sûr à appeler en boucle."""
        self.note_cache = self.calculer_note()
        if sauver:
            # update_fields ciblé : n'écrit que la colonne concernée.
            super().save(update_fields=['note_cache'])
        return self.note_cache

    @property
    def total_commandes(self):
        return self.commandes.count()

    @property
    def chiffre_affaires(self):
        from django.db.models import Sum
        result = self.commandes.filter(statut='livree').aggregate(total=Sum('montant_total'))
        return result['total'] or 0

    @property
    def nb_publications_attente(self):
        """Contributions clients à valider — affiché en pastille dans la sidebar."""
        return self.publications.filter(statut='en_attente', supprime_par='').count()


class Categorie(models.Model):
    nom = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icone = models.CharField(max_length=50, blank=True)

    class Meta:
        verbose_name = 'Catégorie'
        verbose_name_plural = 'Catégories'

    def __str__(self):
        return self.nom


class Plat(ApercuMixin, models.Model):
    restaurant = models.ForeignKey(RestaurantProfile, on_delete=models.CASCADE, related_name='plats')
    categorie = models.ForeignKey(Categorie, on_delete=models.SET_NULL, null=True, blank=True)
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    prix = models.DecimalField(max_digits=10, decimal_places=0)
    # Frais de livraison propres au plat (fixés par le restaurant à la publication).
    # Affichés dans l'app et appliqués à la commande.
    frais_livraison = models.DecimalField(max_digits=10, decimal_places=0, default=500)
    image = models.ImageField(upload_to='plats/', blank=True, null=True)
    is_available = models.BooleanField(default=True)
    is_popular = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    is_visible = models.BooleanField(default=True)
    # « Plat du jour » : valable uniquement le jour où il est défini.
    # À minuit, la date change → le plat n'est plus plat du jour (reset auto).
    plat_du_jour_le = models.DateField(null=True, blank=True)
    allergies = models.CharField(max_length=300, blank=True)
    ingredients = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def est_plat_du_jour(self):
        from django.utils import timezone
        return self.plat_du_jour_le == timezone.localdate()

    @property
    def prix_client(self):
        """Prix affiché et payé par le client = prix de base du restaurant
        + le pourcentage de revenu de la plateforme (défini par l'admin).
        Le restaurant ne perçoit que son prix de base (voir Commande)."""
        rate = float(self.restaurant.commission_rate) if self.restaurant else 0.0
        return int(round(float(self.prix) * (1 + rate / 100)))

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
    # Paiement confirmé : False pour une commande mobile money tant que CamerPay
    # n'a pas notifié le succès. Une commande non confirmée n'est PAS visible du
    # restaurant (elle n'existe réellement qu'une fois payée).
    paiement_confirme = models.BooleanField(default=True)
    montant_total = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    # La commission peut devenir négative : c'est la plateforme qui finance la
    # réduction fidélité, jamais le restaurant ni le livreur.
    commission_eeuez = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    montant_restaurant = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    # Fidélité : points dépensés et réduction correspondante (en FCFA).
    points_utilises = models.PositiveIntegerField(default=0)
    reduction_points = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    # Frais de livraison payés par le client, FIGÉS à la création (le plus élevé
    # parmi les plats commandés). On ne les recalcule jamais après coup.
    frais_livraison = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    # Part revenant au livreur sur ces frais, figée à la création selon
    # ParametrageLivraison.pourcentage_livreur.
    part_livreur = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    adresse_livraison = models.CharField(max_length=300, blank=True)
    latitude_livraison = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude_livraison = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    notes = models.TextField(blank=True)
    delai_estime = models.PositiveIntegerField(null=True, blank=True)
    # Livraison libre : le restaurant a confié cette commande au pool de
    # livreurs INDÉPENDANTS (non attachés à un restaurant). Tant qu'aucune
    # Livraison n'existe, tout livreur indépendant peut la prendre.
    livraison_libre = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Commande'
        verbose_name_plural = 'Commandes'
        ordering = ['-created_at']

    def __str__(self):
        return f"Commande #{self.pk} — {self.restaurant}"

    def save(self, *args, **kwargs):
        # Modèle « majoration » : le client paie prix_base + pourcentage.
        #   montant_restaurant  = somme des prix de base (dû au restaurant)
        #   commission_eeuez    = majoration encaissée par la plateforme
        # Ces montants sont fixés à la création (à partir des lignes). Ce bloc
        # n'est qu'un repli quand ils n'ont pas été fournis (ex. données seed) :
        # on retrouve la base en divisant le total plats par (1 + taux).
        if self.restaurant and self.montant_total and not self.montant_restaurant:
            rate = float(self.restaurant.commission_rate) / 100
            frais = float(self.restaurant.frais_livraison or 0)
            dishes_client = max(float(self.montant_total) - frais, 0)
            base = dishes_client / (1 + rate) if (1 + rate) else dishes_client
            self.montant_restaurant = int(round(base))
            self.commission_eeuez = int(round(dishes_client - base))
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
        ('livree_sans_code', 'Livrée — à valider'),
        ('echec', 'Échec'),
    ]
    commande = models.OneToOneField(Commande, on_delete=models.CASCADE, related_name='livraison')
    livreur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='livraisons')
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    latitude_actuelle = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude_actuelle = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    estimated_delivery_time = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    # Code que le client scanne (QR) ou saisit pour confirmer la réception.
    # Généré au départ vers le client ; sa validation termine la livraison.
    code_confirmation = models.CharField(max_length=8, blank=True)
    # Qui a confirmé la réception : 'client' (code/QR), 'admin' (validation d'une
    # livraison « sans code »), ou '' tant que non confirmée.
    confirmee_par = models.CharField(max_length=10, blank=True)
    # Motif saisi par le livreur quand il clôt une course « sans confirmation »
    # (client injoignable / refuse de scanner). La course reste à valider.
    motif_sans_code = models.CharField(max_length=250, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Livraison'
        verbose_name_plural = 'Livraisons'

    def __str__(self):
        return f"Livraison #{self.commande_id}"

    @staticmethod
    def generer_code(longueur=6):
        import secrets
        # Alphabet sans caractères ambigus (0/O, 1/I/L)
        alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
        return ''.join(secrets.choice(alphabet) for _ in range(longueur))


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


class PlatImage(ApercuMixin, models.Model):
    """Photo supplémentaire d'un plat (galerie)."""
    plat = models.ForeignKey(Plat, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to='plats/')
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = 'Photo de plat'
        verbose_name_plural = 'Photos de plats'
        ordering = ['ordre', 'id']

    def __str__(self):
        return f"Photo #{self.pk} — {self.plat}"


class PlatNote(models.Model):
    """Note (1-5 étoiles) donnée par un client à un plat."""
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notes_plats')
    plat = models.ForeignKey(Plat, on_delete=models.CASCADE, related_name='notes')
    note = models.PositiveSmallIntegerField(choices=[(i, i) for i in range(1, 6)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Note de plat'
        verbose_name_plural = 'Notes de plats'
        unique_together = ('client', 'plat')

    def __str__(self):
        return f"{self.client} → {self.plat} : {self.note}/5"


class AdresseLivraison(models.Model):
    """Lieu de livraison enregistré par un client (GPS précis)."""
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name='adresses')
    label = models.CharField(max_length=60, blank=True)  # « Maison », « Bureau »…
    adresse = models.CharField(max_length=300)
    details = models.CharField(max_length=200, blank=True)  # étage, porte, repère
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Adresse de livraison'
        verbose_name_plural = 'Adresses de livraison'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.label or self.adresse} ({self.client})"


class Conversation(models.Model):
    """Discussion client ↔ restaurant à propos d'un plat."""
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations')
    restaurant = models.ForeignKey(RestaurantProfile, on_delete=models.CASCADE, related_name='conversations')
    plat = models.ForeignKey(Plat, on_delete=models.CASCADE, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Conversation'
        verbose_name_plural = 'Conversations'
        unique_together = ('client', 'plat')
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.client} ↔ {self.restaurant} ({self.plat})"


class Message(models.Model):
    SENDER_CHOICES = [('client', 'Client'), ('restaurant', 'Restaurant')]
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=12, choices=SENDER_CHOICES)
    texte = models.TextField(blank=True)
    image = models.ImageField(upload_to='messages/', blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.sender}] {self.texte[:40]}"


class Favori(models.Model):
    """Plat mis en favori par un client."""
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favoris')
    plat = models.ForeignKey(Plat, on_delete=models.CASCADE, related_name='favoris')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Favori'
        verbose_name_plural = 'Favoris'
        unique_together = ('client', 'plat')

    def __str__(self):
        return f"{self.client} ♥ {self.plat}"


class Abonnement(models.Model):
    """Client abonné à un restaurant."""
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name='abonnements')
    restaurant = models.ForeignKey(RestaurantProfile, on_delete=models.CASCADE, related_name='abonnes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Abonnement'
        verbose_name_plural = 'Abonnements'
        unique_together = ('client', 'restaurant')

    def __str__(self):
        return f"{self.client} → {self.restaurant}"


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
        ('gain_livreur', 'Gain livreur'),
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
    # transaction_uuid CamerPay (renvoyé par /api/payment/initiate), utile pour
    # une vérification de statut complémentaire au webhook (GET /payment/{uuid}/status).
    provider_reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Transaction'
        verbose_name_plural = 'Transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_type_display()} — {self.montant} FCFA"


class RetraitFonds(models.Model):
    """Demande de retrait des gains d'un restaurant."""
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('approuve', 'Approuvé'),
        ('paye', 'Payé'),
        ('refuse', 'Refusé'),
    ]
    restaurant = models.ForeignKey(RestaurantProfile, on_delete=models.CASCADE, related_name='retraits')
    montant = models.DecimalField(max_digits=12, decimal_places=0)
    mode_paiement = models.CharField(max_length=20, choices=MODE_PAIEMENT_CHOICES, default='mtn_money')
    numero_compte = models.CharField(max_length=50, blank=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    # Suivi du décaissement (payout CamerPay ou traitement manuel)
    payout_reference = models.CharField(max_length=100, blank=True)
    payout_message = models.CharField(max_length=250, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Retrait de fonds'
        verbose_name_plural = 'Retraits de fonds'
        ordering = ['-created_at']

    def __str__(self):
        return f"Retrait {self.montant} F — {self.restaurant} ({self.statut})"


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


class RestaurantMedia(models.Model):
    """Photo ou vidéo de la galerie d'un restaurant."""
    TYPE_CHOICES = [('image', 'Photo'), ('video', 'Vidéo')]
    restaurant = models.ForeignKey(RestaurantProfile, on_delete=models.CASCADE, related_name='medias')
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='image')
    fichier = models.FileField(upload_to='galerie/')
    legende = models.CharField(max_length=200, blank=True)
    ordre = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Média restaurant'
        verbose_name_plural = 'Médias restaurant'
        ordering = ['ordre', '-created_at']

    def __str__(self):
        return f"{self.get_type_display()} — {self.restaurant.nom}"


class Reservation(models.Model):
    """Réservation d'une table dans un restaurant."""
    STATUT_CHOICES = [
        ('en_attente', 'En attente'),
        ('acceptee', 'Acceptée'),
        ('refusee', 'Refusée'),
        ('payee', 'Payée'),
        ('annulee', 'Annulée'),
    ]
    client = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reservations')
    restaurant = models.ForeignKey(RestaurantProfile, on_delete=models.CASCADE, related_name='reservations')
    nom = models.CharField(max_length=150)
    date_reservation = models.DateTimeField()
    nombre_personnes = models.PositiveSmallIntegerField(default=1)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    # Prix fixé par le restaurant (copié depuis prix_reservation, modifiable à l'acceptation)
    prix = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    notes = models.TextField(blank=True)
    # Code du ticket (QR / PDF), généré au paiement — cf. Livraison.generer_code
    code = models.CharField(max_length=8, blank=True)
    # transaction_uuid CamerPay (renvoyé par /api/payment/initiate), utile pour
    # une vérification de statut complémentaire au webhook (GET /payment/{uuid}/status).
    provider_reference = models.CharField(max_length=100, blank=True)
    transaction = models.ForeignKey(
        'Transaction', on_delete=models.SET_NULL, null=True, blank=True, related_name='reservations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Réservation'
        verbose_name_plural = 'Réservations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Réservation #{self.pk} — {self.nom} @ {self.restaurant.nom}"


# ─── Publications (fil social) ───────────────────────────────
# Modèles séparés dans models_publications.py pour ne pas alourdir ce fichier ;
# ré-exportés ici pour que « from core.models import Publication » fonctionne.
from .models_publications import (  # noqa: E402,F401
    Publication, PublicationQuerySet, PublicationMedia,
    PublicationLike, PublicationCommentaire,
)
from .models_fidelite import MouvementPoints, ParametrageFidelite  # noqa: E402,F401

# ─── Compléments et éléments inclus des plats ────────────────
from .models_complements import (  # noqa: E402,F401
    GroupeComplement, OptionComplement, ChoixLigneCommande, ElementInclus,
)

# ─── Bannières promo (accueil client) ────────────────────────
from .models_bannieres import Banniere  # noqa: E402,F401

# ─── Livraison libre (paramétrage, paiements livreurs, push) ──
from .models_livraison import (  # noqa: E402,F401
    ParametrageLivraison, PaiementLivreur, AbandonLivraison, AppareilPush,
)
