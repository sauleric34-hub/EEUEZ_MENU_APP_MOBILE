# 🍽️ EEUEZ Menu — Backend API

Backend Spring Boot pour l'application EEUEZ Menu 🇨🇲

## 🚀 Démarrage rapide

### Prérequis
- Java 17+ installé
- Maven (ou utiliser le wrapper inclus `mvnw.cmd`)

### Lancer le serveur
```bash
cd "EEUEZ Menu/backend"
./mvnw.cmd spring-boot:run
```

Le serveur démarre sur **http://localhost:8080**

### Interfaces disponibles
| URL | Description |
|-----|-------------|
| http://localhost:8080/api/auth/ping | Test sanité de l'API |
| http://localhost:8080/h2-console | Console base de données H2 |
| ws://localhost:8080/ws | WebSocket tracking livraison |

---

## 🔑 Comptes de test (créés automatiquement)

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | admin@eeuez.cm | admin2024! |
| Restaurant | jb@phenixdor.cm | password123 |
| Client | sophie@gmail.com | password123 |
| Livreur | paul@eeuez.cm | livreur123 |

---

## 📡 API Endpoints

### Auth (public)
```
POST /api/auth/login
POST /api/auth/register/client
POST /api/auth/register/restaurant
POST /api/auth/register/livreur
POST /api/auth/google
GET  /api/auth/ping
```

### Client (JWT requis)
```
GET  /api/client/profile
GET  /api/client/restaurants/nearby?lat=3.848&lon=11.502&rayon=10
GET  /api/client/restaurants/{id}
POST /api/client/restaurants/{id}/follow
POST /api/client/plats/{id}/like
GET  /api/client/plats/likes
POST /api/client/commandes
GET  /api/client/commandes
GET  /api/client/commandes/{id}/tracking
POST /api/client/commandes/{id}/avis
```

### Restaurant (JWT rôle RESTAURANT)
```
GET  /api/restaurant/workspace
PUT  /api/restaurant/status
GET  /api/restaurant/menu
POST /api/restaurant/menu/plats
PUT  /api/restaurant/menu/plats/{id}
DEL  /api/restaurant/menu/plats/{id}
GET  /api/restaurant/commandes
PUT  /api/restaurant/commandes/{id}/accept
PUT  /api/restaurant/commandes/{id}/refuse
GET  /api/restaurant/statistiques
GET  /api/restaurant/avis
```

### Livreur (JWT rôle LIVREUR)
```
GET  /api/livreur/workspace
PUT  /api/livreur/status
PUT  /api/livreur/position
GET  /api/livreur/missions
POST /api/livreur/missions/{id}/accept
PUT  /api/livreur/missions/{id}/collected
PUT  /api/livreur/missions/{id}/delivered
GET  /api/livreur/gains
```

### Carte (public)
```
GET  /api/map/restaurants?lat=3.848&lon=11.502&rayon=10
GET  /api/map/restaurants/{id}/details
GET  /api/map/restaurants/search?q=phenix
```

---

## 🔌 WebSocket Tracking

Connexion depuis React Native (avec @stomp/stompjs) :

```javascript
const client = new Client({
  brokerURL: 'ws://192.168.x.x:8080/ws/websocket',
});

// Client suit la livraison
client.subscribe('/topic/commande/42/tracking', (msg) => {
  const tracking = JSON.parse(msg.body);
  // { latitude, longitude, statut, tempsRestantEstime }
});

// Livreur envoie sa position
client.publish({
  destination: '/app/tracking/update',
  body: JSON.stringify({
    commandeId: 42,
    livreurId: 5,
    latitude: 3.848,
    longitude: 11.502,
    statut: 'EN_LIVRAISON'
  })
});
```

---

## 📱 Configuration Frontend

Dans `eeuez-expo-ui/constants/api.ts` :

```typescript
// Émulateur Android
export const API_BASE_URL = 'http://10.0.2.2:8080/api';

// Appareil physique (remplacer par votre IP)
export const API_BASE_URL = 'http://192.168.1.X:8080/api';
```

---

## 🏗️ Architecture

```
backend/
├── model/          — Entités JPA (User, Client, Restaurant, Livreur, Commande, Plat...)
├── repository/     — Spring Data JPA repositories
├── service/        — Logique métier (AuthService, CommandeService, GeoService...)
├── controller/     — REST controllers (Auth, Client, Restaurant, Livreur, Map, Tracking)
├── security/       — JWT (JwtUtil, JwtAuthFilter, SecurityConfig)
├── config/         — WebSocket, DataInitializer
└── dto/            — Data Transfer Objects
```
