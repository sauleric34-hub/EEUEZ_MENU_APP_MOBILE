// ═══════════════════════════════════════════════════════
//  MENU — Configuration API
//  Modifiez API_BASE_URL selon votre environnement
// ═══════════════════════════════════════════════════════

// ─── CHOISIR L'URL SELON VOTRE CONTEXTE ──────────────────
// Émulateur Android : 'http://10.0.2.2:8000/api'
// Appareil physique : 'http://VOTRE_IP_LOCAL:8000/api'
// Expo Go (LAN)     : 'http://192.168.x.x:8000/api'
// Production        : 'https://api.menu.cm/api'

export const API_BASE_URL = 'http://192.168.1.148:8000/api';

// Timeout des requêtes en ms
export const API_TIMEOUT = 10000;

// WebSocket
export const API_WS_URL = 'ws://10.167.104.40:8000/ws';

// Base pour les fichiers média (images) : API_BASE_URL sans le suffixe /api
export const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

// Clés de stockage AsyncStorage
export const AUTH_TOKEN_KEY = '@menu_auth_token';
export const REFRESH_TOKEN_KEY = '@menu_refresh_token';
export const USER_KEY = '@menu_user';

