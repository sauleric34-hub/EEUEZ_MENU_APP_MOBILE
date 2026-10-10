// ═══════════════════════════════════════════════════════
//  MENU — Connexion Google / Apple
//  Identifiants Google Cloud > Identifiants (pas des secrets).
//  Le schéma iOS (com.googleusercontent.apps.…) se règle, lui,
//  dans app.json (plugin @react-native-google-signin).
// ═══════════════════════════════════════════════════════

/** ID client « Application Web » : audience des idTokens vérifiés par le backend. */
export const GOOGLE_WEB_CLIENT_ID = 'REMPLACER_PAR_WEB_CLIENT_ID.apps.googleusercontent.com';

/** ID client iOS (type « iOS », bundle cm.cambus.menu). */
export const GOOGLE_IOS_CLIENT_ID = 'REMPLACER_PAR_IOS_CLIENT_ID.apps.googleusercontent.com';

/** Faux tant que les identifiants ci-dessus n'ont pas été renseignés. */
export const GOOGLE_CONFIGURE = !GOOGLE_WEB_CLIENT_ID.startsWith('REMPLACER');
