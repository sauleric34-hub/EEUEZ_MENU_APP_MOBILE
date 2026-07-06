// ═══════════════════════════════════════════════════════════
//  Catalogue & commandes — API Django (app cliente)
// ═══════════════════════════════════════════════════════════

import { apiGet, apiPost } from './http';
import type {
  CategorieDTO, PlatDTO, RestoDTO, CommandeDTO,
  FavoriToggleDTO, AbonnementToggleDTO, RecommandationsDTO,
} from './dto';

// ─── Catalogue ───────────────────────────────────────────────
export const fetchCategories = () => apiGet<CategorieDTO[]>('/client/categories');

export const fetchRestaurants = (q?: string) =>
  apiGet<RestoDTO[]>('/client/restaurants', { query: { q } });

export const fetchRestaurant = (id: number) =>
  apiGet<RestoDTO>(`/client/restaurants/${id}`);

export interface PlatFilters {
  restaurant?: number;
  categorie?: string;
  popular?: boolean;
  q?: string;
}
export const fetchPlats = (filters: PlatFilters = {}) =>
  apiGet<PlatDTO[]>('/client/plats', { query: filters });

export const fetchPlat = (id: number) => apiGet<PlatDTO>(`/client/plats/${id}`);

// ─── Recommandations personnalisées ─────────────────────────
export const fetchRecommendations = (lat?: number, lon?: number, limit = 20) =>
  apiGet<RecommandationsDTO>('/client/recommandations', { query: { lat, lon, limit } });

// ─── Favoris ─────────────────────────────────────────────────
export const fetchFavoris = () =>
  apiGet<{ plat: number; plat_details: PlatDTO }[]>('/client/favoris', { auth: true });

export const toggleFavori = (platId: number) =>
  apiPost<FavoriToggleDTO>('/client/favoris', { plat: platId }, { auth: true });

// ─── Abonnements ─────────────────────────────────────────────
export const fetchAbonnements = () =>
  apiGet<{ restaurant: number; restaurant_details: RestoDTO }[]>('/client/abonnements', { auth: true });

export const toggleAbonnement = (restaurantId: number) =>
  apiPost<AbonnementToggleDTO>('/client/abonnements', { restaurant: restaurantId }, { auth: true });

// ─── Commandes ───────────────────────────────────────────────
export type PaymentMode = 'especes' | 'mtn_money' | 'orange_money' | 'carte';
export interface CreateOrderItem { plat_id: number; quantite: number; }
export interface CreateOrderParams {
  restaurant: number;
  adresse_livraison: string;
  items: CreateOrderItem[];
  mode_paiement?: PaymentMode;
  notes?: string;
}
export const createOrder = (params: CreateOrderParams) =>
  apiPost<CommandeDTO>('/client/commandes/', params, { auth: true });

export const fetchOrders = () => apiGet<CommandeDTO[]>('/client/commandes/', { auth: true });

export const createAvis = (commandeId: number, note: number, commentaire = '') =>
  apiPost('/client/commandes/' + commandeId + '/avis', { note, commentaire }, { auth: true });
