# 🍽️ Menu — Application mobile (client)

App **client** de commande & livraison, Expo / React Native.
Design « Menu App v2 » : thème africain (orange / vert / or), mode clair & sombre,
icônes vectorielles ([lucide-react-native](https://lucide.dev)) — **aucun emoji**.

> L'app mobile ne contient que l'expérience **client**. La gestion restaurant/livreur
> et l'administration se font côté back-office (Django).

## 🚀 Lancer

```bash
npm install
npm run start      # puis scanner le QR avec Expo Go
# ou : npm run android  /  npm run ios
```

## 🧭 Écrans

| Route | Écran |
|-------|-------|
| `app/index.tsx` | Splash / Connexion |
| `app/(client)/index.tsx` | Accueil (recherche, catégories, populaires, restaurants) |
| `app/(client)/plats.tsx` | Tous les plats (grille + filtres) |
| `app/(client)/carte.tsx` | Carte des restaurants + fiche |
| `app/(client)/panier.tsx` | Panier & récapitulatif |
| `app/(client)/favoris.tsx` | Favoris |
| `app/(client)/profil.tsx` | Profil, commandes, allergies |
| `app/dish/[id].tsx` | Détail d'un plat |
| `app/resto/[id].tsx` | Profil restaurant |
| `app/tracking.tsx` | Suivi de livraison en direct |

Les onglets (barre du bas, 6 entrées) sont dans `app/(client)/_layout.tsx`.
Le détail plat, le profil resto et le suivi sont hors onglets (plein écran).

## 🏗️ Structure

```
constants/theme.ts     — palette (clair/sombre), kente, polices, rayons, ombres
context/AppContext.tsx — état partagé : thème, panier, favoris, abonnements, suivi
data/menuData.ts       — données mock (restos, plats, catégories) + icônes lucide
components/
  ui.tsx        — primitives (PressableScale, DishTile, AccentButton, IconButton…)
  cards.tsx     — cartes plat (large/grille) & restaurant
  ScreenBg.tsx  — fond dégradé + halos
  Logo.tsx      — logo de marque
  ChatSheet.tsx — bottom sheet de discussion
services/, constants/api.ts — base pour brancher l'API Django (non câblée)
```

## 🎨 Polices (optionnel)

Le design d'origine utilise **Bricolage Grotesque** (titres) et **Manrope** (corps).
Par défaut on retombe sur la police système. Pour activer les vraies polices :

```bash
npx expo install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/manrope expo-font
```

puis charger via `useFonts` et renseigner `Fonts.display` / `Fonts.body` dans
`constants/theme.ts`.

## 🔌 Backend (Django) — connexion réelle

L'app est **entièrement branchée** sur l'API Django : authentification JWT,
catalogue (restaurants / plats / catégories), favoris, abonnements, panier →
commande, liste des commandes, suivi de livraison — tout communique avec la base.

### 1. Lancer le serveur (accessible depuis le téléphone)

```bash
cd ../backend
venv\Scripts\activate
python manage.py runserver 0.0.0.0:8000      # 0.0.0.0 = accessible sur le LAN
```

### 2. Pointer l'app vers votre machine

Dans [`constants/api.ts`](constants/api.ts), régler `API_BASE_URL` :

| Contexte | Valeur |
|----------|--------|
| Émulateur Android | `http://10.0.2.2:8000/api` |
| Téléphone (Expo Go, même Wi-Fi) | `http://VOTRE_IP_LOCALE:8000/api` |
| Simulateur iOS | `http://localhost:8000/api` |

> Trouvez votre IP locale avec `ipconfig` (Windows) → « Adresse IPv4 ».

### 3. Compte de démonstration

Un client de test est déjà présent en base :

```
Email    : client@menu.cm
Mot de passe : client123
```

Le bouton **« Connexion démo »** de l'écran d'accueil s'y connecte directement.
L'inscription (« Créer un compte ») crée un vrai client via `POST /api/auth/register/client`.

### Architecture de la couche réseau

```
services/http.ts   — fetch + JWT Bearer + timeout + gestion d'erreurs
services/auth.ts   — login / register / logout / profil (token dans AsyncStorage)
services/menu.ts   — catalogue, favoris, abonnements, commandes, avis
services/dto.ts    — types des réponses API
data/menuData.ts   — mapping DTO → modèles UI (icône/dégradé dérivés côté client)
context/AppContext — hub : charge le catalogue, synchronise favoris/abonnements,
                     panier local, checkout → commande, suivi depuis le statut réel
```

### Endpoints consommés

`POST /auth/login` · `POST /auth/register/client` · `GET /client/profile` ·
`GET /client/categories` · `GET /client/restaurants[/<id>]` ·
`GET /client/plats[/<id>]` · `GET|POST /client/favoris` ·
`GET|POST /client/abonnements` · `GET|POST /client/commandes/` ·
`POST /client/commandes/<id>/avis`
