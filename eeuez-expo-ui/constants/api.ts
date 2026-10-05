// ═══════════════════════════════════════════════════════
//  MENU — Configuration API
//  Modifiez API_BASE_URL selon votre environnement
// ═══════════════════════════════════════════════════════

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── CHOISIR L'URL SELON VOTRE CONTEXTE ──────────────────
// En dev (__DEV__), l'app vise le backend Django LOCAL : l'IP de la machine
// est déduite de l'adresse du serveur Metro (même machine, même réseau), ce
// qui marche en Expo Go sur appareil physique comme sur émulateur.
// Forcer une URL précise : EXPO_PUBLIC_API_URL=http://192.168.x.x:8001/api
// Production : 'https://menu.cambus.cm/api'

const PROD_API_URL = 'https://menu.cambus.cm/api';

// Port du backend local (`python manage.py runserver 0.0.0.0:8001`)
const DEV_API_PORT = 8001;

function devApiUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri; // ex. « 192.168.1.173:8081 »
  let host = hostUri ? hostUri.split(':')[0] : '';
  // Émulateur Android : « localhost » désigne l'émulateur lui-même
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  }
  return `http://${host}:${DEV_API_PORT}/api`;
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? devApiUrl() : PROD_API_URL);

// Timeout des requêtes en ms
export const API_TIMEOUT = 10000;

// Base pour les fichiers média (images) : API_BASE_URL sans le suffixe /api
export const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

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
