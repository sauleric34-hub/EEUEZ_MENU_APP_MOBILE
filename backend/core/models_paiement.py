"""Agrégateurs de paiement multi-pays (CamerPay, CinetPay, Campay, PawaPay).

L'admin décide, pour chaque PAYS (et éventuellement chaque VILLE) et chaque
OPÉRATEUR Mobile Money, quel agrégateur encaisse, avec un ordre de secours :
le routeur (core/paiements/routeur.py) prend le premier disponible et bascule
automatiquement sur le suivant si le lancement échoue.

Les identifiants (clés API, secrets) ne sont JAMAIS stockés ici : ils restent
dans le .env, la base ne garde que l'état opérationnel (actif, maintenance).
"""
from django.db import models

from .models_bannieres import normaliser_ville


class Agregateur(models.Model):
    CAMERPAY = 'camerpay'
    CINETPAY = 'cinetpay'
    CAMPAY = 'campay'
    PAWAPAY = 'pawapay'
    CODE_CHOICES = [
        (CAMERPAY, 'CamerPay'),
        (CINETPAY, 'CinetPay'),
        (CAMPAY, 'Campay'),
        (PAWAPAY, 'PawaPay'),
    ]

    code = models.CharField(max_length=20, choices=CODE_CHOICES, unique=True)
    actif = models.BooleanField(default=False)
    # Maintenance : l'agrégateur reste configuré mais n'est plus proposé par
    # le routeur (bascule immédiate vers le secours) — utile en période de crise.
    en_maintenance = models.BooleanField(default=False)
    note_maintenance = models.CharField(max_length=200, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Agrégateur de paiement'
        verbose_name_plural = 'Agrégateurs de paiement'
        ordering = ['code']

    def __str__(self):
        return self.get_code_display()


class Operateur(models.Model):
    """Opérateur Mobile Money (MTN MoMo, Orange Money, Wave…). Le code est
    l'identifiant échangé avec l'app et traduit par chaque adaptateur."""

    code = models.SlugField(max_length=30, unique=True)
    nom = models.CharField(max_length=60)
    couleur = models.CharField(max_length=7, default='#f26a1b')
    logo = models.ImageField(upload_to='operateurs/', blank=True, null=True)
    # Indication affichée sous le champ numéro (ex. « 6 7X XX XX XX »)
    format_numero = models.CharField(max_length=40, blank=True)
    actif = models.BooleanField(default=True)
    ordre = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = 'Opérateur Mobile Money'
        verbose_name_plural = 'Opérateurs Mobile Money'
        ordering = ['ordre', 'nom']

    def __str__(self):
        return self.nom


class PaysPaiement(models.Model):
    """Pays où l'encaissement en ligne est ouvert, avec sa devise."""

    pays_code = models.CharField(max_length=2, unique=True)
    devise = models.CharField(max_length=3, default='XAF')
    indicatif = models.CharField(max_length=5, blank=True, help_text='Ex. 237 (sans +)')
    actif = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Pays de paiement'
        verbose_name_plural = 'Pays de paiement'
        ordering = ['pays_code']

    def __str__(self):
        return self.pays_code


class RoutePaiement(models.Model):
    """« Dans ce pays (cette ville), cet opérateur passe par cet agrégateur,
    avec cette priorité ». Ville vide = tout le pays ; une règle de ville
    remplace celles du pays pour cette ville."""

    pays_code = models.CharField(max_length=2)
    ville = models.CharField(max_length=100, blank=True)
    ville_normalisee = models.CharField(max_length=100, blank=True, editable=False, db_index=True)
    operateur = models.ForeignKey(Operateur, on_delete=models.CASCADE, related_name='routes')
    agregateur = models.ForeignKey(Agregateur, on_delete=models.CASCADE, related_name='routes')
    priorite = models.PositiveSmallIntegerField(default=1, help_text='1 = principal, 2 = premier secours…')
    actif = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Route de paiement'
        verbose_name_plural = 'Routes de paiement'
        ordering = ['pays_code', 'ville_normalisee', 'operateur__ordre', 'priorite']
        constraints = [
            models.UniqueConstraint(
                fields=['pays_code', 'ville_normalisee', 'operateur', 'agregateur'],
                name='route_paiement_unique',
            ),
        ]
        indexes = [models.Index(fields=['pays_code', 'ville_normalisee'])]

    def save(self, *args, **kwargs):
        self.ville = ' '.join((self.ville or '').split())
        self.ville_normalisee = normaliser_ville(self.ville)
        super().save(*args, **kwargs)

    def __str__(self):
        lieu = f'{self.pays_code}/{self.ville}' if self.ville else self.pays_code
        return f'{lieu} · {self.operateur} → {self.agregateur} (#{self.priorite})'


class TentativePaiement(models.Model):
    """Journal de chaque lancement de paiement : sert aux statistiques de
    santé des agrégateurs (page admin), au disjoncteur et à la réconciliation
    des paiements restés en attente (webhook perdu)."""

    STATUT_CHOICES = [
        ('echec_lancement', 'Échec du lancement'),
        ('en_attente', 'En attente'),
        ('complete', 'Payé'),
        ('echouee', 'Échoué'),
        ('remboursee', 'Remboursé'),
    ]
    OBJET_CHOICES = [
        ('commande', 'Commande'),
        ('groupe', 'Panier multi-restaurants'),
        ('reservation', 'Réservation'),
    ]

    reference = models.CharField(max_length=100, db_index=True)
    objet = models.CharField(max_length=15, choices=OBJET_CHOICES)
    agregateur = models.CharField(max_length=20, db_index=True)
    operateur = models.CharField(max_length=30, blank=True)
    pays_code = models.CharField(max_length=2, blank=True)
    ville = models.CharField(max_length=100, blank=True)
    montant = models.DecimalField(max_digits=12, decimal_places=0)
    devise = models.CharField(max_length=3, default='XAF')
    flux = models.CharField(max_length=12, blank=True)  # redirection / push
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente', db_index=True)
    provider_reference = models.CharField(max_length=100, blank=True, db_index=True)
    erreur = models.CharField(max_length=300, blank=True)
    duree_ms = models.PositiveIntegerField(default=0)
    bascule = models.BooleanField(default=False, help_text='Lancée en secours après l\'échec d\'un autre agrégateur')
    derniere_verification = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tentative de paiement'
        verbose_name_plural = 'Tentatives de paiement'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['agregateur', 'created_at'])]

    def __str__(self):
        return f'{self.reference} via {self.agregateur} ({self.statut})'


