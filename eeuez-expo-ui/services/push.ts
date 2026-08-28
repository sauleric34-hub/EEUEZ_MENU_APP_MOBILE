// ═══════════════════════════════════════════════════════════
//  Notifications push (Expo) — enregistrement du jeton
//
//  Best-effort : une permission refusée ou un environnement
//  sans support (émulateur, Expo Go limité) ne doit jamais
//  bloquer la connexion.
// ═══════════════════════════════════════════════════════════

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { apiPost } from './http';

let dejaTente = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPush(): Promise<void> {
  if (dejaTente) return;
  dejaTente = true;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Général',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await apiPost('/push/register', { token: tokenResp.data, platform: Platform.OS }, { auth: true });
  } catch {
    /* pas de push sur cet appareil — on continue sans */
  }
}

/** Réinitialise l'état pour retenter après une reconnexion. */
export function resetPushRegistration(): void {
  dejaTente = false;
}
