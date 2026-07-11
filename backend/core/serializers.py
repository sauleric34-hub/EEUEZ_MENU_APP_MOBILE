from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Sum, Avg
from .models import (
    RestaurantProfile, Categorie, Plat, Commande, LigneCommande,
    Livraison, Avis, Favori, Abonnement, Conversation, Message, AdresseLivraison,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'telephone', 'allergies', 'avatar']
        read_only_fields = ['role']

    def get_avatar(self, obj):
        return obj.avatar.url if obj.avatar else None


class AdresseLivraisonSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdresseLivraison
        fields = ['id', 'label', 'adresse', 'details', 'latitude', 'longitude', 'is_default', 'created_at']
        read_only_fields = ['created_at']


class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ['id', 'nom', 'icone']


class RestaurantProfileSerializer(serializers.ModelSerializer):
    note_moyenne = serializers.ReadOnlyField()
    nombre_plats = serializers.SerializerMethodField()
    nombre_abonnes = serializers.SerializerMethodField()
    plat_du_jour = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantProfile
        fields = [
            'id', 'nom', 'description', 'adresse', 'ville', 'latitude', 'longitude',
            'logo', 'cover_image', 'is_open', 'note_moyenne', 'temps_livraison_moyen',
            'frais_livraison', 'nombre_plats', 'nombre_abonnes', 'plat_du_jour',
        ]

    def get_nombre_plats(self, obj):
        return obj.plats.filter(is_available=True, is_visible=True).count()

    def get_nombre_abonnes(self, obj):
        return obj.abonnes.count()

    def get_plat_du_jour(self, obj):
        from django.utils import timezone
        p = obj.plats.filter(plat_du_jour_le=timezone.localdate(), is_available=True).first()
        return p.id if p else None


class PlatSerializer(serializers.ModelSerializer):
    categorie_nom = serializers.SerializerMethodField()
    restaurant_nom = serializers.SerializerMethodField()
    note = serializers.SerializerMethodField()
    nombre_notes = serializers.SerializerMethodField()
    ma_note = serializers.SerializerMethodField()
    nombre_commandes = serializers.SerializerMethodField()
    nombre_likes = serializers.SerializerMethodField()
    composition = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    prix_client = serializers.SerializerMethodField()

    class Meta:
        model = Plat
        fields = [
            'id', 'restaurant', 'restaurant_nom', 'categorie', 'categorie_nom',
            'nom', 'description', 'prix', 'prix_client', 'image', 'images', 'is_available', 'is_popular',
            'allergies', 'ingredients', 'composition', 'note', 'nombre_notes', 'ma_note',
            'nombre_commandes', 'nombre_likes',
        ]
        read_only_fields = ['restaurant']

    def get_prix_client(self, obj):
        # Prix réellement affiché et payé par le client (base + pourcentage plateforme)
        return obj.prix_client

    def get_categorie_nom(self, obj):
        return obj.categorie.nom if obj.categorie else None

    def get_restaurant_nom(self, obj):
        return obj.restaurant.nom if obj.restaurant else None

    def get_note(self, obj):
        # Moyenne des notes clients du plat ; repli sur la note du restaurant.
        avg = obj.notes.aggregate(a=Avg('note'))['a']
        if avg is not None:
            return round(avg, 1)
        return obj.restaurant.note_moyenne if obj.restaurant else 0

    def get_nombre_notes(self, obj):
        return obj.notes.count()

    def get_ma_note(self, obj):
        request = self.context.get('request')
        if not request or not request.user or request.user.is_anonymous:
            return None
        mine = obj.notes.filter(client=request.user).first()
        return mine.note if mine else None

    def get_images(self, obj):
        urls = []
        if obj.image:
            urls.append(obj.image.url)
        urls.extend(p.image.url for p in obj.photos.all() if p.image)
        return urls

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


class MessageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender', 'texte', 'image', 'is_read', 'created_at']

    def get_image(self, obj):
        return obj.image.url if obj.image else None


class ConversationSerializer(serializers.ModelSerializer):
    plat_details = PlatSerializer(source='plat', read_only=True)
    restaurant_nom = serializers.SerializerMethodField()
    dernier_message = serializers.SerializerMethodField()
    non_lus = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'plat', 'plat_details', 'restaurant', 'restaurant_nom',
            'dernier_message', 'non_lus', 'updated_at',
        ]

    def get_restaurant_nom(self, obj):
        return obj.restaurant.nom if obj.restaurant else None

    def get_dernier_message(self, obj):
        last = obj.messages.last()
        return MessageSerializer(last).data if last else None

    def get_non_lus(self, obj):
        return obj.messages.filter(sender='restaurant', is_read=False).count()
