// ═══════════════════════════════════════════════════════════
//  EEUEZ MENU — SYSTÈME DE DESIGN CENTRALISÉ
//  Toutes les constantes visuelles de l'application
// ═══════════════════════════════════════════════════════════

import { StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// ─── PALETTE DE COULEURS (DARK MODE — intégration So's design) ─────────────
export const Colors = {
  // Fonds
  bg: {
    app:        '#070B14',   // Bleu nuit quasi noir — fond global
    screen:     '#0C1322',   // Fond des écrans
    surface:    '#141E33',   // Cards
    elevated:   '#1A2845',   // Cards surélévées
  },
  // Glass
  glass: {
    bg:         'rgba(255,255,255,0.05)',
    bgStrong:   'rgba(255,255,255,0.09)',
    border:     'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.15)',
  },
  // Client — Bleu Saphir
  client: {
    primary:    '#4F8EF7',
    light:      '#7BB3FF',
    dark:       '#2A5DC7',
    glow:       'rgba(79, 142, 247, 0.35)',
    bg:         'rgba(79, 142, 247, 0.12)',
  },
  // Restaurant — Vert Émeraude
  restaurant: {
    primary:    '#00D68F',
    light:      '#4DFFC4',
    dark:       '#00A870',
    glow:       'rgba(0, 214, 143, 0.35)',
    bg:         'rgba(0, 214, 143, 0.12)',
  },
  // Livreur — Ambre Or
  livreur: {
    primary:    '#FFB224',
    light:      '#FFD47A',
    dark:       '#E09000',
    glow:       'rgba(255, 178, 36, 0.35)',
    bg:         'rgba(255, 178, 36, 0.12)',
  },
  // Texte
  text: {
    primary:    '#F0F4FF',
    secondary:  '#8899BB',
    muted:      '#475980',
    inverse:    '#070B14',
  },
  // États
  danger:       '#FF4757',
  dangerBg:     'rgba(255, 71, 87, 0.15)',
  success:      '#00D68F',
  successBg:    'rgba(0, 214, 143, 0.12)',
  warning:      '#FFB224',
  warningBg:    'rgba(255, 178, 36, 0.12)',
  // Bordures
  border: {
    default:    'rgba(255,255,255,0.07)',
    subtle:     'rgba(255,255,255,0.04)',
  },
  // Aliases de compatibilité (utilisés par les anciens écrans)
  primary:      '#FF6B00',
  primaryBg:    '#331600',
  accent:       '#FFD600',
  info:         '#2196F3',
  infoBg:       '#000F1A',
};

// ─── TYPOGRAPHIE ─────────────────────────────────────────────
export const Typography = {
  display: { fontSize: 36, fontWeight: '900' as const, letterSpacing: -1, color: Colors.text.primary },
  h1:      { fontSize: 28, fontWeight: '900' as const, letterSpacing: -0.5, color: Colors.text.primary },
  h2:      { fontSize: 22, fontWeight: '800' as const, color: Colors.text.primary },
  h3:      { fontSize: 18, fontWeight: '700' as const, color: Colors.text.primary },
  body:    { fontSize: 15, fontWeight: '400' as const, lineHeight: 22, color: Colors.text.primary },
  bodyBold:{ fontSize: 15, fontWeight: '700' as const, color: Colors.text.primary },
  small:   { fontSize: 13, fontWeight: '400' as const, color: Colors.text.secondary },
  caption: { fontSize: 11, fontWeight: '600' as const, color: Colors.text.muted, letterSpacing: 0.5 },
  label:   { fontSize: 12, fontWeight: '700' as const, letterSpacing: 1, textTransform: 'uppercase' as const, color: Colors.text.muted },
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
  // Surfaces Glass
  glassCard: {
    backgroundColor: Colors.glass.bg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  glassCardStrong: {
    backgroundColor: Colors.glass.bgStrong,
    borderWidth: 1,
    borderColor: Colors.glass.borderStrong,
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
  // Surface standard
  surface: {
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  // Row utilitaires
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // Textes
  textPrimary:   { fontSize: 15, fontWeight: '400' as const, color: Colors.text.primary },
  textSecondary: { fontSize: 15, fontWeight: '400' as const, color: Colors.text.secondary },
  // Boutons
  btnPrimary: {
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: Radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
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
// Version objet (utilisée par les écrans de So : StatutConfig[statut])
export const StatutConfig: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  en_attente:      { label: 'En attente',      color: Colors.warning,             bg: Colors.warningBg,             emoji: '⏳' },
  acceptee:        { label: 'Acceptée',        color: Colors.client.primary,      bg: Colors.client.bg,             emoji: '✅' },
  en_preparation:  { label: 'En préparation',  color: Colors.livreur.primary,     bg: Colors.livreur.bg,            emoji: '👨‍🍳' },
  prete:           { label: 'Prête',           color: Colors.success,             bg: Colors.successBg,             emoji: '🍽️' },
  livreur_assigne: { label: 'Livreur assigné', color: Colors.client.primary,      bg: Colors.client.bg,             emoji: '🛵' },
  en_collecte:     { label: 'En collecte',     color: Colors.livreur.primary,     bg: Colors.livreur.bg,            emoji: '📦' },
  en_livraison:    { label: 'En livraison',    color: Colors.restaurant.primary,  bg: Colors.restaurant.bg,         emoji: '🛵' },
  livree:          { label: 'Livrée ✓',        color: Colors.success,             bg: Colors.successBg,             emoji: '🎉' },
  refusee:         { label: 'Refusée',         color: Colors.danger,              bg: Colors.dangerBg,              emoji: '❌' },
  annulee:         { label: 'Annulée',         color: Colors.danger,              bg: Colors.dangerBg,              emoji: '🚫' },
  ouvert:          { label: 'Ouvert',          color: Colors.success,             bg: Colors.successBg,             emoji: '✅' },
  ferme:           { label: 'Fermé',           color: Colors.danger,              bg: Colors.dangerBg,              emoji: '🔴' },
};

// Version fonction (compatibilité avec l'ancien code : getStatutConfig(colors))
export const getStatutConfig = (colors: any) => ({
  en_attente:      { label: 'En attente',      color: colors.warning ?? Colors.warning,            bg: colors.warningBg ?? Colors.warningBg,   icon: 'Clock',       emoji: '⏳' },
  acceptee:        { label: 'Acceptée',        color: colors.primary ?? Colors.client.primary,     bg: colors.primaryBg ?? Colors.client.bg,   icon: 'CheckCircle', emoji: '✅' },
  en_preparation:  { label: 'Préparation',     color: colors.accent  ?? Colors.livreur.primary,    bg: colors.warningBg ?? Colors.livreur.bg,  icon: 'Flame',       emoji: '👨‍🍳' },
  prete:           { label: 'Prête',           color: colors.success ?? Colors.success,            bg: colors.successBg ?? Colors.successBg,   icon: 'Utensils',    emoji: '🍽️' },
  livreur_assigne: { label: 'Collecte',        color: colors.info    ?? Colors.client.primary,     bg: colors.infoBg    ?? Colors.client.bg,   icon: 'Bike',        emoji: '🛵' },
  en_collecte:     { label: 'En collecte',     color: colors.info    ?? Colors.client.primary,     bg: colors.infoBg    ?? Colors.client.bg,   icon: 'Package',     emoji: '📦' },
  en_livraison:    { label: 'En chemin',       color: colors.success ?? Colors.success,            bg: colors.successBg ?? Colors.successBg,   icon: 'Navigation',  emoji: '🛵' },
  livree:          { label: 'Livrée ✓',        color: colors.success ?? Colors.success,            bg: colors.successBg ?? Colors.successBg,   icon: 'CheckCircle', emoji: '🎉' },
  refusee:         { label: 'Refusée',         color: colors.danger  ?? Colors.danger,             bg: colors.dangerBg  ?? Colors.dangerBg,    icon: 'XCircle',     emoji: '❌' },
  annulee:         { label: 'Annulée',         color: colors.danger  ?? Colors.danger,             bg: colors.dangerBg  ?? Colors.dangerBg,    icon: 'Slash',       emoji: '🚫' },
  ouvert:          { label: 'Ouvert',          color: colors.success ?? Colors.success,            bg: colors.successBg ?? Colors.successBg,   icon: 'CheckCircle', emoji: '✅' },
  ferme:           { label: 'Fermé',           color: colors.danger  ?? Colors.danger,             bg: colors.dangerBg  ?? Colors.dangerBg,    icon: 'XCircle',     emoji: '🔴' },
});

// Compatibilité legacy
export const COLORS = {
  dark: Colors,
  light: {
    ...Colors,
    bg: { app: '#FDFDFD', surface: '#FFFFFF', elevated: '#F9F9F9', screen: '#F5F5F5' },
    text: { primary: '#1A1A1A', secondary: '#4A4A4A', muted: '#8E8E93', inverse: '#FFFFFF' },
    border: { default: '#E5E5EA', subtle: '#F2F2F7' },
    danger: '#F44336',
    dangerBg: '#FFEBEE',
  },
};
export const DarkColors = Colors;
export const LightColors = COLORS.light;
