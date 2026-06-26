// ═══════════════════════════════════════════════════════════
//  EEUEZ MENU — SYSTÈME DE DESIGN CENTRALISÉ
//  Toutes les constantes visuelles de l'application
// ═══════════════════════════════════════════════════════════

import { StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// ─── PALETTE DE COULEURS (DUAL THEME) ─────────────────────────
export const COLORS = {
  light: {
    primary: '#FF6B00', // Orange vibrant
    primaryBg: '#FFF0E6',
    accent: '#FFD600',  // Jaune éclatant
    success: '#4CAF50', // Vert frais
    successBg: '#E8F5E9',
    warning: '#FFC107',
    warningBg: '#FFF8E1',
    info: '#2196F3',
    infoBg: '#E3F2FD',
    danger: '#F44336',
    dangerBg: '#FFEBEE',
    bg: {
      app: '#FDFDFD',
      surface: '#FFFFFF',
      elevated: '#F9F9F9',
      screen: '#FDFDFD',
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#4A4A4A',
      muted: '#8E8E93',
      inverse: '#FFFFFF',
    },
    border: {
      default: '#E5E5EA',
      subtle: '#F2F2F7',
    },
    client: { primary: '#FF6B00', bg: '#FFF0E6', light: '#FFA366' },
    restaurant: { primary: '#4CAF50', bg: '#E8F5E9', light: '#81C784' },
    livreur: { primary: '#2196F3', bg: '#E3F2FD', light: '#64B5F6', glow: '#64B5F6' },
    glass: { bg: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.2)' },
  },
  dark: {
    primary: '#FF6B00',
    primaryBg: '#331600',
    accent: '#FFD600',
    success: '#4CAF50',
    successBg: '#091A0B',
    warning: '#FFC107',
    warningBg: '#1D1600',
    info: '#2196F3',
    infoBg: '#000F1A',
    danger: '#FF453A',
    dangerBg: '#210808',
    bg: {
      app: '#0A0A0A',
      surface: '#121212',
      elevated: '#1C1C1E',
      screen: '#0A0A0A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#AEAEB2',
      muted: '#636366',
      inverse: '#1A1A1A',
    },
    border: {
      default: '#2C2C2E',
      subtle: '#1C1C1E',
    },
    client: { primary: '#FF6B00', bg: '#FFF0E6', light: '#FFA366' },
    restaurant: { primary: '#4CAF50', bg: '#E8F5E9', light: '#81C784' },
    livreur: { primary: '#2196F3', bg: '#E3F2FD', light: '#64B5F6', glow: '#64B5F6' },
    glass: { bg: 'rgba(0,0,0,0.5)', border: 'rgba(255,255,255,0.1)' },
  },
};

export const DarkColors = COLORS.dark;
export const LightColors = COLORS.light;

// Par défaut, nous utilisons une constante Colors, mais on peut changer ici pour tester
export const Colors = COLORS.light; // SWITCH ICI POUR TESTER LE MODE CLAIR

// ─── TYPOGRAPHIE ─────────────────────────────────────────────
export const Typography = {
  display: { fontSize: 36, fontWeight: '900' as const, letterSpacing: -1 },
  h1: { fontSize: 28, fontWeight: '900' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800' as const },
  h3: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '700' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 1, textTransform: 'uppercase' as const },
};

// ─── ESPACEMENT & GÉOMÉTRIE ──────────────────────────────────
export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const Radius = {
  sm: 8, md: 14, lg: 20, xl: 26, xxl: 32, full: 999,
};

export const Screen = { W, H };

// ─── STYLES RÉUTILISABLES ────────────────────────────────────
export const CommonStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // Status Pill
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  // Icône badge
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

// ─── HELPERS ─────────────────────────────────────────────────
export const glow = (color: string, radius = 12) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.5,
  shadowRadius: radius,
  elevation: 8,
});

export const glowSubtle = (color: string) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 6,
  elevation: 4,
});

export const shadow = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
};

// ─── STATUT COMMANDE ─────────────────────────────────────────
export const getStatutConfig = (colors: any) => ({
  en_attente: { label: 'En attente', color: colors.text.secondary, bg: colors.bg.elevated, icon: 'Clock' },
  acceptee: { label: 'Acceptée', color: colors.primary, bg: colors.bg.elevated, icon: 'CheckCircle' },
  en_preparation: { label: 'Préparation', color: colors.accent, bg: colors.bg.elevated, icon: 'Flame' },
  prete: { label: 'Prête', color: colors.success, bg: colors.successBg, icon: 'Utensils' },
  livreur_assigne: { label: 'Collecte', color: colors.secondary, bg: colors.bg.elevated, icon: 'Bike' },
  en_collecte: { label: 'En collecte', color: colors.secondary, bg: colors.bg.elevated, icon: 'Package' },
  en_livraison: { label: 'En chemin', color: colors.success, bg: colors.successBg, icon: 'Navigation' },
  livree: { label: 'Livrée ✓', color: colors.success, bg: colors.successBg, icon: 'CheckCircle' },
  refusee: { label: 'Refusée', color: colors.danger, bg: colors.dangerBg, icon: 'XCircle' },
  annulee: { label: 'Annulée', color: colors.danger, bg: colors.dangerBg, icon: 'Slash' },
  ouvert: { label: 'Ouvert', color: colors.success, bg: colors.successBg, icon: 'CheckCircle' },
  ferme: { label: 'Fermé', color: colors.danger, bg: colors.dangerBg, icon: 'XCircle' },
});
