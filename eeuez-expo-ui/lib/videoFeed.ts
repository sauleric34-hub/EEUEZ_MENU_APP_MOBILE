// ═══════════════════════════════════════════════════════════
//  État partagé des vidéos du fil
//
//  Le son est GLOBAL (comme Instagram) : le couper sur une publication le
//  coupe partout, et le choix persiste pendant toute la session.
//
//  Magasin externe plutôt que React Context : le son est lu par chaque carte
//  vidéo, mais change rarement. Passer par le contexte applicatif ferait
//  re-rendre toute l'app à chaque bascule.
// ═══════════════════════════════════════════════════════════

import { useSyncExternalStore } from 'react';

// Démarrage en sourdine : une vidéo qui parle toute seule à l'ouverture de
// l'app est la pire des surprises.
let sonCoupe = true;

const abonnes = new Set<() => void>();

function notifier(): void {
  abonnes.forEach(rappel => rappel());
}

function souscrire(rappel: () => void): () => void {
  abonnes.add(rappel);
  return () => { abonnes.delete(rappel); };
}

/** Bascule le son pour TOUTES les publications. */
export function basculerSon(): void {
  sonCoupe = !sonCoupe;
  notifier();
}

/** true si le son est coupé. */
export function useSonCoupe(): boolean {
  return useSyncExternalStore(souscrire, () => sonCoupe, () => sonCoupe);
}
