// ═══════════════════════════════════════════════════════════
//  Adresses de livraison enregistrées + géocodage (OpenStreetMap)
// ═══════════════════════════════════════════════════════════

import { apiGet, apiPost, apiRequest } from './http';
import type { AdresseDTO } from './dto';

export interface NewAddress {
  label?: string;
  adresse: string;
  details?: string;
  latitude: number;
  longitude: number;
  is_default?: boolean;
}

export const fetchAddresses = () => apiGet<AdresseDTO[]>('/client/adresses', { auth: true });

export const createAddress = (a: NewAddress) =>
  apiPost<AdresseDTO>('/client/adresses', a, { auth: true });

export const setDefaultAddress = (id: number) =>
  apiRequest<AdresseDTO>(`/client/adresses/${id}`, { method: 'PATCH', auth: true });

export const deleteAddress = (id: number) =>
  apiRequest<null>(`/client/adresses/${id}`, { method: 'DELETE', auth: true });

// ─── Géocodage via Nominatim (OpenStreetMap, gratuit, sans clé) ──
export interface PlaceResult {
  label: string;
  latitude: number;
  longitude: number;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Recherche d'un lieu par texte (priorité Cameroun). */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const url = `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=json&limit=8&countrycodes=cm&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'MenuApp/1.0' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return data.map(p => ({ label: p.display_name, latitude: Number(p.lat), longitude: Number(p.lon) }));
  } catch {
    return [];
  }
}

/** Adresse lisible à partir de coordonnées GPS (reverse geocoding). */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `${NOMINATIM}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'MenuApp/1.0' } });
    if (!res.ok) return '';
    const data = (await res.json()) as { display_name?: string };
    return data.display_name || '';
  } catch {
    return '';
  }
}
