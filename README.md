# EEUEZ Menu App Mobile

Projet d'application mobile de commande et de livraison pour restaurants avec un suivi de livraison immersif en temps réel (React Native Expo + Django Backend).

## 🚀 Fonctionnalités Principales

- **📱 Application Mobile (Expo / React Native)** : Interfaces dédiées pour les clients, les restaurateurs et les livreurs.
- **🛵 Simulation GPS Dynamique ("Style GTA")** :
  - Détection automatique d'écart de trajectoire du livreur.
  - Recalcul naturel et fluide de l'itinéraire OSRM sans téléportation ni saut visuel.
  - Animation asynchrone des livreurs sur carte (`react-native-maps`).
- **🔗 Backend Puissant (Django REST Framework)** : Gestion des utilisateurs, des commandes, des historiques de livraison et requêtes asynchrones OSRM.

## 📸 Aperçu de l'Interface

| Suivi de Livraison | État d'attente (Empty State) |
| :---: | :---: |
| ![Suivi en cours](docs/screenshots/map_suivi.jpg) | ![Aucune commande](docs/screenshots/empty_state.jpg) |
*L'application affiche le tracé GPS adaptatif en temps réel (à gauche) et gère élégamment les états vides avec des micro-animations (à droite).*

---

## 🛠 Architecture du Projet

* **`eeuez-expo-ui/`** : Application mobile développée avec **React Native** et **Expo Router**. Contient les interfaces, les contextes de simulation GPS (`AppContext.tsx`), et les animations.
* **`backend/`** : API Backend développée avec **Django** et **Django REST Framework** pour la persistance des données.

## ⚙️ Instructions de Lancement

### Lancement du Front-end (Application Mobile)

```bash
cd eeuez-expo-ui
npm install
npm run start
```
*(Scannez le QR Code avec Expo Go sur votre téléphone pour tester en condition réelle).*

### Lancement du Back-end (API Django)

```bash
cd backend
pip install -r requirements.txt
python manage.py runserver
```

## 🧠 Simulation de Déviation GPS (Algorithme)

L'application intègre un moteur de simulation de livraison avancé pour tester l'interface :
- Séparation stricte entre le `routePath` (chemin secret du livreur) et le `displayRoute` (ligne bleue du GPS).
- Des déviations sont programmées pour forcer le livreur à changer de rue.
- Un check continu calcule la distance (via formule Haversine) entre la moto et la ligne bleue.
- Si le seuil critique (50 mètres) est dépassé, une requête OSRM recalcule la route de la position *exacte* actuelle vers le client.
