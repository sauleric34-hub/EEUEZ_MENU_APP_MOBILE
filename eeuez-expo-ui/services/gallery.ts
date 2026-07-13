// ═══════════════════════════════════════════════════════════
//  Galerie d'un restaurant (photos + vidéos)
// ═══════════════════════════════════════════════════════════

import { apiGet } from './http';
import { absMedia } from '../data/menuData';
import type { GalleryDTO, GalleryMediaDTO } from './dto';

export interface GalleryItem {
  type: 'image' | 'video';
  url: string;
  legende: string;
}

/** Récupère la galerie : médias (photos/vidéos) + photos des plats, URLs absolues. */
export async function fetchGallery(restoId: number): Promise<GalleryItem[]> {
  const data = await apiGet<GalleryDTO>(`/client/restaurants/${restoId}/galerie`);
  const items: GalleryItem[] = [];
  for (const m of data.medias ?? []) {
    const url = absMedia(m.url);
    if (url) items.push({ type: m.type, url, legende: m.legende || '' });
  }
  for (const p of data.plats_photos ?? []) {
    const url = absMedia(p.url);
    if (url) items.push({ type: 'image', url, legende: p.legende || '' });
  }
  return items;
}

export type { GalleryMediaDTO };
