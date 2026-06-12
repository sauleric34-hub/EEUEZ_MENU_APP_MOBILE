from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import RestaurantProfile, Categorie, Plat, Commande, LigneCommande, Livraison, Avis

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'telephone', 'avatar']
        read_only_fields = ['role']

class RestaurantProfileSerializer(serializers.ModelSerializer):
    note_moyenne = serializers.ReadOnlyField()
    
    class Meta:
        model = RestaurantProfile
        fields = ['id', 'nom', 'description', 'adresse', 'ville', 'latitude', 'longitude', 'logo', 'cover_image', 'is_open', 'note_moyenne']

class PlatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plat
        fields = ['id', 'restaurant', 'nom', 'description', 'prix', 'image', 'is_available', 'allergies', 'ingredients']
        read_only_fields = ['restaurant']

class LigneCommandeSerializer(serializers.ModelSerializer):
    plat_details = PlatSerializer(source='plat', read_only=True)
    
    class Meta:
        model = LigneCommande
        fields = ['id', 'plat', 'plat_details', 'quantite', 'prix_unitaire']

class CommandeSerializer(serializers.ModelSerializer):
    lignes = LigneCommandeSerializer(many=True, read_only=True)
    restaurant_details = RestaurantProfileSerializer(source='restaurant', read_only=True)
    client_details = UserSerializer(source='client', read_only=True)
    
    class Meta:
        model = Commande
        fields = ['id', 'client', 'client_details', 'restaurant', 'restaurant_details', 'statut', 'montant_total', 'adresse_livraison', 'notes', 'created_at', 'lignes']

class LivraisonSerializer(serializers.ModelSerializer):
    commande_details = CommandeSerializer(source='commande', read_only=True)
    
    class Meta:
        model = Livraison
        fields = ['id', 'commande', 'commande_details', 'livreur', 'statut', 'latitude_actuelle', 'longitude_actuelle', 'estimated_delivery_time', 'delivered_at']

class AvisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Avis
        fields = ['id', 'commande', 'client', 'restaurant', 'note', 'commentaire', 'reponse_restaurant', 'created_at']
