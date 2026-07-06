// ═══════════════════════════════════════════════════════════
//  Client HTTP — appels vers l'API Django (JWT Bearer)
// ═══════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT, AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../constants/api';

// Rafraîchit l'access token via le refresh token stocké (appel direct, sans
// passer par apiRequest pour éviter toute récursion). Renvoie le nouvel access.
async function tryRefreshToken(): Promise<string | null> {
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

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  let url = `${API_BASE_URL}${path}`;
  if (query) {
    const parts = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    if (parts.length) url += `?${parts.join('&')}`;
  }
  return url;
}

function extractError(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.error === 'string') return d.error;
    if (typeof d.detail === 'string') return d.detail;
    const first = Object.values(d)[0];
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
  return `Erreur serveur (${status})`;
}

async function doFetch(path: string, method: string, body: unknown, query: RequestOptions['query'], token: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT);
  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, query } = options;

  try {
    let token = auth ? await AsyncStorage.getItem(AUTH_TOKEN_KEY) : null;
    let res = await doFetch(path, method, body, query, token);

    // Access token expiré → on tente un refresh unique puis on rejoue la requête.
    if (res.status === 401 && auth) {
      const refreshed = await tryRefreshToken();
      if (refreshed) res = await doFetch(path, method, body, query, refreshed);
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new ApiError(extractError(data, res.status), res.status);
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Délai dépassé — le serveur ne répond pas.', 0);
    }
    throw new ApiError('Connexion au serveur impossible. Vérifiez l\'adresse API.', 0);
  }
}

export const apiGet = <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  apiRequest<T>(path, { ...opts, method: 'GET' });

export const apiPost = <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
  apiRequest<T>(path, { ...opts, method: 'POST', body });
