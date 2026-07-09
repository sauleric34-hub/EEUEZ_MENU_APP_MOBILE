// ═══════════════════════════════════════════════════════════
//  Primitives du design-system (thème africain)
//  Gradients via expo-linear-gradient, icônes via lucide.
// ═══════════════════════════════════════════════════════════

import React, { useRef } from 'react';
import {
  Animated, Pressable, View, Text, StyleSheet, ViewStyle, TextStyle,
  StyleProp, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type LucideIcon } from 'lucide-react-native';
import {
  Brand, AccentGradient, KenteColors, Radius, Fonts, glow, type Palette,
} from '../constants/theme';

// ─── Titre / graisse « display » (Bricolage) ─────────────────
export const displayFont = (size: number, weight: TextStyle['fontWeight'] = '700'): TextStyle => ({
  fontFamily: Fonts.display,
  fontSize: size,
  fontWeight: weight,
  letterSpacing: -0.4,
});
export const bodyFont = (size: number, weight: TextStyle['fontWeight'] = '600'): TextStyle => ({
  fontFamily: Fonts.body,
  fontSize: size,
  fontWeight: weight,
});

// ─── PressableScale : rebond au toucher ──────────────────────
interface PressableScaleProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleTo?: number;
}
export function PressableScale({ onPress, children, style, disabled, scaleTo = 0.95 }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 12 }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// ─── KenteStripe : bande décorative (or / orange / vert) ─────
export function KenteStripe({ height = 6, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const seg = 7;
  const count = 64;
  return (
    <View style={[{ height, flexDirection: 'row', overflow: 'hidden' }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: seg, height, backgroundColor: KenteColors[i % 3] }} />
      ))}
    </View>
  );
}

// ─── DishTile : tuile dégradée avec icône (visuel plat/resto) ─
interface DishTileProps {
  Icon: LucideIcon;
  grad: readonly [string, string];
  size?: number;
  iconSize?: number;
  radius?: number;
  kente?: boolean;
  image?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}
export function DishTile({ Icon, grad, size, iconSize = 34, radius = Radius.lg, kente, image, style, children }: DishTileProps) {
  return (
    <LinearGradient
      colors={grad as [string, string]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[
        { borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        size != null && { width: size, height: size },
        style,
      ]}
    >
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Icon size={iconSize} color="#ffffff" strokeWidth={2.1} />
      )}
      {kente && <KenteStripe height={6} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
      {children}
    </LinearGradient>
  );
}

// ─── AccentButton : bouton orange dégradé ────────────────────
interface AccentButtonProps {
  label: string;
  onPress?: () => void;
  Icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
}
export function AccentButton({ label, onPress, Icon, style, fontSize = 16 }: AccentButtonProps) {
  return (
    <PressableScale onPress={onPress} style={style}>
      <LinearGradient
        colors={AccentGradient as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.accentBtn, glow(Brand.accent, 22)]}
      >
        {Icon && <Icon size={19} color="#fff" strokeWidth={2.4} />}
        <Text style={[bodyFont(fontSize, '800'), { color: '#fff' }]}>{label}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

// ─── IconButton : carré surface 44px avec icône ──────────────
interface IconButtonProps {
  Icon: LucideIcon;
  onPress?: () => void;
  colors: Palette;
  color?: string;
  size?: number;
  badge?: number;
  dot?: boolean;
}
export function IconButton({ Icon, onPress, colors, color, size = 44, badge, dot }: IconButtonProps) {
  return (
    <PressableScale onPress={onPress}>
      <View style={[
        s.iconBtn,
        { width: size, height: size, backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
        <Icon size={19} color={color ?? colors.text} strokeWidth={2.2} />
        {dot && <View style={[s.badgeDot, { borderColor: colors.page }]} />}
        {badge != null && badge > 0 && (
          <View style={s.badge}><Text style={s.badgeTxt}>{badge}</Text></View>
        )}
      </View>
    </PressableScale>
  );
}

// ─── StatusPill : pastille icône + libellé ───────────────────
interface StatusPillProps {
  Icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  style?: StyleProp<ViewStyle>;
}
export function StatusPill({ Icon, label, color, bg, style }: StatusPillProps) {
  return (
    <View style={[s.pill, { backgroundColor: bg }, style]}>
      <Icon size={13} color={color} strokeWidth={2.5} />
      <Text style={[bodyFont(11.5, '800'), { color }]}>{label}</Text>
    </View>
  );
}

// ─── SectionTitle : titre de section + « Tout voir » ─────────
export function SectionTitle({ title, colors, action, onAction }: {
  title: string; colors: Palette; action?: string; onAction?: () => void;
}) {
  return (
    <View style={s.sectionRow}>
      <Text style={[displayFont(20, '700'), { color: colors.text }]}>{title}</Text>
      {action && (
        <Text onPress={onAction} style={[bodyFont(12.5, '700'), { color: Brand.accentLight }]}>{action}</Text>
      )}
    </View>
  );
}

// ─── Loader plein écran ──────────────────────────────────────
export function Loader({ colors }: { colors: Palette }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={Brand.accent} />
    </View>
  );
}

// ─── Message centré (erreur / vide) ──────────────────────────
export function CenterMessage({ title, subtitle, colors, Icon, action }: {
  title: string; subtitle?: string; colors: Palette; Icon?: LucideIcon; action?: React.ReactNode;
}) {
  return (
    <View style={s.center}>
      {Icon && (
        <View style={[s.centerIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon size={40} color={Brand.accentLight} strokeWidth={1.8} />
        </View>
      )}
      <Text style={[displayFont(18, '700'), { color: colors.text, marginTop: 16 }]}>{title}</Text>
      {subtitle && (
        <Text style={[bodyFont(13, '500'), { color: colors.muted, textAlign: 'center', maxWidth: 240, marginTop: 6, lineHeight: 19 }]}>
          {subtitle}
        </Text>
      )}
      {action}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  centerIcon: { width: 96, height: 96, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  accentBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: Radius.pill,
  },
  iconBtn: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 9, right: 11,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: Brand.accent,
    borderWidth: 2,
  },
  badge: {
    position: 'absolute',
    top: -5, right: -5,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Brand.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginTop: 26, marginBottom: 14,
  },
});
