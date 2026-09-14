# ═══════════════════════════════════════════════════════════
#  Sérialiseurs de la surface API Partenaires : sous-classes des sérialiseurs
#  internes (serializers.py) qui retirent les champs personnalisés à un
#  utilisateur connecté (favoris, notes perso…), inadaptés à un tiers.
#  Sous-classer plutôt que dupliquer : ils restent synchronisés si les
#  sérialiseurs internes évoluent (nouveau champ, calcul de prix, etc.).
# ═══════════════════════════════════════════════════════════

from rest_framework import serializers

from .models import Commande, DocumentKYB, LigneCommande, Partenaire
from .serializers import PlatSerializer, RestaurantProfileSerializer


class PartenairePlatSerializer(PlatSerializer):
    class Meta(PlatSerializer.Meta):
        fields = [f for f in PlatSerializer.Meta.fields if f not in ('ma_note', 'est_favori')]


class PartenaireRestaurantProfileSerializer(RestaurantProfileSerializer):
    class Meta(RestaurantProfileSerializer.Meta):
        fields = [f for f in RestaurantProfileSerializer.Meta.fields if f != 'is_following']


# ─── Candidature KYB ──────────────────────────────────────────
class DemandePartenaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = Partenaire
        fields = [
            'id', 'nom_commercial', 'raison_sociale', 'pays', 'numero_rccm', 'numero_contribuable',
            'secteur', 'site_web', 'app_url', 'contact_nom', 'contact_email', 'contact_telephone',
            'adresse', 'description_cas_usage', 'statut', 'created_at',
        ]
        read_only_fields = ['id', 'statut', 'created_at']


class DocumentKYBSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentKYB
        fields = ['id', 'type_document', 'fichier', 'statut', 'uploaded_at']
        read_only_fields = ['id', 'statut', 'uploaded_at']


# ─── Commandes créées par un partenaire ───────────────────────
class PartenaireLigneCommandeSerializer(serializers.ModelSerializer):
    plat_nom = serializers.SerializerMethodField()

    class Meta:
        model = LigneCommande
        fields = ['plat', 'plat_nom', 'quantite', 'prix_unitaire']

    def get_plat_nom(self, obj):
        return obj.plat.nom if obj.plat else None


class PartenaireCommandeSerializer(serializers.ModelSerializer):
    """Confirmation/statut d'une commande, côté partenaire : jamais
    `commission_eeuez` ni `montant_restaurant` (répartition interne)."""
    lignes = PartenaireLigneCommandeSerializer(many=True, read_only=True)

    class Meta:
        model = Commande
        fields = [
            'id', 'reference_externe', 'restaurant', 'statut', 'montant_total',
            'frais_livraison', 'emporter', 'code_retrait', 'adresse_livraison',
            'notes', 'delai_estime', 'paiement_confirme', 'lignes', 'created_at',
        ]
