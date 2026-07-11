// ═══════════════════════════════════════════════════════════
//  Catalogue & commandes — API Django (app cliente)
// ═══════════════════════════════════════════════════════════

import { apiGet, apiPost, apiUpload } from './http';
import type {
  CategorieDTO, PlatDTO, RestoDTO, CommandeDTO,
  FavoriToggleDTO, AbonnementToggleDTO, RecommandationsDTO,
  ConversationDTO, MessageDTO, NoteResultDTO, MonetbilPaymentDTO,
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

// ─── Notation d'un plat ──────────────────────────────────────
export const ratePlat = (platId: number, note: number) =>
  apiPost<NoteResultDTO>(`/client/plats/${platId}/noter`, { note }, { auth: true });

// ─── Messagerie client ↔ restaurant ─────────────────────────
export const fetchConversations = () =>
  apiGet<ConversationDTO[]>('/client/conversations', { auth: true });

export const openConversation = (platId: number) =>
  apiPost<ConversationDTO>('/client/conversations', { plat: platId }, { auth: true });

export const fetchMessages = (conversationId: number) =>
  apiGet<MessageDTO[]>(`/client/conversations/${conversationId}/messages`, { auth: true });

export const sendMessage = (conversationId: number, texte: string) =>
  apiPost<MessageDTO>(`/client/conversations/${conversationId}/messages`, { texte }, { auth: true });

/** Envoi d'un message avec image (et texte optionnel) en multipart. */
export function sendMessageMedia(conversationId: number, imageUri: string, texte = '') {
  const form = new FormData();
  if (texte) form.append('texte', texte);
  const name = imageUri.split('/').pop() || `photo_${Date.now()}.jpg`;
  const ext = (name.split('.').pop() || 'jpg').toLowerCase();
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';
  // React Native FormData : { uri, name, type }
  form.append('image', { uri: imageUri, name, type } as unknown as Blob);
  return apiUpload<MessageDTO>(`/client/conversations/${conversationId}/messages`, form);
}

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
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
}
export const createOrder = (params: CreateOrderParams) =>
  apiPost<CommandeDTO>('/client/commandes/', params, { auth: true });

export const fetchOrders = () => apiGet<CommandeDTO[]>('/client/commandes/', { auth: true });

// Confirmation de réception par le client (scan QR ou saisie du code).
// Termine la livraison et débloque le paiement du restaurant.
export const confirmReception = (commandeId: number, code: string) =>
  apiPost<CommandeDTO>('/client/commandes/' + commandeId + '/confirmer_reception/', { code }, { auth: true });

export const createAvis = (commandeId: number, note: number, commentaire = '') =>
  apiPost('/client/commandes/' + commandeId + '/avis', { note, commentaire }, { auth: true });

// ─── Paiement Monetbil (Mobile Money) ────────────────────────
/**
 * Demande au backend Django d'initier un paiement Monetbil pour la commande donnée.
 * Le backend appelle Monetbil côté serveur et retourne l'URL de paiement à afficher
 * dans le WebView. Le numéro de téléphone est optionnel (pré-rempli si fourni).
 */
export const initiateMonetbilPayment = (commandeId: number, phone?: string) =>
  apiPost<MonetbilPaymentDTO>(
    `/client/commandes/${commandeId}/initier_paiement/`,
    phone ? { phone } : {},
    { auth: true },
  );
