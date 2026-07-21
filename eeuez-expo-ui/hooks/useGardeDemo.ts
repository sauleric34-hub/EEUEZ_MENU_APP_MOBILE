// ═══════════════════════════════════════════════════════════
//  Garde des actions réservées aux comptes réels
// ═══════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { useApp } from '../context/AppContext';
import { MESSAGE_DEMO } from '../constants/demo';

/**
 * Renvoie `bloquer(action)` : exécute l'action pour un compte réel, et propose
 * de se connecter pour le compte de démonstration.
 *
 * Point important : ce garde est une COMMODITÉ D'INTERFACE, pas une sécurité.
 * Le compte démo reste un compte authentifié, et le serveur accepterait ses
 * requêtes. Ce qu'on empêche ici, c'est qu'un visiteur passe une vraie
 * commande sans le vouloir — pas une attaque délibérée.
 */
export function useGardeDemo() {
  const { estDemo, signOut } = useApp();
  const router = useRouter();

  const bloquer = useCallback(
    (action: () => void): void => {
      if (!estDemo) { action(); return; }

      Alert.alert('Compte de démonstration', MESSAGE_DEMO, [
        { text: 'Continuer à explorer', style: 'cancel' },
        {
          text: 'Se connecter',
          onPress: async () => { await signOut(); router.replace('/'); },
        },
      ]);
    },
    [estDemo, signOut, router],
  );

  return { estDemo, bloquer };
}
