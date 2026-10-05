// ═══════════════════════════════════════════════════════════
//  Pays & villes embarqués (data/geo, généré par scripts/generate-geo.js)
// ═══════════════════════════════════════════════════════════

import { COUNTRIES } from '../data/geo/countries';

export { COUNTRIES };

/** Drapeau emoji à partir du code ISO alpha-2 (« CM » → 🇨🇲). */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/[A-Z]/g, ch => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function countryName(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.name ?? code;
}

// Le fichier des villes (~2 Mo) n'est chargé qu'au premier besoin.
let cityMap: Record<string, string[]> | null = null;
export function citiesOf(code: string): string[] {
  if (!cityMap) cityMap = require('../data/geo/cities.json') as Record<string, string[]>;
  return cityMap[code] ?? [];
}

/** Pays de l'appareil (réglages régionaux), s'il fait partie de la liste. */
export function deviceCountry(): string | null {
  try {
    // require à l'exécution : un build natif sans le module ne doit pas planter
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    for (const loc of getLocales()) {
      const code = loc.regionCode?.toUpperCase();
      if (code && COUNTRIES.some(c => c.code === code)) return code;
    }
  } catch { /* module natif absent */ }
  return null;
}

/** Normalise pour la recherche : minuscules, sans accents. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
