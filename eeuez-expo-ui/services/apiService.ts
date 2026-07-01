// ═══════════════════════════════════════════════════════
//  MENU — Service API (client HTTP générique)
//  Toutes les requêtes authentifiées passent par ici
// ═══════════════════════════════════════════════════════

import { API_BASE_URL, API_TIMEOUT, AUTH_TOKEN_KEY } from '../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── CLIENT HTTP ──────────────────────────────────────────────────

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(
  method: string,
  endpoint: string,
  body?: object
): Promise<T> {
  const headers = await getAuthHeaders();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.erreur || `Erreur ${res.status}`);
    }

    return res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('La requête a expiré. Vérifiez votre connexion.');
    }
    throw err;
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>('GET', endpoint),
  post: <T>(endpoint: string, body: object) => request<T>('POST', endpoint, body),
  put: <T>(endpoint: string, body: object) => request<T>('PUT', endpoint, body),
  patch: <T>(endpoint: string, body?: object) => request<T>('PATCH', endpoint, body),
  delete: <T>(endpoint: string) => request<T>('DELETE', endpoint),
};

// ─── SERVICES RESTAURANT ──────────────────────────────────────────

export const restaurantService = {
  /** Restaurants proches de ma position */
  getNearby: (lat: number, lon: number, rayon = 10) =>
    api.get(`/client/restaurants/nearby?lat=${lat}&lon=${lon}&rayon=${rayon}`),

  /** Description complète d'un restaurant (photos, galerie, plats, avis) */
  getDescription: (id: number) => api.get(`/client/restaurants/${id}`),

  /** Suivre / ne plus suivre un restaurant */
  toggleFollow: (id: number) => api.post(`/client/restaurants/${id}/follow`, {}),

  /** Rechercher par nom */
  search: (q: string) => api.get(`/map/restaurants/search?q=${encodeURIComponent(q)}`),

  /** Restaurants sur la carte */
  getMapRestaurants: (lat: number, lon: number, rayon = 10) =>
    api.get(`/map/restaurants?lat=${lat}&lon=${lon}&rayon=${rayon}`),

  /** Détails pour l'animation de la carte */
  getMapDetails: (id: number) => api.get(`/map/restaurants/${id}/details`),
};

// ─── SERVICES PLATS ───────────────────────────────────────────────

export const platService = {
  /** Liker / unliker un plat */
  toggleLike: (platId: number) => api.post(`/client/plats/${platId}/like`, {}),

  /** Liste des plats likés */
  getPlatsLikes: () => api.get('/client/plats/likes'),
};

// ─── SERVICES COMMANDES ───────────────────────────────────────────

export const commandeService = {
  /** Passer une commande */
  passer: (body: object) => api.post('/client/commandes/', body),

  /** Historique des commandes */
  getHistorique: () => api.get('/client/commandes/'),

  /** Détail d'une commande */
  getDetail: (id: number) => api.get(`/client/commandes/${id}/`),

  /** Suivi GPS de la livraison */
  getTracking: (id: number) => api.get(`/client/commandes/${id}/tracking/`),

  /** Mettre à jour le statut (Simulation) */
  updateStatus: (id: number, statut: string) => api.patch(`/client/commandes/${id}/`, { statut }),

  /** Laisser un avis */
  laisserAvis: (commandeId: number, body: { notePlat?: number; noteLivraison?: number; commentaire: string }) =>
    api.post(`/client/commandes/${commandeId}/avis/`, body),
};

// ─── SERVICES RESTAURANT (workspace) ─────────────────────────────

export const restaurantWorkspaceService = {
  getWorkspace: () => api.get('/restaurant/workspace'),
  toggleStatus: () => api.put('/restaurant/status', {}),
  getMenu: () => api.get('/restaurant/menu'),
  getPlats: () => api.get('/restaurant/menu/plats'),
  createPlat: (plat: object) => api.post('/restaurant/menu/plats', plat),
  updatePlat: (id: number, data: object) => api.put(`/restaurant/menu/plats/${id}`, data),
  deletePlat: (id: number) => api.delete(`/restaurant/menu/plats/${id}`),
  toggleDisponibilite: (id: number) => api.patch(`/restaurant/menu/plats/${id}/toggle`),
  getCommandes: () => api.get('/restaurant/commandes'),
  accepterCommande: (id: number, delai?: number) =>
    api.put(`/restaurant/commandes/${id}/accept`, { delai }),
  refuserCommande: (id: number, raison: string) =>
    api.put(`/restaurant/commandes/${id}/refuse`, { raison }),
  changerStatut: (id: number, statut: string) =>
    api.put(`/restaurant/commandes/${id}/status`, { statut }),
  getStatistiques: () => api.get('/restaurant/statistiques'),
  getAvis: () => api.get('/restaurant/avis'),
};

// ─── SERVICES LIVREUR ─────────────────────────────────────────────

export const livreurService = {
  getWorkspace: () => api.get('/livreur/workspace'),
  toggleStatus: () => api.put('/livreur/status', {}),
  updatePosition: (lat: number, lon: number) =>
    api.put('/livreur/position', { latitude: lat, longitude: lon }),
  getMissions: () => api.get('/livreur/missions'),
  accepterMission: (id: number) => api.post(`/livreur/missions/${id}/accept`, {}),
  marquerCollecte: (id: number) => api.put(`/livreur/missions/${id}/collected`, {}),
  marquerLivre: (id: number) => api.put(`/livreur/missions/${id}/delivered`, {}),
  getGains: () => api.get('/livreur/gains'),
};
