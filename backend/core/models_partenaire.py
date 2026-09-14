# ═══════════════════════════════════════════════════════════
#  API Partenaires — KYB (vérification d'entreprise), identifiants d'accès
#  signés HMAC, et webhooks sortants.
#
#  Un « Partenaire » est une AUTRE plateforme/entreprise qui veut lire le
#  catalogue restaurants et/ou créer des commandes via l'API — jamais un
#  compte humain : ce n'est donc pas un rôle de plus sur `User` (voir
#  core/partner_auth.py pour la justification de ce choix).
# ═══════════════════════════════════════════════════════════

import os
import secrets

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F
from django.utils import timezone

from .partner_crypto import chiffrer_secret, dechiffrer_secret
from .storage import kyb_storage

TAILLE_MAX_DOCUMENT_KYB = 10 * 1024 * 1024  # 10 Mo
EXTENSIONS_KYB_AUTORISEES = ('.pdf', '.jpg', '.jpeg', '.png')

# ─── Plans tarifaires ──────────────────────────────────────────────────────
# Grille validée avec l'équipe business (discussion produit) — les montants/
# quotas ne sont PAS gravés dans le marbre : ils vivent ici, en un seul
# endroit, pour être ajustés sans toucher au reste du code (auth, vues,
# throttling) qui ne fait que LIRE ce dictionnaire.
#
# `commission_pourcentage` : prélevée sur `montant_total` de chaque commande
# créée par ce partenaire (0 = aucune, plans à abonnement fixe). C'est ce qui
# finance le plan Croissance : gratuit à l'entrée, le revenu vient du volume
# réellement généré plutôt que d'un forfait — voir Commande.commission_partenaire
# (core/partner_views.py::creer_commande) pour le calcul, figé à la création.
PLAN_DECOUVERTE = 'decouverte'
PLAN_CROISSANCE = 'croissance'
PLAN_BUSINESS = 'business'
PLAN_SCALE = 'scale'

PLANS = {
    PLAN_DECOUVERTE: {
        'label': 'Découverte',
        'prix_mensuel_fcfa': 0,
        'commission_pourcentage': 0,
        'quota_requetes_mois': 2000,
        'ecriture_commandes': False,
        'environnement_live': False,
        'webhooks': False,
    },
    PLAN_CROISSANCE: {
        'label': 'Croissance',
        'prix_mensuel_fcfa': 0,
        'commission_pourcentage': 1,  # 1 % du montant_total de chaque commande
        # Illimité : le revenu vient de la commission (plus de volume = plus
        # de revenu), pas d'un forfait à protéger — pas de raison de brider
        # ce plan comme Découverte (gratuit et non commissionné, lui, borné).
        'quota_requetes_mois': None,
        'ecriture_commandes': True,
        'environnement_live': True,
        'webhooks': False,
    },
    PLAN_BUSINESS: {
        'label': 'Business',
        'prix_mensuel_fcfa': 50000,
        'commission_pourcentage': 0,
        'quota_requetes_mois': 50000,
        'ecriture_commandes': True,
        'environnement_live': True,
        'webhooks': True,
    },
    PLAN_SCALE: {
        'label': 'Scale',
        'prix_mensuel_fcfa': None,  # sur devis
        'commission_pourcentage': 0,  # négocié au contrat si applicable
        'quota_requetes_mois': None,  # illimité (contractuel)
        'ecriture_commandes': True,
        'environnement_live': True,
        'webhooks': True,
    },
}
PLAN_CHOICES = [(code, config['label']) for code, config in PLANS.items()]


def valider_document_kyb(fichier):
    """Lève ValidationError si le fichier dépasse la taille max ou n'a pas
    une extension autorisée.

    À appeler EXPLICITEMENT avant tout `DocumentKYB.objects.create(...)` :
    `.objects.create()` n'exécute jamais les validators d'un champ, seul
    `full_clean()` le ferait — or aucun des deux points d'entrée (API et
    formulaire web) ne passe par un ModelForm.
    """
    if fichier.size > TAILLE_MAX_DOCUMENT_KYB:
        raise ValidationError("Fichier trop volumineux (10 Mo maximum).")
    if os.path.splitext(fichier.name)[1].lower() not in EXTENSIONS_KYB_AUTORISEES:
        raise ValidationError("Format non accepté (PDF, JPG ou PNG uniquement).")


