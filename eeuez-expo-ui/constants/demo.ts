// ═══════════════════════════════════════════════════════════
//  Compte de démonstration
// ═══════════════════════════════════════════════════════════

/** Identifiants du compte de visite libre proposé sur l'écran de connexion. */
export const DEMO = { email: 'client@menu.cm', password: 'client123' };

/**
 * Le mode démo se déduit de l'e-mail du compte connecté, et non d'un drapeau
 * posé au moment de la connexion : ainsi la restriction survit au
 * redémarrage de l'application et vaut quel que soit le chemin emprunté.
 */
export function estCompteDemo(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === DEMO.email;
}

/** Message unique, pour que toutes les actions bloquées parlent d'une voix. */
export const MESSAGE_DEMO =
  "Vous parcourez Menu avec le compte de démonstration. Créez un compte ou connectez-vous pour commander et interagir.";
