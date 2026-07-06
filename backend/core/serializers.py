from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Sum
from .models import (
    RestaurantProfile, Categorie, Plat, Commande, LigneCommande,
    Livraison, Avis, Favori, Abonnement,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'telephone', 'avatar']
        read_only_fields = ['role']


class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ['id', 'nom', 'icone']


class RestaurantProfileSerializer(serializers.ModelSerializer):
    note_moyenne = serializers.ReadOnlyField()
    nombre_plats = serializers.SerializerMethodField()
    nombre_abonnes = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantProfile
        fields = [
            'id', 'nom', 'description', 'adresse', 'ville', 'latitude', 'longitude',
            'logo', 'cover_image', 'is_open', 'note_moyenne', 'temps_livraison_moyen',
            'frais_livraison', 'nombre_plats', 'nombre_abonnes',
        ]

    def get_nombre_plats(self, obj):
        return obj.plats.filter(is_available=True, is_visible=True).count()

    def get_nombre_abonnes(self, obj):
        return obj.abonnes.count()


class PlatSerializer(serializers.ModelSerializer):
    categorie_nom = serializers.SerializerMethodField()
    restaurant_nom = serializers.SerializerMethodField()
    note = serializers.SerializerMethodField()
    nombre_commandes = serializers.SerializerMethodField()
    nombre_likes = serializers.SerializerMethodField()
    composition = serializers.SerializerMethodField()

    class Meta:
        model = Plat
        fields = [
            'id', 'restaurant', 'restaurant_nom', 'categorie', 'categorie_nom',
            'nom', 'description', 'prix', 'image', 'is_available', 'is_popular',
            'allergies', 'ingredients', 'composition', 'note',
            'nombre_commandes', 'nombre_likes',
        ]
        read_only_fields = ['restaurant']

    def get_categorie_nom(self, obj):
        return obj.categorie.nom if obj.categorie else None

    def get_restaurant_nom(self, obj):
        return obj.restaurant.nom if obj.restaurant else None

    def get_note(self, obj):
        # Pas de note par plat en base : on reprend la note du restaurant.
        return obj.restaurant.note_moyenne if obj.restaurant else 0

    def get_nombre_commandes(self, obj):
        total = obj.lignecommande_set.aggregate(t=Sum('quantite'))['t'] if hasattr(obj, 'lignecommande_set') else None
        if total is None:
            total = LigneCommande.objects.filter(plat=obj).aggregate(t=Sum('quantite'))['t']
        return total or 0

    def get_nombre_likes(self, obj):
        return obj.favoris.count()

    def get_composition(self, obj):
        raw = obj.ingredients or ''
        return [p.strip() for p in raw.replace(';', ',').split(',') if p.strip()]

    def _normalize_composition_input(self, value):
        if value in (None, ''):
            return ''
        if isinstance(value, str):
            return ', '.join([p.strip() for p in value.replace(';', ',').split(',') if p.strip()])
        if isinstance(value, list):
            parts = []
            for item in value:
                if not isinstance(item, str):
                    raise serializers.ValidationError('Chaque élément de composition doit être une chaîne.')
                cleaned = item.strip()
                if cleaned:
                    parts.append(cleaned)
            return ', '.join(parts)
        raise serializers.ValidationError('La composition doit être une liste de chaînes ou une chaîne.')

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if hasattr(self, 'initial_data') and 'composition' in self.initial_data:
            attrs['ingredients'] = self._normalize_composition_input(self.initial_data.get('composition'))
        return attrs


class LigneCommandeSerializer(serializers.ModelSerializer):
    plat_details = PlatSerializer(source='plat', read_only=True)

    class Meta:
        model = LigneCommande
        fields = ['id', 'plat', 'plat_details', 'quantite', 'prix_unitaire']


class CommandeSerializer(serializers.ModelSerializer):
    lignes = LigneCommandeSerializer(many=True, read_only=True)
    restaurant_details = RestaurantProfileSerializer(source='restaurant', read_only=True)
    client_details = UserSerializer(source='client', read_only=True)
    livraison_statut = serializers.SerializerMethodField()

    class Meta:
        model = Commande
        fields = [
            'id', 'client', 'client_details', 'restaurant', 'restaurant_details',
            'statut', 'livraison_statut', 'montant_total', 'adresse_livraison',
            'notes', 'delai_estime', 'created_at', 'lignes',
        ]

    def get_livraison_statut(self, obj):
        liv = getattr(obj, 'livraison', None)
        return liv.statut if liv else None


class LivraisonSerializer(serializers.ModelSerializer):
    commande_details = CommandeSerializer(source='commande', read_only=True)

    class Meta:
        model = Livraison
        fields = [
            'id', 'commande', 'commande_details', 'livreur', 'statut',
            'latitude_actuelle', 'longitude_actuelle', 'estimated_delivery_time', 'delivered_at',
        ]


class AvisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Avis
        fields = ['id', 'commande', 'client', 'restaurant', 'note', 'commentaire', 'reponse_restaurant', 'created_at']
        read_only_fields = ['client', 'restaurant']


class FavoriSerializer(serializers.ModelSerializer):
    plat_details = PlatSerializer(source='plat', read_only=True)

    class Meta:
        model = Favori
        fields = ['id', 'plat', 'plat_details', 'created_at']


class AbonnementSerializer(serializers.ModelSerializer):
    restaurant_details = RestaurantProfileSerializer(source='restaurant', read_only=True)

    class Meta:
        model = Abonnement
        fields = ['id', 'restaurant', 'restaurant_details', 'created_at']
