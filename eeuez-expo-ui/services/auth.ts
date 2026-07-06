// ═══════════════════════════════════════════════════════════
//  Authentification (JWT + refresh) contre l'API Django
// ═══════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, API_BASE_URL } from '../constants/api';
import { apiPost, apiGet } from './http';
import type { AuthDTO, UserDTO } from './dto';

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

export interface RegisterParams {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  telephone?: string;
}

export async function registerClient(params: RegisterParams): Promise<UserDTO> {
  const auth = await apiPost<AuthDTO>('/auth/register/client', params);
  await persist(auth);
  return auth.user;
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function getStoredUser(): Promise<UserDTO | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as UserDTO) : null;
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
