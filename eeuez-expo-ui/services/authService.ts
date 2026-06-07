// ═══════════════════════════════════════════════════════
//  EEUEZ MENU — Service d'authentification
//  Connecte le frontend React Native au backend Spring Boot
// ═══════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY, USER_KEY } from '../constants/api';

// ─── TYPES ────────────────────────────────────────────────────────
export interface AuthUser {
  userId: number;
  nom: string;
  prenom: string;
  email: string;
  role: 'CLIENT' | 'RESTAURANT' | 'LIVREUR' | 'ADMIN';
  avatar?: string;
  statut: string;
}

export interface AuthResponse {
  token: string;
  role: string;
  userId: number;
  email: string;
  nom: string;
  prenom: string;
  avatar?: string;
  statut: string;
}

// ─── REQUÊTE HTTP HELPER ───────────────────────────────────────────
async function apiPost(endpoint: string, body: object): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.erreur || 'Erreur serveur');
  }
  return data;
}

// ─── CONNEXION ────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await apiPost('/auth/login', { email, password });
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
  return data;
}

// ─── INSCRIPTION CLIENT ───────────────────────────────────────────
export async function registerClient(params: {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  password: string;
}): Promise<AuthResponse> {
  const data = await apiPost('/auth/register/client', params);
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
  return data;
}

// ─── INSCRIPTION RESTAURANT ───────────────────────────────────────
export async function registerRestaurant(params: {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  password: string;
  nomEtablissement: string;
  categorie: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  ville?: string;
  quartier?: string;
}): Promise<AuthResponse> {
  const data = await apiPost('/auth/register/restaurant', params);
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
  return data;
}

// ─── INSCRIPTION LIVREUR ──────────────────────────────────────────
export async function registerLivreur(params: {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  password: string;
  vehiculeType: string;
  vehiculeMarque?: string;
  vehiculePlaque: string;
}): Promise<AuthResponse> {
  const data = await apiPost('/auth/register/livreur', params);
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
  return data;
}

// ─── CONNEXION GOOGLE ────────────────────────────────────────────
export async function loginWithGoogle(googleData: {
  googleId: string;
  email: string;
  nom: string;
  prenom?: string;
  avatar?: string;
}): Promise<AuthResponse> {
  const data = await apiPost('/auth/google', googleData);
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
  return data;
}

// ─── DÉCONNEXION ─────────────────────────────────────────────────
export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

// ─── RÉCUPÉRER L'UTILISATEUR COURANT ─────────────────────────────
export async function getCurrentUser(): Promise<AuthResponse | null> {
  const stored = await AsyncStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

// ─── RÉCUPÉRER LE TOKEN ────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

// ─── VÉRIFIER SI CONNECTÉ ────────────────────────────────────────
export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return token !== null;
}
