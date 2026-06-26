// ═══════════════════════════════════════════════════════
//  EEUEZ MENU — Configuration API
//  Backend : Django 5.2 + Django REST Framework
//
//  Environnements (définis dans les fichiers .env.*) :
//    local   → http://localhost:8000/api   (dev PC)
//    testing → https://eeuez-menu-testing.onrender.com/api  (staging)
//    prod    → https://eeuez-menu.onrender.com/api  (production)
//
//  Pour lancer en local avec le backend Django :
//    cd backend && python manage.py runserver
//    cd eeuez-expo-ui && npx expo start
// ═══════════════════════════════════════════════════════

// ─── DÉTECTION DE L'ENVIRONNEMENT ────────────────────────
const ENV = process.env.EXPO_PUBLIC_ENV ?? 'local';

// ─── URL DU BACKEND DJANGO ────────────────────────────────
// Lit d'abord la variable d'environnement,
// sinon utilise les défauts selon l'environnement.
const API_URLS: Record<string, string> = {
  local:   process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api',
  testing: process.env.EXPO_PUBLIC_API_URL ?? 'https://eeuez-menu-testing.onrender.com/api',
  prod:    process.env.EXPO_PUBLIC_API_URL ?? 'https://eeuez-menu.onrender.com/api',
};

const WS_URLS: Record<string, string> = {
  local:   process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws',
  testing: process.env.EXPO_PUBLIC_WS_URL ?? 'wss://eeuez-menu-testing.onrender.com/ws',
  prod:    process.env.EXPO_PUBLIC_WS_URL ?? 'wss://eeuez-menu.onrender.com/ws',
};

export const API_BASE_URL: string = API_URLS[ENV] ?? API_URLS['local'];
export const API_WS_URL: string   = WS_URLS[ENV]  ?? WS_URLS['local'];

// Timeout des requêtes en ms
export const API_TIMEOUT = 10000;

// Clé de stockage AsyncStorage
export const AUTH_TOKEN_KEY = '@eeuez_auth_token';
export const USER_KEY = '@eeuez_user';

// Expose l'environnement courant (utile pour debug)
export const CURRENT_ENV = ENV;
