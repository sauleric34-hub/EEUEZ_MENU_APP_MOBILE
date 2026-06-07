// ═══════════════════════════════════════════════════════
//  EEUEZ MENU — Configuration API
//  Modifiez API_BASE_URL selon votre environnement
// ═══════════════════════════════════════════════════════

// ─── CHOISIR L'URL SELON VOTRE CONTEXTE ──────────────────
// Émulateur Android : 'http://10.0.2.2:8888/api'
// Appareil physique : 'http://VOTRE_IP_LOCAL:8888/api'
// Expo Go (LAN)     : 'http://192.168.x.x:8888/api'
// Production        : 'https://api.eeuezmenu.cm/api'

export const API_BASE_URL = 'http://10.0.2.2:8888/api';

// Timeout des requêtes en ms
export const API_TIMEOUT = 10000;

// WebSocket
export const API_WS_URL = 'ws://10.0.2.2:8888/ws';

// Clé de stockage AsyncStorage
export const AUTH_TOKEN_KEY = '@eeuez_auth_token';
export const USER_KEY = '@eeuez_user';