class Partenaire(models.Model):
    STATUT_EN_ATTENTE = 'en_attente'
    STATUT_EN_VERIFICATION = 'en_verification'
    STATUT_APPROUVE = 'approuve'
    STATUT_REJETE = 'rejete'
    STATUT_SUSPENDU = 'suspendu'
    STATUT_CHOICES = [
        (STATUT_EN_ATTENTE, 'En attente'),
        (STATUT_EN_VERIFICATION, 'En vérification'),
        (STATUT_APPROUVE, 'Approuvé'),
        (STATUT_REJETE, 'Rejeté'),
        (STATUT_SUSPENDU, 'Suspendu'),
    ]

    nom_commercial = models.CharField(max_length=200)
    raison_sociale = models.CharField(max_length=200, blank=True)
    # Pays du partenaire — conditionne QUELS documents KYB ont du sens
    # (RCCM/NIU sont des identifiants camerounais). Un partenaire hors
    # Cameroun renseigne ses équivalents locaux via le type de document
    # « Autre » plutôt que d'attendre un futur champ dédié par pays — cf.
    # DocumentKYB.TYPE_AUTRE. Défaut Cameroun : marché actuel de la plateforme.
    pays = models.CharField(max_length=100, default='Cameroun')
    numero_rccm = models.CharField('N° RCCM (ou équivalent local)', max_length=100, blank=True)
    numero_contribuable = models.CharField('NIU (ou équivalent local)', max_length=100, blank=True)
    secteur = models.CharField(max_length=150, blank=True)
    site_web = models.URLField(blank=True)
    app_url = models.URLField(blank=True)
    contact_nom = models.CharField(max_length=150)
    contact_email = models.EmailField()
    contact_telephone = models.CharField(max_length=30, blank=True)
    adresse = models.CharField(max_length=300, blank=True)
    # Signal de vetting le plus utile : ce qu'ils comptent réellement construire.
    description_cas_usage = models.TextField()

    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default=PLAN_DECOUVERTE)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default=STATUT_EN_ATTENTE)
    motif_rejet = models.TextField(blank=True)
    motif_suspension = models.TextField(blank=True)
    decide_par = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    verifie_le = models.DateTimeField(null=True, blank=True)
    decide_le = models.DateTimeField(null=True, blank=True)

    # Portail self-service (core/views/partner_portal.py) : identifiant =
    # contact_email, mot de passe distinct de tout secret API (jamais en
    # clair — mêmes hashers que les comptes User). Généré par un admin après
    # approbation (voir partenaires_admin.mot_de_passe_generer), le
    # partenaire le change ensuite lui-même depuis le portail.
    mot_de_passe_hash = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Partenaire API'
        verbose_name_plural = 'Partenaires API'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.nom_commercial} ({self.get_statut_display()})"

    @property
    def est_actif(self):
        return self.statut == self.STATUT_APPROUVE

    @property
    def plan_config(self):
        return PLANS.get(self.plan, PLANS[PLAN_DECOUVERTE])

    def approuver(self, admin):
        self.statut = self.STATUT_APPROUVE
        self.decide_par = admin
        self.decide_le = timezone.now()
        self.motif_rejet = ''
        self.motif_suspension = ''
        self.save(update_fields=['statut', 'decide_par', 'decide_le', 'motif_rejet', 'motif_suspension', 'updated_at'])

    def rejeter(self, admin, motif):
        self.statut = self.STATUT_REJETE
        self.decide_par = admin
        self.decide_le = timezone.now()
        self.motif_rejet = motif
        self.save(update_fields=['statut', 'decide_par', 'decide_le', 'motif_rejet', 'updated_at'])

    def suspendre(self, admin, motif):
        self.statut = self.STATUT_SUSPENDU
        self.decide_par = admin
        self.decide_le = timezone.now()
        self.motif_suspension = motif
        self.save(update_fields=['statut', 'decide_par', 'decide_le', 'motif_suspension', 'updated_at'])

    def definir_mot_de_passe(self, mot_de_passe_clair):
        from django.contrib.auth.hashers import make_password
        self.mot_de_passe_hash = make_password(mot_de_passe_clair)
        self.save(update_fields=['mot_de_passe_hash'])

    def verifier_mot_de_passe(self, mot_de_passe_clair):
        from django.contrib.auth.hashers import check_password
        if not self.mot_de_passe_hash:
            return False
        return check_password(mot_de_passe_clair, self.mot_de_passe_hash)


