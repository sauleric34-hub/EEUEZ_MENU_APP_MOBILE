// ═══════════════════════════════════════════════════════════
//  Authentification (JWT + refresh) contre l'API Django
// ═══════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, API_BASE_URL } from '../constants/api';
import { apiPost, apiGet, apiUpload, ApiError } from './http';
import type { AuthDTO, UserDTO } from './dto';
import { oublierCompteGoogle, type JetonFournisseur } from './socialAuth';

async function persist(auth: AuthDTO): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, auth.token);
  if (auth.refresh) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, auth.refresh);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export async function login(email: string, password: string): Promise<UserDTO> {
  const auth = await apiPost<AuthDTO>('/auth/login', { email, password });
  await persist(auth);
  return auth.user;
}

/** Connexion / inscription via Google ou Apple (idToken vérifié côté serveur). */
export async function loginWithProvider({ fournisseur, ...corps }: JetonFournisseur): Promise<UserDTO> {
  try {
    const auth = await apiPost<AuthDTO>(`/auth/${fournisseur}`, corps);
    await persist(auth);
    return auth.user;
  } catch (e) {
    // Un 401 ici n'est pas une « session expirée » : le jeton a été refusé.
    if (e instanceof ApiError && e.status === 401) throw new ApiError(e.message, 401, 'auth', 'Connexion impossible');
    throw e;
  }
}

export interface RegisterParams {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  telephone?: string;
  allergies?: string;
  pays?: string;
  pays_code?: string;
  ville?: string;
}

export async function registerClient(params: RegisterParams): Promise<UserDTO> {
  const auth = await apiPost<AuthDTO>('/auth/register/client', params);
  await persist(auth);
  return auth.user;
}

/** Suppression définitive du compte : mot de passe redemandé côté serveur,
 *  ou nouvelle connexion Google/Apple pour un compte créé sans mot de passe. */
export async function deleteAccount(preuve: { password: string } | JetonFournisseur): Promise<void> {
  await apiPost<void>('/client/compte/supprimer', preuve, { auth: true });
  await logout();
}

// ─── Changement de mot de passe par code e-mail (OTP) ────────
export interface CodeEnvoyeDTO {
  /** Adresse masquée où le code a été envoyé (ex. « aw•••@gmail.com »). */
  email: string;
  expire_dans: number;
  renvoi_dans: number;
}

/** Envoie un code à 6 chiffres à l'adresse du compte. */
export const demanderCodeMotDePasse = () =>
  apiPost<CodeEnvoyeDTO>('/client/compte/mot-de-passe/code', {}, { auth: true });

/** Vérifie le code (sans le consommer) avant de saisir le nouveau mot de passe. */
export const verifierCodeMotDePasse = (code: string) =>
  apiPost<{ valide: boolean }>('/client/compte/mot-de-passe/verifier', { code }, { auth: true });

/** Change le mot de passe ; le serveur renvoie de nouveaux jetons, qu'on garde. */
export async function changerMotDePasse(code: string, nouveau: string): Promise<void> {
  const res = await apiPost<{ token: string; refresh: string }>(
    '/client/compte/mot-de-passe', { code, nouveau }, { auth: true },
  );
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, res.refresh);
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
  await oublierCompteGoogle();
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function getStoredUser(): Promise<UserDTO | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as UserDTO) : null;
}

/** Persiste l'utilisateur courant (cache hors ligne). */
export async function storeUser(user: UserDTO): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Rafraîchit l'access token à partir du refresh token stocké.
 * Retourne le nouvel access token, ou null si le refresh a échoué.
 * (Appel direct via fetch pour éviter toute boucle avec l'intercepteur 401.)
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refresh = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access?: string };
    if (!data.access) return null;
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.access);
    return data.access;
  } catch {
    return null;
  }
}

/** Récupère le profil courant depuis le serveur (valide le token). */
export async function fetchProfile(): Promise<UserDTO> {
  return apiGet<UserDTO>('/client/profile', { auth: true });
}

export interface ProfileUpdate {
  first_name?: string;
  last_name?: string;
  telephone?: string;
  allergies?: string;
  pays?: string;
  pays_code?: string;
  ville?: string;
  avatarUri?: string;  // uri locale d'une image à téléverser
  /** Retire la photo de profil actuelle. */
  supprimerAvatar?: boolean;
}

/** Met à jour le profil (champs texte + photo). Persiste l'utilisateur mis à jour. */
export async function updateProfile(data: ProfileUpdate): Promise<UserDTO> {
  const form = new FormData();
  if (data.first_name != null) form.append('first_name', data.first_name);
  if (data.last_name != null) form.append('last_name', data.last_name);
  if (data.telephone != null) form.append('telephone', data.telephone);
  if (data.allergies != null) form.append('allergies', data.allergies);
  if (data.pays != null) form.append('pays', data.pays);
  if (data.pays_code != null) form.append('pays_code', data.pays_code);
  if (data.ville != null) form.append('ville', data.ville);
  if (data.supprimerAvatar) form.append('avatar_supprimer', '1');
  if (data.avatarUri) {
    const name = data.avatarUri.split('/').pop() || `avatar_${Date.now()}.jpg`;
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const type = ext === 'png' ? 'image/png' : 'image/jpeg';
    form.append('avatar', { uri: data.avatarUri, name, type } as unknown as Blob);
  }
  const user = await apiUpload<UserDTO>('/client/profile', form, 'PATCH');
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}
