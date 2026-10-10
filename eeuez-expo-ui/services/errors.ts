// ═══════════════════════════════════════════════════════════
//  Erreurs lisibles — traduit les échecs techniques (réseau,
//  délai, code HTTP, message serveur en anglais…) en messages
//  compréhensibles par l'utilisateur, avec un titre et une catégorie
//  qui permettent à l'interface d'adapter l'icône et la couleur.
// ═══════════════════════════════════════════════════════════

import { Alert } from 'react-native';

export type ErrorKind =
  | 'offline'     // pas d'accès internet sur l'appareil
  | 'unreachable' // internet OK, mais notre serveur ne répond pas
  | 'timeout'     // connexion trop lente
  | 'server'      // panne / maintenance côté serveur (5xx)
  | 'auth'        // identifiants refusés ou session expirée
  | 'forbidden'   // action non autorisée pour ce compte
  | 'notFound'    // élément introuvable
  | 'rateLimit'   // trop de tentatives
  | 'validation'  // saisie refusée (message métier du serveur ou local)
  | 'unknown';

export interface ErrorInfo {
  kind: ErrorKind;
  title: string;
  message: string;
}

/** Titre et message par défaut de chaque catégorie. */
export const ERROR_TEXTS: Record<ErrorKind, { title: string; message: string }> = {
  offline: {
    title: 'Pas de connexion internet',
    message: 'Vérifiez votre Wi-Fi ou vos données mobiles, puis réessayez.',
  },
  unreachable: {
    title: 'Serveur injoignable',
    message: 'Nos serveurs ne répondent pas pour le moment. Réessayez dans quelques instants.',
  },
  timeout: {
    title: 'Connexion trop lente',
    message: 'Le réseau met trop de temps à répondre. Rapprochez-vous d\'une meilleure couverture et réessayez.',
  },
  server: {
    title: 'Service momentanément indisponible',
    message: 'Un souci technique est survenu de notre côté. Nos équipes sont prévenues, réessayez un peu plus tard.',
  },
  auth: {
    title: 'Session expirée',
    message: 'Veuillez vous reconnecter pour continuer.',
  },
  forbidden: {
    title: 'Accès refusé',
    message: 'Votre compte ne permet pas d\'effectuer cette action.',
  },
  notFound: {
    title: 'Introuvable',
    message: 'Cet élément n\'existe plus ou a été retiré.',
  },
  rateLimit: {
    title: 'Trop de tentatives',
    message: 'Patientez une minute avant de réessayer.',
  },
  validation: {
    title: 'Vérifiez vos informations',
    message: 'Certaines informations saisies ne sont pas valides.',
  },
  unknown: {
    title: 'Oups, un imprévu',
    message: 'Quelque chose s\'est mal passé. Réessayez dans un instant.',
  },
};

/** Messages renvoyés en anglais (ou trop techniques) par l'API → français clair. */
const SERVER_MESSAGES: Record<string, string> = {
  'invalid credentials': 'Email ou mot de passe incorrect.',
  'user already exists': 'Un compte existe déjà avec cette adresse email. Connectez-vous plutôt.',
  'invalid role': 'Ce type de compte ne peut pas être créé depuis l\'application.',
  'unauthorized': 'Veuillez vous reconnecter pour continuer.',
  'token manquant': 'Veuillez vous reconnecter pour continuer.',
  'given token not valid for any token type': 'Votre session a expiré. Veuillez vous reconnecter.',
  'authentication credentials were not provided.': 'Veuillez vous connecter pour continuer.',
  'informations d\'authentification non fournies.': 'Veuillez vous connecter pour continuer.',
  'not found.': 'Cet élément est introuvable.',
  'pas trouvé.': 'Cet élément est introuvable.',
};

/** Indices d'un message technique qu'on ne doit jamais montrer tel quel. */
const TECHNICAL_HINTS = /(traceback|exception|errno|stack|sql|null|undefined|nan|json|<html|http\s?\d{3}|\bstatus\b|internal server|bad gateway|gateway|throttled|bridée)/i;

/** Traduit un message serveur ; renvoie null s'il n'est pas présentable. */
export function translateServerMessage(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const msg = raw.trim();
  const known = SERVER_MESSAGES[msg.toLowerCase()];
  if (known) return known;
  if (!msg || msg.length > 220 || TECHNICAL_HINTS.test(msg)) return null;
  return msg;
}

/** Catégorie déduite d'un code HTTP (0 = pas de réponse). */
export function kindFromStatus(status: number): ErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rateLimit';
  if (status >= 500) return 'server';
  if (status >= 400) return 'validation';
  return 'unknown';
}

/** Erreur portant déjà une catégorie (ApiError notamment). */
interface KindedError { kind?: ErrorKind; title?: string; message?: string }

/**
 * Décrit n'importe quelle erreur sous une forme présentable.
 * `fallback` remplace le message générique quand l'erreur n'en a pas
 * de plus précis (ex. « Impossible d'envoyer le commentaire. »).
 */
export function describeError(e: unknown, fallback?: string): ErrorInfo {
  const err = (e && typeof e === 'object' ? e : {}) as KindedError;
  const kind: ErrorKind = err.kind ?? (/network request failed|failed to fetch/i.test(err.message ?? '') ? 'unreachable' : 'unknown');
  const base = ERROR_TEXTS[kind];

  // Les problèmes de réseau/serveur ont un message générique explicite ;
  // pour le reste on garde le message métier s'il est lisible.
  const networkish = kind === 'offline' || kind === 'unreachable' || kind === 'timeout' || kind === 'server' || kind === 'rateLimit';
  const message = networkish
    ? base.message
    : (err.kind ? err.message : translateServerMessage(err.message)) || fallback || base.message;

  return { kind, title: err.title ?? base.title, message };
}

/** Raccourci pour les toasts / alertes : une seule phrase lisible. */
export function friendlyMessage(e: unknown, fallback?: string): string {
  const info = describeError(e, fallback);
  const networkish = ['offline', 'unreachable', 'timeout', 'server', 'rateLimit'].includes(info.kind);
  return networkish ? `${info.title}. ${info.message}` : info.message;
}

/** Boîte de dialogue native avec un titre adapté à la cause de l'erreur. */
export function alertError(e: unknown, fallback?: string): void {
  const info = describeError(e, fallback);
  Alert.alert(info.title, info.message);
}
