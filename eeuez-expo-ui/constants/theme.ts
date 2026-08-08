// ═══════════════════════════════════════════════════════════
//  MENU — SYSTÈME DE DESIGN
//  Thème africain (orange / vert / or) — mode clair & sombre
//  Porté depuis le design Claude « Menu App v2 »
// ═══════════════════════════════════════════════════════════

import { Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
export const Screen = { W, H };

export type ThemeMode = 'dark' | 'light';

// ─── COULEURS DE MARQUE (indépendantes du mode) ──────────────
export const Brand = {
  accent:      '#f26a1b', // orange principal
  accentLight: '#f7a03b',
  accentTop:   '#f7891b', // haut du dégradé bouton
  accentBot:   '#f2611b', // bas du dégradé bouton
  green:       '#1f8a4c',
  greenDark:   '#0f5132',
  yellow:      '#f7b500',
  danger:      '#e5484d',
  white:       '#ffffff',
};

// Dégradé du bouton principal (orange)
export const AccentGradient = [Brand.accentTop, Brand.accentBot] as const;
// Couleurs du motif kente (bande décorative)
export const KenteColors = [Brand.yellow, Brand.accent, Brand.greenDark] as const;

// ─── PALETTES PAR MODE ───────────────────────────────────────
export interface Palette {
  page: string;
  screenGrad: [string, string];
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  nav: string;
  navBorder: string;
  shadow: string;
  glowBg: string; // léger halo de fond
}

const DARK: Palette = {
  page:       '#080c09',
  screenGrad: ['#0b100d', '#080c09'],
  surface:    'rgba(255,255,255,0.05)',
  surface2:   'rgba(255,255,255,0.09)',
  border:     'rgba(255,255,255,0.12)',
  text:       '#f4f1ec',
  muted:      'rgba(244,241,236,0.6)',
  faint:      'rgba(244,241,236,0.4)',
  nav:        'rgba(14,19,15,0.92)',
  navBorder:  'rgba(255,255,255,0.08)',
  shadow:     '#000000',
  glowBg:     'rgba(31,138,76,0.16)',
};

const LIGHT: Palette = {
  page:       '#eae6dc',
  screenGrad: ['#ffffff', '#f5f2ea'],
  surface:    '#ffffff',
  surface2:   '#f2eee4',
  border:     'rgba(20,40,25,0.10)',
  text:       '#17231a',
  muted:      'rgba(23,35,26,0.58)',
  faint:      'rgba(23,35,26,0.4)',
  nav:        'rgba(255,255,255,0.94)',
  navBorder:  'rgba(20,40,25,0.08)',
  shadow:     'rgba(30,50,30,0.5)',
  glowBg:     'rgba(242,106,27,0.10)',
};

export const Palettes: Record<ThemeMode, Palette> = { dark: DARK, light: LIGHT };
export const getPalette = (mode: ThemeMode): Palette => Palettes[mode];

// ─── TYPOGRAPHIE ─────────────────────────────────────────────
// Design d'origine : « Bricolage Grotesque » (titres) + « Manrope » (corps).
// Faute de fichiers de police embarqués, on retombe sur la police système
// avec les mêmes graisses. Pour activer les vraies polices :
//   npx expo install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/manrope expo-font
//   puis charger via useFonts et renseigner Fonts.display / Fonts.body.
export const Fonts = {
  display: undefined as string | undefined, // titres (Bricolage Grotesque)
  body:    undefined as string | undefined, // corps (Manrope)
};

// ─── ESPACEMENT & GÉOMÉTRIE ──────────────────────────────────
export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const Radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 };

// ─── OMBRES / HALO ───────────────────────────────────────────
export const glow = (color: string, radius = 18) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.45,
  shadowRadius: radius,
  elevation: 10,
});

/** Convertit une couleur hexadécimale (#rrggbb) en rgba(), pour un fondu d'opacité. */
export const hexToRgba = (hex: string, alpha: number): string => {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const cardShadow = (shadowColor: string) => ({
  shadowColor,
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.35,
  shadowRadius: 22,
  elevation: 8,
});
