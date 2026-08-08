// ═══════════════════════════════════════════════════════════
//  Fil de publications (type Instagram)
//  Le backend renvoie déjà des URLs absolues ; absMedia() est appliqué
//  en filet de sécurité au cas où une URL relative passerait.
// ═══════════════════════════════════════════════════════════

import { apiGet, apiPost, apiUpload, apiUploadWithProgress, apiRequest } from './http';
import { ajouterFichier } from './upload';
import { absMedia } from '../data/menuData';
import type {
  FeedPageDTO, PublicationDTO, CommentaireDTO, PublicationLikeToggleDTO,
} from './dto';

/** Normalise les URLs de médias d'une publication. */
function normaliser(p: PublicationDTO): PublicationDTO {
  return {
    ...p,
    restaurant_logo: absMedia(p.restaurant_logo) ?? null,
    medias: (p.medias ?? []).map(m => ({ ...m, url: absMedia(m.url) ?? m.url })),
    plat_details: p.plat_details
      ? { ...p.plat_details, image: absMedia(p.plat_details.image) ?? null }
      : null,
    auteur_details: p.auteur_details
      ? { ...p.auteur_details, avatar: absMedia(p.auteur_details.avatar) ?? null }
      : null,
  };
}

export interface FeedPage {
  resultats: PublicationDTO[];
  curseur: string;
  aSuivant: boolean;
}

/**
 * Récupère une page du fil.
 * IMPORTANT : renvoyer le `curseur` de la page précédente, sinon le classement
 * est recalculé et on obtient doublons et trous pendant le défilement.
 */
export async function fetchFeed(
  page = 1, curseur?: string, taille = 10,
): Promise<FeedPage> {
  const data = await apiGet<FeedPageDTO>('/client/publications/feed', {
    query: { page, taille, curseur },
    auth: true,
  });
  return {
    resultats: (data.resultats ?? []).map(normaliser),
    curseur: data.curseur,
    aSuivant: !!data.a_suivant,
  };
}

export async function fetchPublication(id: number): Promise<PublicationDTO> {
  const data = await apiGet<PublicationDTO>(`/client/publications/${id}`, { auth: true });
  return normaliser(data);
}

export const togglePublicationLike = (id: number) =>
  apiPost<PublicationLikeToggleDTO>(`/client/publications/${id}/like`, {}, { auth: true });

export const fetchCommentaires = (id: number) =>
  apiGet<CommentaireDTO[]>(`/client/publications/${id}/commentaires`, { auth: true });

export const postCommentaire = (id: number, texte: string) =>
  apiPost<CommentaireDTO>(`/client/publications/${id}/commentaires`, { texte }, { auth: true });

export async function fetchPublicationsLikees(): Promise<PublicationDTO[]> {
  const data = await apiGet<PublicationDTO[]>('/client/publications/likees', { auth: true });
  return (data ?? []).map(normaliser);
}

// ─── Contributions du client ─────────────────────────────────

/** Nombre maximum de médias accepté par le serveur. */
export const MAX_MEDIAS = 10;

/**
 * Propose une publication à un restaurant. Elle part en « en attente » :
 * le restaurant doit la valider pour qu'elle apparaisse dans le fil.
 */
export async function contribuer(
  restaurantId: number, texte: string, uris: string[], platId?: number,
  /** Progression d'envoi (0 → 1) — les médias partent en une seule requête,
   *  donc c'est une progression globale, pas un pourcentage par fichier
   *  indépendant ; l'appelant peut néanmoins l'utiliser pour estimer quels
   *  fichiers sont probablement déjà envoyés. */
  onProgress?: (fraction: number) => void,
): Promise<PublicationDTO> {
  const form = new FormData();
  if (texte) form.append('texte', texte);
  if (platId) form.append('plat_id', String(platId));
  uris.slice(0, MAX_MEDIAS).forEach(uri => ajouterFichier(form, 'medias', uri));
  const path = `/client/restaurants/${restaurantId}/publications`;
  const data = onProgress
    ? await apiUploadWithProgress<PublicationDTO>(path, form, onProgress)
    : await apiUpload<PublicationDTO>(path, form);
  return normaliser(data);
}

/** Mes contributions (tous statuts, hors celles que j'ai supprimées). */
export async function fetchMesPublications(): Promise<PublicationDTO[]> {
  const data = await apiGet<PublicationDTO[]>('/client/publications/mes-publications', { auth: true });
  return (data ?? []).map(normaliser);
}

/** Suppression douce par l'auteur. */
export const supprimerPublication = (id: number) =>
  apiRequest<void>(`/client/publications/${id}/supprimer`, { method: 'DELETE', auth: true });

export type { PublicationDTO, CommentaireDTO };
