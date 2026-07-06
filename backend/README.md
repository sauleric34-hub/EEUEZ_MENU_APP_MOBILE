# 🍽️ EEUEZ Menu — Backend API

Backend Django pour l'application EEUEZ Menu 🇨🇲

## 🚀 Démarrage rapide

### Prérequis
- Python 3.13
- pip

### Lancer le serveur
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Le serveur démarre sur **http://localhost:8000**

### Interfaces disponibles
| URL | Description |
|-----|-------------|
| http://localhost:8000/ | Landing page |
| http://localhost:8000/django-admin/ | Admin Django natif |
| http://localhost:8000/admin-panel/ | Panel d'administration EEUEZ |
| http://localhost:8000/api/ | API REST |

---

## 🔑 Rôles utilisateur

| Rôle | Description |
|------|-------------|
| admin | Administrateur de la plateforme |
| restaurant | Gestion d'un restaurant (menu, commandes, statistiques) |
| livreur | Livraison des commandes |
| client | Utilisateur final de l'app mobile |

---

## 📡 API Endpoints

### Auth (public)
```
POST /api/auth/login
POST /api/auth/register/<role>
GET  /api/auth/ping
```

### Client (JWT requis)
```
GET  /api/client/profile
GET  /api/client/restaurants/nearby?lat=...&lon=...
GET  /api/client/commandes/          (ViewSet)
```

### Restaurant (JWT rôle restaurant)
```
GET  /api/restaurant/workspace
GET  /api/restaurant/menu/plats/     (ViewSet)
GET  /api/restaurant/commandes/      (ViewSet)
```

### Livreur (JWT rôle livreur)
```
GET  /api/livreur/missions/          (ViewSet)
```

### Recommandations personnalisées (public)
```
GET /api/client/recommandations?lat=..&lon=..&limit=..
```
Classement des plats et restaurants par pertinence, calculé dans
[core/recommendation.py](core/recommendation.py) :

| Composante | Poids plat | Détail |
|------------|-----------|--------|
| **Proximité** | **45 %** | décroissance exponentielle (score ÷2 tous les 3 km) — cœur du produit : réduire le coût du transport |
| Commandes | 20 % | volume de commandes du plat (échelle log) |
| Likes | 15 % | favoris clients (échelle log) |
| Fraîcheur | 10 % | date de publication (bonus ÷2 après 14 jours) |
| Followers | 10 % | abonnés du restaurant (échelle log) |

Sans `lat`/`lon`, la proximité devient neutre → classement par popularité.
Chaque plat renvoyé inclut `score`, `distance_km`, `temps_estime` et `score_detail`.

### Carte (public)
```
GET  /api/map/restaurants
GET  /api/map/restaurants/search
GET  /api/map/restaurants/<id>/details
```

Voir [core/api_urls.py](core/api_urls.py) pour la liste exhaustive et à jour des routes.

---

## 📱 Configuration Frontend

Dans `eeuez-expo-ui/constants/api.ts`, adapter `API_BASE_URL` selon l'environnement (émulateur, appareil physique, production). Voir les commentaires dans ce fichier.

---

## 🏗️ Architecture

```
backend/
├── backend/        — Config du projet Django (settings, urls, wsgi/asgi)
├── core/
│   ├── models.py       — Modèles (User, RestaurantProfile, Commande, Plat...)
│   ├── views/           — Vues (auth, dashboard, deliveries, dishes, finances...)
│   ├── api_urls.py      — Routes de l'API REST (mobile)
│   ├── api_views.py     — Vues de l'API REST
│   ├── urls.py          — Routes du panel d'administration
│   └── serializers.py   — Sérialiseurs DRF
├── requirements.txt
└── manage.py
```

---

## 🔐 Mise en production — variables d'environnement

En production, **posez ces variables** (le code applique alors HTTPS, CORS restreint,
en-têtes de sécurité, throttling et Postgres) :

| Variable | Rôle | Exemple |
|----------|------|---------|
| `DEBUG` | Doit valoir `False` en prod | `False` |
| `SECRET_KEY` | Clé Django (obligatoire si `DEBUG=False`) | `python -c "import secrets;print(secrets.token_urlsafe(50))"` |
| `ALLOWED_HOSTS` | Domaines autorisés (séparés par des virgules) | `api.monapp.cm` |
| `CORS_ALLOWED_ORIGINS` | Origines front autorisées | `https://monapp.cm` |
| `CSRF_TRUSTED_ORIGINS` | Origines de confiance CSRF | `https://monapp.cm` |
| `DATABASE_URL` | Bascule sur PostgreSQL (sinon SQLite) | `postgres://user:pwd@host:5432/db` |

En dev, aucune variable n'est requise (`DEBUG=True`, SQLite, CORS ouvert).

### Sécurité déjà en place
- Authentification **JWT** (access + refresh via `POST /api/auth/refresh`).
- **Throttling** anti brute-force : `10/min` sur login/register, `60/min` anonyme, `240/min` connecté.
- Commandes/favoris/abonnements **réservés à l'utilisateur authentifié** (plus de bypass).
- Paiement enregistré en base (`Transaction`) ; **espèces à la livraison** fonctionnel.

### Tests
```bash
python manage.py test core
```
