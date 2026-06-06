# 🍽️ EEUEZ Menu — Application Mobile

<div align="center">

![EEUEZ Banner](https://img.shields.io/badge/EEUEZ-Menu%20App-FFB224?style=for-the-badge&logo=expo&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0--beta-blue?style=for-the-badge)
![Expo](https://img.shields.io/badge/Expo%20Go-v54-000020?style=for-the-badge&logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.79-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)

**Application mobile de commande de repas · 3 rôles · Design Dark Glassmorphism**

</div>

---

## 📱 Présentation

**EEUEZ Menu** est une application mobile de commande de repas en ligne développée avec **Expo / React Native**. Elle simule un écosystème complet de livraison de repas avec trois interfaces distinctes :

| 🛍️ Client | 🏪 Restaurant | 🛵 Livreur |
|---|---|---|
| Parcourir les restaurants | Gérer les commandes | Accepter des missions |
| Passer des commandes | Contrôler la disponibilité des plats | Suivre son trajet GPS |
| Suivre la livraison en temps réel | Consulter les statistiques | Gérer ses gains |
| Scanner les QR codes de table | Assigner des livreurs | Activer son mode en ligne |

### ✨ Points Forts

- 🎨 **Design Dark Glassmorphism** — Thème sombre premium avec effets de lueur (glow)
- 🎬 **Animations riches** — Confettis, émojis flottants, rebonds, pulsations, transitions fluides
- 🔄 **Cas d'utilisation croisés (UC-X)** — Simulation des interactions temps réel entre les 3 rôles
- 📱 **Compatible Expo Go v54** — Aucune configuration native requise, animations 100% `Animated` natif

---

## 🛠️ Stack Technique

- **Framework** : [Expo](https://expo.dev/) v54 avec Expo Router v3
- **Langage** : TypeScript
- **Navigation** : Expo Router (groupes de routes `(client)`, `(restaurant)`, `(livreur)`)
- **Animations** : `Animated` natif de React Native (pas de Reanimated)
- **Design System** : `constants/theme.ts` — palette centralisée, glassmorphism, tokens

---

## 🚀 Installation et Test

### Prérequis

Avant de commencer, assurez-vous d'avoir installé sur votre machine :

| Outil | Version Minimale | Lien |
|---|---|---|
| **Node.js** | 18.x ou supérieur | [nodejs.org](https://nodejs.org/) |
| **Git** | Toute version récente | [git-scm.com](https://git-scm.com/) |
| **Expo Go** (sur téléphone) | v54 | [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) / [App Store](https://apps.apple.com/app/expo-go/id982107779) |

> ⚠️ **Important** : Votre téléphone et votre ordinateur doivent être connectés au **même réseau Wi-Fi**.

---

### Étape 1 — Cloner le dépôt

```bash
git clone https://github.com/sauleric34-hub/EEUEZ_MENU_APP_MOBILE.git
```

### Étape 2 — Naviguer dans le projet

```bash
cd EEUEZ_MENU_APP_MOBILE
```

### Étape 3 — Installer les dépendances

```bash
npm install
```

> ⏳ Cette étape peut prendre quelques minutes selon votre connexion.

### Étape 4 — Lancer le serveur de développement

```bash
npx expo start -c
```

> Le flag `-c` vide le cache Metro Bundler pour éviter tout conflit.

### Étape 5 — Scanner le QR Code

Une fois le serveur lancé, un **QR code** apparaît dans le terminal.

- **Android** → Ouvrez **Expo Go**, puis scannez le QR code depuis l'onglet "Scan QR Code".
- **iOS** → Ouvrez l'**application Appareil Photo**, scannez le QR code, puis appuyez sur la notification.

---

## 🗂️ Structure du Projet

```
eeuez-expo-ui/
├── app/
│   ├── index.tsx               # Écran d'accueil (sélection du rôle)
│   ├── _layout.tsx             # Navigation racine
│   ├── (client)/
│   │   ├── _layout.tsx
│   │   └── index.tsx           # Interface Client
│   ├── (restaurant)/
│   │   ├── _layout.tsx
│   │   └── index.tsx           # Interface Restaurant
│   └── (livreur)/
│       ├── _layout.tsx
│       └── index.tsx           # Interface Livreur
├── components/
│   ├── DrawerMenu.tsx          # Menu latéral animé (compatible Android/iOS)
│   └── Animations.tsx          # Bibliothèque d'animations (Confetti, EmojiPop, etc.)
├── constants/
│   └── theme.ts                # Design system centralisé (couleurs, typographie, glassmorphism)
├── data/
│   └── mockData.ts             # Données simulées (restaurants, commandes, utilisateurs)
└── types/
    └── models.ts               # Types TypeScript du domaine métier
```

---

## 🎮 Fonctionnalités à Tester

### Interface Client
- [ ] Parcourir la liste des restaurants
- [ ] Ajouter un restaurant en favori (animation ❤️ + confettis)
- [ ] Appuyer sur "Suivre en direct" (FloatingReaction 🛵 + confettis)
- [ ] Observer la timeline de commande qui progresse automatiquement
- [ ] Ouvrir/fermer le drawer (menu latéral)

### Interface Restaurant
- [ ] Observer les stats qui apparaissent en cascade (stagger animation)
- [ ] Appuyer sur **"Accepter"** une commande → confettis 🎉 + statut qui change automatiquement
- [ ] Appuyer sur **"Refuser"** une commande → la carte disparaît
- [ ] Toggler la disponibilité d'un plat (UC-X2)
- [ ] Appuyer sur les cartes "Top Ventes" (rebond)

### Interface Livreur
- [ ] Toggler le bouton En ligne / Hors ligne → confettis + alerte UC-X9
- [ ] Observer le statut de mission qui change après 5 secondes
- [ ] Appuyer sur "Naviguer" (FloatingReaction 🗺️)
- [ ] Appuyer sur "Scanner QR" (EmojiPop 📷)
- [ ] Naviguer vers "Mes Gains" depuis le drawer

---

## 🔄 Cas d'Utilisation Croisés (UC-X)

Ces scénarios simulent les interactions entre les 3 acteurs :

| ID | Scénario | Acteurs |
|---|---|---|
| **UC-X1** | Scan QR code de table | Client → Restaurant |
| **UC-X2** | Disponibilité plat visible immédiatement | Restaurant → Clients |
| **UC-X3** | Accepter commande → assignation livreur | Restaurant + Système + Livreur |
| **UC-X4** | Suivi GPS temps réel | Livreur → Client |
| **UC-X5** | Notation post-livraison | Client → Restaurant + Livreur |
| **UC-X6** | Annulation de commande | Client ↔ Restaurant |
| **UC-X7** | Promotions ciblées | Restaurant → Clients |
| **UC-X8** | Signalement de problème | Client + Livreur + Restaurant |
| **UC-X9** | Livreur passe hors ligne | Livreur → Restaurant + Système |

---

## 🎨 Bibliothèque d'Animations

Toutes les animations sont dans [`components/Animations.tsx`](./components/Animations.tsx) et utilisent exclusivement l'API `Animated` native :

| Composant | Description |
|---|---|
| `PressableScale` | Rebond scale (0.92) avec spring sur tout bouton |
| `ConfettiBurst` | Explosion de 24 particules colorées |
| `EmojiPop` | Emoji qui jaillit vers le haut et disparaît |
| `FloatingReaction` | Emoji qui monte en flottant (style "Like" réseaux sociaux) |
| `PulseRing` | Anneaux concentriques pulsants (indicateur "live") |
| `ShakeAnimation` | Secousse horizontale (retour d'erreur) |
| `useButtonPress()` | Hook combinant confetti + emoji en un seul appel |

---

## 🤝 Contribution

Ce projet est en phase bêta. Les contributions sont les bienvenues !

1. Forkez le dépôt
2. Créez une branche : `git checkout -b feature/ma-fonctionnalite`
3. Committez : `git commit -m 'feat: ajout de ma fonctionnalité'`
4. Pushez : `git push origin feature/ma-fonctionnalite`
5. Ouvrez une Pull Request

---

## 📄 Licence

Ce projet est sous licence **MIT**. Voir le fichier `LICENSE` pour plus de détails.

---

<div align="center">

Made with ❤️ for **EEUEZ** · Yaoundé, Cameroun 🇨🇲

</div>
