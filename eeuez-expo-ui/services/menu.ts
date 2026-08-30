// ═══════════════════════════════════════════════════════════
//  Catalogue & commandes — API Django (app cliente)
// ═══════════════════════════════════════════════════════════

import { apiGet, apiPost, apiUpload } from './http';
import { ajouterFichier } from './upload';
import type {
  CategorieDTO, PlatDTO, RestoDTO, CommandeDTO,
  FavoriToggleDTO, AbonnementToggleDTO, RecommandationsDTO,
  ConversationDTO, MessageDTO, NoteResultDTO, CamerPayPaymentDTO, BanniereDTO,
  EstimationLivraisonDTO,
} from './dto';

// ─── Catalogue ───────────────────────────────────────────────
export const fetchCategories = () => apiGet<CategorieDTO[]>('/client/categories');

// ─── Bannières (carrousel promo accueil) ─────────────────────
export const fetchBannieres = () => apiGet<BanniereDTO[]>('/client/bannieres');
/** Requête légère : ne renvoie qu'un identifiant de version, pour éviter de
 *  re-télécharger la liste complète (images) à chaque arrivée sur l'accueil. */
export const fetchBannieresVersion = () => apiGet<{ version: string }>('/client/bannieres/version');

export const fetchRestaurants = (q?: string) =>
  apiGet<RestoDTO[]>('/client/restaurants', { query: { q } });

export const fetchRestaurant = (id: number) =>
  apiGet<RestoDTO>(`/client/restaurants/${id}`);

export interface PlatFilters {
  restaurant?: number;
  categorie?: string;
  popular?: boolean;
  q?: string;
  // Signature d'index : `query` attend un Record, sans elle l'appel ne typecheck pas.
  [cle: string]: string | number | boolean | undefined;
}
export const fetchPlats = (filters: PlatFilters = {}) =>
  apiGet<PlatDTO[]>('/client/plats', { query: filters });

export const fetchPlat = (id: number) => apiGet<PlatDTO>(`/client/plats/${id}`);

/** Tendances : plats les plus commandés sur la période, les plus aimés, recommandations. */
export interface TendancesDTO {
  periode_jours: number;
  top_commandes: PlatDTO[];
  top_likes: PlatDTO[];
  recommandations: PlatDTO[];
}
export const fetchTendances = (coords?: { lat: number; lon: number } | null) =>
  apiGet<TendancesDTO>('/client/tendances', {
    query: { jours: 7, lat: coords?.lat, lon: coords?.lon },
  });

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
  ajouterFichier(form, 'image', imageUri);
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
  /** Demande d'utiliser les points. Le MONTANT est calculé par le serveur. */
  utiliser_points?: boolean;
}

/** Aperçu fidélité pour un panier donné (tous plafonds déjà appliqués). */
export interface FideliteApercuDTO {
  solde: number;
  niveau: string;
  actif: boolean;
  seuil_minimum: number;
  points_par_unite: number;
  valeur_unite: number;
  reduction_max_pourcentage: number;
  points_utilisables: number;
  reduction: number;
}

export const fetchFideliteApercu = (montant: number) =>
  apiGet<FideliteApercuDTO>('/client/fidelite', { query: { montant }, auth: true });
export const createOrder = (params: CreateOrderParams) =>
  apiPost<CommandeDTO>('/client/commandes/', params, { auth: true });

/** Frais de livraison réels pour un restaurant + une adresse, calculés par le
 *  serveur (barème par distance). À afficher au panier AVANT le paiement. */
export const estimerFraisLivraison = (params: {
  restaurant: number;
  latitude: number | null;
  longitude: number | null;
}) => apiPost<EstimationLivraisonDTO>('/client/livraison/estimer', params, { auth: true });

export const fetchOrders = () => apiGet<CommandeDTO[]>('/client/commandes/', { auth: true });

/** Une commande précise — sert à vérifier `paiement_confirme` après un
 *  retour de paiement CamerPay, plutôt que d'attendre un délai fixe. */
export const fetchOrder = (id: number) => apiGet<CommandeDTO>(`/client/commandes/${id}/`, { auth: true });

// Confirmation de réception par le client (scan QR ou saisie du code).
// Termine la livraison et débloque le paiement du restaurant.
export const confirmReception = (commandeId: number, code: string) =>
  apiPost<CommandeDTO>('/client/commandes/' + commandeId + '/confirmer_reception/', { code }, { auth: true });

export const createAvis = (commandeId: number, note: number, commentaire = '') =>
  apiPost('/client/commandes/' + commandeId + '/avis', { note, commentaire }, { auth: true });

// ─── Paiement CamerPay (Mobile Money) ────────────────────────
/**
 * Demande au backend Django d'initier un paiement CamerPay pour la commande donnée.
 * Le backend appelle CamerPay côté serveur et retourne l'URL de paiement à afficher
 * dans le WebView. Le numéro de téléphone est optionnel (pré-rempli si fourni).
 */
export const initiateCamerPayPayment = (commandeId: number, phone?: string) =>
  apiPost<CamerPayPaymentDTO>(
    `/client/commandes/${commandeId}/initier_paiement/`,
    phone ? { phone } : {},
    { auth: true },
  );

/**
 * Annule (supprime) une commande dont le paiement mobile money n'a pas abouti.
 * Le backend refuse l'annulation si le paiement est déjà confirmé.
 */
export const cancelOrder = (commandeId: number) =>
  apiPost<void>(`/client/commandes/${commandeId}/annuler/`, {}, { auth: true });
