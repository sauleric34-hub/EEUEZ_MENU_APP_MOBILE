# EEUEZ Menu App Mobile

Projet de commande et de livraison pour restaurants (React Native Expo + Java Spring Boot).

## Architecture

* **`eeuez-expo-ui/`** : Application mobile développée avec **React Native** et **Expo Router**. Contient les interfaces pour les clients, restaurateurs et livreurs.
* **`backend/`** : API Backend développée avec **Java Spring Boot**.

## Lancement du Front-end (Application Mobile)

```bash
cd eeuez-expo-ui
npm install
npm run start
```
*(Scannez le QR Code avec Expo Go sur votre téléphone pour tester).*

## Lancement du Back-end (API Spring Boot)

```bash
cd backend
./mvnw spring-boot:run
```