class DocumentKYB(models.Model):
    TYPE_RCCM = 'rccm'
    TYPE_NIU = 'niu'
    TYPE_PIECE_IDENTITE = 'piece_identite_dirigeant'
    TYPE_AUTRE = 'autre'
    TYPE_CHOICES = [
        (TYPE_RCCM, 'Registre du Commerce (RCCM)'),
        (TYPE_NIU, "Attestation de Numéro d'Identifiant Unique (NIU)"),
        (TYPE_PIECE_IDENTITE, 'Pièce d\'identité du dirigeant'),
        (TYPE_AUTRE, 'Autre document'),
    ]
    STATUT_SOUMIS = 'soumis'
    STATUT_VALIDE = 'valide'
    STATUT_REJETE = 'rejete'
    STATUT_CHOICES = [
        (STATUT_SOUMIS, 'Soumis'),
        (STATUT_VALIDE, 'Validé'),
        (STATUT_REJETE, 'Rejeté'),
    ]

    partenaire = models.ForeignKey(Partenaire, on_delete=models.CASCADE, related_name='documents')
    type_document = models.CharField(max_length=30, choices=TYPE_CHOICES)
    fichier = models.FileField(upload_to='kyb/%Y/%m/', storage=kyb_storage)
    statut = models.CharField(max_length=10, choices=STATUT_CHOICES, default=STATUT_SOUMIS)
    commentaire = models.CharField(max_length=300, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Document KYB'
        verbose_name_plural = 'Documents KYB'
        ordering = ['type_document']

    def __str__(self):
        return f"{self.get_type_document_display()} — {self.partenaire.nom_commercial}"


def _generer_cle(environnement):
    prefixe = 'pk_live' if environnement == APICredential.ENV_LIVE else 'pk_sandbox'
    return f"{prefixe}_{secrets.token_hex(16)}"


class APICredential(models.Model):
    ENV_SANDBOX = 'sandbox'
    ENV_LIVE = 'live'
    ENV_CHOICES = [(ENV_SANDBOX, 'Sandbox'), (ENV_LIVE, 'Live')]
    STATUT_ACTIVE = 'active'
    STATUT_REVOQUEE = 'revoquee'
    STATUT_CHOICES = [(STATUT_ACTIVE, 'Active'), (STATUT_REVOQUEE, 'Révoquée')]

    partenaire = models.ForeignKey(Partenaire, on_delete=models.CASCADE, related_name='credentials')
    api_key = models.CharField(max_length=64, unique=True, db_index=True)
    secret_chiffre = models.TextField()
    environnement = models.CharField(max_length=10, choices=ENV_CHOICES, default=ENV_SANDBOX)
    statut = models.CharField(max_length=10, choices=STATUT_CHOICES, default=STATUT_ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    derniere_utilisation = models.DateTimeField(null=True, blank=True)
    # Compteur d'usage MENSUEL (remis à zéro dès qu'on entre dans un nouveau
    # mois — voir enregistrer_utilisation) : c'est ce qui alimente le quota du
    # plan du partenaire et son suivi côté admin (facturation à l'usage).
    requetes_mois_courant = models.PositiveIntegerField(default=0)
    mois_courant = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = 'Identifiant API partenaire'
        verbose_name_plural = 'Identifiants API partenaires'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.api_key} ({self.partenaire.nom_commercial})"

    @classmethod
    def emettre(cls, partenaire, environnement=ENV_SANDBOX):
        """Crée un nouvel identifiant et renvoie (credential, secret_en_clair).

        Le secret en clair n'est JAMAIS stocké : c'est la seule occasion de
        le lire, à afficher une fois côté admin puis à relayer au partenaire
        hors-bande (voir core/views/partenaires_admin.py).
        """
        secret_clair = secrets.token_urlsafe(32)
        credential = cls.objects.create(
            partenaire=partenaire,
            api_key=_generer_cle(environnement),
            secret_chiffre=chiffrer_secret(secret_clair),
            environnement=environnement,
        )
        return credential, secret_clair

    def obtenir_secret(self):
        return dechiffrer_secret(self.secret_chiffre)

    def revoquer(self):
        self.statut = self.STATUT_REVOQUEE
        self.revoked_at = timezone.now()
        self.save(update_fields=['statut', 'revoked_at'])

    def enregistrer_utilisation(self):
        """Incrémente le compteur du mois courant (remis à zéro si on vient
        de changer de mois) — appelé à chaque requête authentifiée avec
        succès (voir core/partner_auth.py). Utilise F() pour rester correct
        sous requêtes concurrentes, sans verrou explicite (volume V1 modeste)."""
        premier_du_mois = timezone.now().date().replace(day=1)
        maintenant = timezone.now()
        if self.mois_courant != premier_du_mois:
            APICredential.objects.filter(pk=self.pk).update(
                mois_courant=premier_du_mois, requetes_mois_courant=1, derniere_utilisation=maintenant,
            )
            self.mois_courant = premier_du_mois
            self.requetes_mois_courant = 1
        else:
            APICredential.objects.filter(pk=self.pk).update(
                requetes_mois_courant=F('requetes_mois_courant') + 1, derniere_utilisation=maintenant,
            )
            self.requetes_mois_courant += 1
        self.derniere_utilisation = maintenant

    def quota_mensuel(self):
        return self.partenaire.plan_config['quota_requetes_mois']

    def quota_disponible(self):
        quota = self.quota_mensuel()
        return quota is None or self.requetes_mois_courant <= quota


class PartenaireWebhookConfig(models.Model):
    partenaire = models.OneToOneField(Partenaire, on_delete=models.CASCADE, related_name='webhook')
    url = models.URLField()
    secret_chiffre = models.TextField()
    actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuration webhook partenaire'
        verbose_name_plural = 'Configurations webhook partenaires'

    def __str__(self):
        return f"Webhook {self.partenaire.nom_commercial} → {self.url}"

    @classmethod
    def configurer(cls, partenaire, url):
        """Crée ou remplace la config webhook d'un partenaire, avec un
        nouveau secret (distinct de celui de son APICredential — rotation
        indépendante)."""
        secret_clair = secrets.token_urlsafe(32)
        config, _ = cls.objects.update_or_create(
            partenaire=partenaire,
            defaults={'url': url, 'secret_chiffre': chiffrer_secret(secret_clair), 'actif': True},
        )
        return config, secret_clair

    def obtenir_secret(self):
        return dechiffrer_secret(self.secret_chiffre)


class WebhookDelivery(models.Model):
    STATUT_EN_ATTENTE = 'en_attente'
    STATUT_ENVOYE = 'envoye'
    STATUT_ECHEC = 'echec'
    STATUT_CHOICES = [
        (STATUT_EN_ATTENTE, 'En attente'),
        (STATUT_ENVOYE, 'Envoyé'),
        (STATUT_ECHEC, 'Échec'),
    ]

    partenaire = models.ForeignKey(Partenaire, on_delete=models.CASCADE, related_name='webhook_deliveries')
    commande = models.ForeignKey('Commande', on_delete=models.SET_NULL, null=True, blank=True, related_name='webhook_deliveries')
    evenement = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    statut_envoi = models.CharField(max_length=10, choices=STATUT_CHOICES, default=STATUT_EN_ATTENTE)
    tentative = models.PositiveIntegerField(default=0)
    dernier_code_http = models.PositiveIntegerField(null=True, blank=True)
    derniere_erreur = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Envoi de webhook'
        verbose_name_plural = 'Envois de webhooks'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.evenement} → {self.partenaire.nom_commercial} ({self.get_statut_envoi_display()})"
