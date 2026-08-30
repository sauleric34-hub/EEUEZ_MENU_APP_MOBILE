// ═══════════════════════════════════════════════════════
//  MENU — Configuration API
//  Modifiez API_BASE_URL selon votre environnement
// ═══════════════════════════════════════════════════════

// ─── CHOISIR L'URL SELON VOTRE CONTEXTE ──────────────────
// Émulateur Android : 'http://10.0.2.2:8000/api'
// Appareil physique : 'http://VOTRE_IP_LOCAL:8000/api'
// Expo Go (LAN)     : 'http://192.168.x.x:8000/api'
// Production        : 'https://menu.cambus.cm/api'

export const API_BASE_URL = 'https://menu.cambus.cm/api';

// Timeout des requêtes en ms
export const API_TIMEOUT = 10000;

// Base pour les fichiers média (images) : API_BASE_URL sans le suffixe /api
export const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

// WebSocket (suivi en direct) — dérivé de API_BASE_URL : même hôte, schéma
// ws/wss selon http/https. ⚠️ Le serveur doit router les connexions
// WebSocket vers le processus ASGI (Daphne) — ex. nginx :
// `location /ws/ { proxy_pass http://127.0.0.1:<port_daphne>; proxy_http_version 1.1;
// proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }`
// Tant que ce n'est pas en place côté hébergeur, la connexion échoue
// silencieusement et l'app continue de fonctionner via le polling habituel.
export const API_WS_URL = MEDIA_BASE_URL.replace(/^http/, 'ws') + '/ws';

// Clés de stockage AsyncStorage
export const AUTH_TOKEN_KEY = '@menu_auth_token';
export const REFRESH_TOKEN_KEY = '@menu_refresh_token';
export const USER_KEY = '@menu_user';

// ─── CamerPay ────────────────────────────────────────────
// URL de retour surveillée par le WebView pour détecter la fin du paiement.
// En prod : 'https://menu.cambus.cm/payment/success/'
export const CAMERPAY_SUCCESS_URL = `${MEDIA_BASE_URL}/payment/success/`;

/** Base publique du site — sert à fabriquer les liens de partage.
 *  Un lien https est cliquable partout (WhatsApp, SMS…), contrairement à
 *  « menu:// » que les messageries ne transforment pas en lien. La page web
 *  rebondit ensuite vers l'app. */
export const WEB_BASE_URL = MEDIA_BASE_URL;
