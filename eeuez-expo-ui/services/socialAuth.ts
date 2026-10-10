// ═══════════════════════════════════════════════════════════
//  Connexion Google / Apple — obtention de l'idToken natif
//  (le backend le vérifie puis renvoie nos propres jetons JWT)
// ═══════════════════════════════════════════════════════════

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GOOGLE_CONFIGURE, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../constants/oauth';
import { ApiError } from './http';

export type Fournisseur = 'google' | 'apple';

export interface JetonFournisseur {
  fournisseur: Fournisseur;
  id_token: string;
  /** Apple ne donne le nom qu'à la toute première connexion. */
  first_name?: string;
  last_name?: string;
}

// Le module Google est natif : absent d'Expo Go, où son import lève une
// erreur. On le charge donc à la demande pour que le reste de l'app reste
// testable dans Expo Go (le bouton Google y est simplement masqué).
type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let google: GoogleModule | null = null;
try {
  google = require('@react-native-google-signin/google-signin') as GoogleModule;
  if (GOOGLE_CONFIGURE) {
    google.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
  }
} catch {
  google = null;
}

export const googleDisponible = google != null && GOOGLE_CONFIGURE;

/** « Se connecter avec Apple » : iPhone uniquement (iOS 13+). */
export async function appleDisponible(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try { return await AppleAuthentication.isAvailableAsync(); } catch { return false; }
}

const echec = (message: string) => new ApiError(message, 0, 'validation', 'Connexion impossible');

/** Ouvre le sélecteur de compte Google. Renvoie null si l'utilisateur annule. */
async function jetonGoogle(): Promise<JetonFournisseur | null> {
  if (!google || !GOOGLE_CONFIGURE) throw echec('La connexion Google n\'est pas disponible sur cette version de l\'app.');
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = google;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null; // annulé
    if (!res.data.idToken) throw echec('Google n\'a pas renvoyé d\'identité. Réessayez.');
    return { fournisseur: 'google', id_token: res.data.idToken };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw echec('Les services Google Play sont absents ou à mettre à jour sur ce téléphone.');
      }
      // DEVELOPER_ERROR (code 10) = SHA-1 / package / webClientId mal déclarés
      // dans Google Cloud : visible dans les logs, message neutre à l'écran.
      console.warn('[Google Sign-In]', e.code, e.message);
    }
    throw echec('La connexion avec Google a échoué. Réessayez.');
  }
}

/** Feuille native « Se connecter avec Apple ». Renvoie null si annulé. */
async function jetonApple(): Promise<JetonFournisseur | null> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!cred.identityToken) throw echec('Apple n\'a pas renvoyé d\'identité. Réessayez.');
    return {
      fournisseur: 'apple',
      id_token: cred.identityToken,
      first_name: cred.fullName?.givenName ?? undefined,
      last_name: cred.fullName?.familyName ?? undefined,
    };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return null;
    console.warn('[Apple Sign-In]', e);
    throw echec('La connexion avec Apple a échoué. Réessayez.');
  }
}

export function obtenirJeton(fournisseur: Fournisseur): Promise<JetonFournisseur | null> {
  return fournisseur === 'google' ? jetonGoogle() : jetonApple();
}

/** À la déconnexion : la prochaine connexion Google repropose le choix du compte. */
export async function oublierCompteGoogle(): Promise<void> {
  if (!google || !GOOGLE_CONFIGURE) return;
  try { await google.GoogleSignin.signOut(); } catch { /* best-effort */ }
}
