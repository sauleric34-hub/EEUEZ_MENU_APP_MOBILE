"""Test de charge Menu — simule des utilisateurs réels sur les parcours publics.

Les poids reflètent l'usage réel : on LIT beaucoup plus qu'on ne commande.
C'est ce déséquilibre qui rend « 1000 utilisateurs » atteignable — la plupart
scrollent, quelques-uns commandent.

Lancer :
    pip install -r load_test/requirements.txt
    locust -f load_test/locustfile.py --host https://menu.cambus.cm

puis ouvrir http://localhost:8089 et renseigner :
    • Number of users        : 1000
    • Ramp up (users/second) : 50      (montée progressive, pas d'un coup)

Sans interface (pour l'intégration continue) :
    locust -f load_test/locustfile.py --host https://menu.cambus.cm \
           --headless -u 1000 -r 50 -t 3m --csv=resultats
"""

import random

from locust import HttpUser, task, between


# Identifiants de plats/restaurants à visiter. À adapter à la base ciblée :
# l'idéal est de pointer vers des identifiants qui existent réellement.
IDS_RESTAURANTS = list(range(1, 21))
IDS_PLATS = list(range(1, 51))


class Visiteur(HttpUser):
    """Utilisateur qui découvre la plateforme sans se connecter.

    C'est le profil DOMINANT : page d'accueil, catalogue, fiches. Toutes ces
    routes sont publiques (AllowAny), donc pas de jeton à gérer.
    """

    # Temps de réflexion entre deux actions : un humain ne mitraille pas.
    # Sans ce délai, 1000 « utilisateurs » Locust = 1000 requêtes en continu,
    # ce qui ne ressemble à aucun trafic réel.
    wait_time = between(2, 8)

    @task(10)
    def accueil(self):
        # Page la plus visitée, et mise en cache : sert de témoin (doit rester
        # rapide même à forte charge).
        self.client.get('/', name='/ (accueil)')

    @task(8)
    def liste_plats(self):
        self.client.get('/api/client/plats', name='/api/client/plats')

    @task(5)
    def liste_restaurants(self):
        self.client.get('/api/client/restaurants', name='/api/client/restaurants')

    @task(6)
    def fiche_plat(self):
        pid = random.choice(IDS_PLATS)
        # name figé : sinon chaque identifiant crée sa propre ligne de stats.
        self.client.get(f'/api/client/plats/{pid}', name='/api/client/plats/[id]')

    @task(4)
    def fiche_restaurant(self):
        rid = random.choice(IDS_RESTAURANTS)
        self.client.get(
            f'/api/client/restaurants/{rid}', name='/api/client/restaurants/[id]',
        )

    @task(3)
    def restaurants_proches(self):
        # Route la plus coûteuse (calcul de distance sur tous les restaurants) :
        # à surveiller de près dans les résultats.
        self.client.get(
            '/api/client/restaurants/nearby?lat=3.848&lon=11.502&rayon=10',
            name='/api/client/restaurants/nearby',
        )
