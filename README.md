# EEUEZ MENU APP MOBILE

Version mobile de EEUEZ-MENU.
Une application de commande de repas avec interfaces pour Clients, Restaurants et Livreurs, incluant des interactions temps réel et un design premium (Dark Glassmorphism).

## 🚀 Comment tester l'application sur votre machine

Voici les étapes pour télécharger, installer et lancer l'application sur votre environnement local.

### 1. Prérequis

Assurez-vous d'avoir installé les éléments suivants sur votre machine :
*   **Node.js** (version 18 ou supérieure recommandée) : [Télécharger Node.js](https://nodejs.org/)
*   **Git** : [Télécharger Git](https://git-scm.com/)
*   **Expo Go** : Installez l'application "Expo Go" sur votre smartphone depuis le Google Play Store (Android) ou l'App Store (iOS). 

### 2. Cloner le projet

Ouvrez un terminal et exécutez la commande suivante pour récupérer le code source :

```bash
git clone https://github.com/sauleric34-hub/EEUEZ_MENU_APP_MOBILE.git
cd EEUEZ_MENU_APP_MOBILE
```

*(Si le projet React Native se trouve dans un sous-dossier comme `eeuez-expo-ui`, naviguez dedans : `cd eeuez-expo-ui`)*

### 3. Installer les dépendances

Dans le dossier du projet Expo, installez les dépendances npm :

```bash
npm install
```

### 4. Lancer le serveur de développement

Démarrez le serveur Expo :

```bash
npx expo start -c
```
*(Le flag `-c` permet de vider le cache pour éviter d'éventuels conflits)*

### 5. Tester sur votre téléphone

1.  Connectez votre téléphone et votre ordinateur au **même réseau Wi-Fi**.
2.  Un QR code va s'afficher dans votre terminal.
3.  **Sur Android** : Ouvrez l'application Expo Go et scannez le QR code.
    **Sur iOS** : Ouvrez l'application Appareil Photo, scannez le QR code et cliquez sur la notification pour ouvrir dans Expo Go.

### 🔄 Les fonctionnalités à tester (Cas d'utilisation)

L'application simule le comportement de 3 rôles différents (Client, Livreur, Restaurant). Vous pouvez tester :
*   **Animations premium** : Boutons avec effet de rebond, confettis lors des validations, émojis flottants, et effets de pulsation.
*   **Restaurant** : Accepter/Refuser des commandes, activer/désactiver la disponibilité des plats.
*   **Client** : Suivi de commande en temps réel, mise en favori des restaurants.
*   **Livreur** : Simulation de tracking de livraison, passage "en ligne/hors ligne".
