import os
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import User, RestaurantProfile, Categorie, Plat, Commande, LigneCommande, Livraison, Avis, Transaction

# Mot de passe de l'admin de démo. Surchargeable via SEED_ADMIN_PASSWORD pour ne
# jamais créer un superutilisateur avec un mot de passe connu en production.
ADMIN_PASSWORD = os.environ.get('SEED_ADMIN_PASSWORD', 'admin123')

RESTAURANTS = [
    {"nom": "Le Phénix d'Or", "ville": "Yaoundé", "adresse": "Avenue Kennedy", "lat": 3.8667, "lng": 11.5167, "rate": 12},
    {"nom": "Chez Mama Africa", "ville": "Douala", "adresse": "Rue de la Joie", "lat": 4.0511, "lng": 9.7679, "rate": 10},
    {"nom": "Saveurs du Cameroun", "ville": "Yaoundé", "adresse": "Quartier Bastos", "lat": 3.8800, "lng": 11.5300, "rate": 8},
    {"nom": "Le Griot Fumé", "ville": "Bafoussam", "adresse": "Centre Commercial", "lat": 5.4737, "lng": 10.4175, "rate": 15},
    {"nom": "Ndolé & Co", "ville": "Douala", "adresse": "Bonanjo", "lat": 4.0480, "lng": 9.6980, "rate": 10},
    {"nom": "Pizza Afrik", "ville": "Yaoundé", "adresse": "Melen", "lat": 3.8480, "lng": 11.5020, "rate": 9},
    {"nom": "Braises & Épices", "ville": "Kribi", "adresse": "Bord de mer", "lat": 2.9396, "lng": 9.9096, "rate": 11},
]

PLATS = [
    ("Ndolé au poisson", 3500), ("Poulet DG", 4000), ("Eru et waterfufu", 3000),
    ("Beignets haricots", 500), ("Soya grillé", 1500), ("Poisson braisé", 5000),
    ("Miondo + sauce jaune", 2000), ("Pizza Margherita", 4500), ("Jus de gingembre", 800),
    ("Tchiep bou dien", 3500), ("Plantains frits", 1000), ("Bouillon de bœuf", 2500),
]

NOMS = [
    ("Sophie", "Mbarga"), ("Jean", "Kamga"), ("Paul", "Nkolo"), ("Marie", "Essama"),
    ("Robert", "Fonkoua"), ("Cécile", "Abo"), ("Ahmed", "Moussa"), ("Fatou", "Diallo"),
    ("Emmanuel", "Biya"), ("Grace", "Ndongo"), ("Victor", "Mvogo"), ("Sandra", "Tekam"),
]

CATEGORIES = ["Plats de résistance", "Grillades", "Soupes & Bouillons", "Boissons", "Desserts", "Entrées"]