class AlerteAdmin(models.Model):
    """Notification affichée dans l'espace admin (cloche de la barre latérale)."""

    NIVEAU_CHOICES = [('info', 'Information'), ('avertissement', 'Avertissement'), ('critique', 'Critique')]
    CATEGORIE_CHOICES = [
        ('paiement', 'Paiements'),
        ('livraison', 'Livraisons'),
        ('securite', 'Sécurité'),
        ('systeme', 'Système'),
    ]

    niveau = models.CharField(max_length=15, choices=NIVEAU_CHOICES, default='info')
    categorie = models.CharField(max_length=15, choices=CATEGORIE_CHOICES, default='systeme')
    titre = models.CharField(max_length=160)
    message = models.TextField(blank=True)
    donnees = models.JSONField(default=dict, blank=True)
    lue = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Alerte admin'
        verbose_name_plural = 'Alertes admin'
        ordering = ['-created_at']

    def __str__(self):
        return self.titre


class DestinataireAlerte(models.Model):
    """Adresse qui reçoit les e-mails d'urgence, par catégorie."""

    email = models.EmailField(unique=True)
    nom = models.CharField(max_length=100, blank=True)
    actif = models.BooleanField(default=True)
    # Catégories reçues (cf. AlerteAdmin.CATEGORIE_CHOICES)
    categories = models.JSONField(default=list, blank=True)
    niveau_minimum = models.CharField(max_length=15, choices=AlerteAdmin.NIVEAU_CHOICES, default='avertissement')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Destinataire d'alertes"
        verbose_name_plural = "Destinataires d'alertes"
        ordering = ['email']

    def __str__(self):
        return self.email

    def recoit(self, categorie, niveau):
        ordre = {'info': 0, 'avertissement': 1, 'critique': 2}
        return (
            self.actif
            and (not self.categories or categorie in self.categories)
            and ordre.get(niveau, 0) >= ordre.get(self.niveau_minimum, 1)
        )
