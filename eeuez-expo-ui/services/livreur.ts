// ═══════════════════════════════════════════════════════════
//  App livreur — pool de missions, courses actives, profil,
//  position GPS. Toutes les routes sont réservées au rôle
//  « livreur » et actif côté serveur (permission EstLivreur).
// ═══════════════════════════════════════════════════════════

import { apiGet, apiPost, apiRequest } from './http';
import type { MissionPoolDTO, CourseDTO, CourseLivraisonDTO, UserDTO } from './dto';

/** Missions libres disponibles (données client anonymisées). */
export const fetchPool = () =>
  apiGet<MissionPoolDTO[]>('/livreur/missions/', { auth: true });

/** Courses en cours du livreur (contact client visible). */
export const fetchMesCourses = () =>
  apiGet<CourseDTO[]>('/livreur/missions/mes_courses/', { auth: true });

export const acceptMission = (commandeId: number) =>
  apiPost<CourseDTO>(`/livreur/missions/${commandeId}/accept/`, {}, { auth: true });

export const departMission = (commandeId: number) =>
  apiPost<CourseDTO>(`/livreur/missions/${commandeId}/depart/`, {}, { auth: true });

/** Récupération au restaurant → renvoie le code que le client devra confirmer. */
export const recupererMission = (commandeId: number) =>
  apiPost<CourseDTO & { code_confirmation: string }>(
    `/livreur/missions/${commandeId}/recuperer/`, {}, { auth: true },
  );

export const livrerSansCode = (commandeId: number, motif: string) =>
  apiPost<CourseDTO>(
    `/livreur/missions/${commandeId}/livrer_sans_code/`, { motif }, { auth: true },
  );

export const abandonnerMission = (commandeId: number, motif: string) =>
  apiPost<{ ok: boolean }>(
    `/livreur/missions/${commandeId}/abandonner/`, { motif }, { auth: true },
  );

export const pushPosition = (commandeId: number, lat: number, lon: number) =>
  apiPost<{ ok: boolean }>(
    `/livreur/missions/${commandeId}/position/`, { lat, lon }, { auth: true },
  );

// ─── Profil livreur ─────────────────────────────────────────
export const fetchLivreurProfile = () =>
  apiGet<UserDTO>('/livreur/profile', { auth: true });

export interface LivreurPaiementUpdate {
  first_name?: string;
  last_name?: string;
  telephone?: string;
  paiement_numero?: string;
  paiement_operateur?: '' | 'mtn_money' | 'orange_money';
}

export const updateLivreurProfile = (data: LivreurPaiementUpdate) =>
  apiRequest<UserDTO>('/livreur/profile', { method: 'PATCH', body: data, auth: true });

export type { MissionPoolDTO, CourseDTO, CourseLivraisonDTO };