class Command(BaseCommand):
    help = "Peuple la base de données avec des données de démo réalistes"

    def handle(self, *args, **kwargs):
        self.stdout.write(">> Creation des donnees de demo...")

        # Admin
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser(
                username="admin",
                email="admin@eeuez.cm",
                password=ADMIN_PASSWORD,
                role="admin",
            )
            self.stdout.write("  OK admin créé (username: admin)")
        else:
            admin = User.objects.get(username="admin")
            admin.set_password(ADMIN_PASSWORD)
            admin.role = "admin"
            admin.is_staff = True
            admin.is_superuser = True
            admin.save()
            self.stdout.write("  OK admin mis à jour (username: admin)")

        # Catégories
        cats = []
        for nom in CATEGORIES:
            cat, _ = Categorie.objects.get_or_create(nom=nom)
            cats.append(cat)
        self.stdout.write(f"  OK{len(cats)} catégories")

        # Clients
        clients = []
        for i, (prenom, nom) in enumerate(NOMS):
            username = f"{prenom.lower()}.{nom.lower()}{i}"
            if not User.objects.filter(username=username).exists():
                u = User.objects.create_user(
                    username=username, email=f"{username}@gmail.com",
                    password="test123", role="client",
                    first_name=prenom, last_name=nom,
                )
                clients.append(u)
            else:
                clients.append(User.objects.get(username=username))
        self.stdout.write(f"  OK{len(clients)} clients")

        # Restaurants
        profiles = []
        for i, r in enumerate(RESTAURANTS):
            username = f"resto{i+1}"
            if not User.objects.filter(username=username).exists():
                u = User.objects.create_user(
                    username=username, email=f"contact@{r['nom'].lower().replace(' ', '')}.cm",
                    password="test123", role="restaurant",
                    first_name=r["nom"],
                )
            else:
                u = User.objects.get(username=username)
            profile, _ = RestaurantProfile.objects.get_or_create(
                user=u,
                defaults={
                    "nom": r["nom"], "ville": r["ville"], "adresse": r["adresse"],
                    "latitude": r["lat"], "longitude": r["lng"],
                    "commission_rate": r["rate"], "is_verified": True, "is_open": True,
                }
            )
            profiles.append(profile)

            # Plats pour ce restaurant
            for nom_plat, prix in random.sample(PLATS, k=random.randint(4, 8)):
                if not Plat.objects.filter(restaurant=profile, nom=nom_plat).exists():
                    Plat.objects.create(
                        restaurant=profile, nom=nom_plat, prix=prix,
                        categorie=random.choice(cats),
                        is_available=True, is_popular=random.random() > 0.6,
                    )
        self.stdout.write(f"  OK{len(profiles)} restaurants")

        # Commandes (sur les 90 derniers jours)
        statuts = ['livree', 'livree', 'livree', 'annulee', 'en_attente', 'en_livraison']
        modes = ['mtn_money', 'orange_money', 'carte', 'especes']
        nb_commandes = 0

        for _ in range(150):
            client = random.choice(clients)
            restaurant = random.choice(profiles)
            plats = list(restaurant.plats.all())
            if not plats:
                continue

            montant = sum(random.choice(plats).prix for _ in range(random.randint(1, 4)))
            statut = random.choice(statuts)
            days_ago = random.randint(0, 90)
            created = timezone.now() - timedelta(days=days_ago, hours=random.randint(0, 23))

            cmd = Commande(
                client=client, restaurant=restaurant, statut=statut,
                montant_total=montant, adresse_livraison=f"{client.first_name} — {restaurant.ville}",
            )
            cmd.save()
            cmd.created_at = created
            cmd.updated_at = created
            Commande.objects.filter(pk=cmd.pk).update(created_at=created, updated_at=created)

            # Livraison
            if statut in ['livree', 'en_livraison']:
                liv_statut = 'livree' if statut == 'livree' else 'en_livraison'
                Livraison.objects.create(
                    commande=cmd, statut=liv_statut,
                    delivered_at=created + timedelta(minutes=random.randint(20, 60)) if statut == 'livree' else None,
                )

            # Avis
            if statut == 'livree' and random.random() > 0.4:
                try:
                    Avis.objects.create(
                        commande=cmd, client=client, restaurant=restaurant,
                        note=random.randint(3, 5),
                        commentaire=random.choice([
                            "Très bon repas, je recommande !",
                            "Livraison rapide et plat délicieux.",
                            "Satisfait de ma commande.",
                            "Le Ndolé était excellent !",
                            "Service correct, reviendrai.",
                        ])
                    )
                except Exception:
                    pass

            # Transaction
            if statut == 'livree':
                mode = random.choice(modes)
                Transaction.objects.create(
                    commande=cmd, type='paiement_client',
                    montant=montant, mode_paiement=mode, statut='complete',
                )

            nb_commandes += 1

        self.stdout.write(f"  OK{nb_commandes} commandes")
        self.stdout.write(self.style.SUCCESS("OK - Donnees de demo creees avec succes !"))
        self.stdout.write(f"\n  Login : admin / admin123")
        self.stdout.write(f"  URL   : http://localhost:8000/admin-panel/login/\n")
