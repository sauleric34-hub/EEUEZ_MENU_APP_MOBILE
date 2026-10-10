// ═══════════════════════════════════════════════════════════
//  Déconnexion fiable, depuis n'importe quel écran.
//
//  1. vide la session (même si une étape échoue : on ne doit jamais
//     rester « à moitié » connecté) ;
//  2. retire tous les écrans empilés (Paramètres, Profil…) pour que le
//     bouton retour ne ramène pas dans l'app une fois déconnecté ;
//  3. ouvre l'écran de connexion à la place de l'app.
// ═══════════════════════════════════════════════════════════

import { useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';

export function useDeconnexion() {
  const { signOut } = useApp();
  const router = useRouter();
  const enCours = useRef(false);

  return useCallback(async () => {
    if (enCours.current) return; // double tap
    enCours.current = true;
    try {
      await signOut();
    } catch {
      /* jetons effacés côté stockage même si une étape annexe échoue */
    } finally {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
      enCours.current = false;
    }
  }, [signOut, router]);
}
