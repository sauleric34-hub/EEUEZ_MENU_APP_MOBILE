// ═══════════════════════════════════════════════════════════
//  Skeleton — placeholders qui respirent (pulse d'opacité),
//  à la place d'un spinner plein écran qui masque toute la mise
//  en page pendant un chargement.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue } from 'react-native';
import { Radius } from '../constants/theme';
import type { Palette } from '../constants/theme';

/** Bloc de base : rectangle qui pulse doucement entre deux opacités. */
export function SkeletonBlock({ width = '100%', height, radius = 8, colors, style }: {
  width?: DimensionValue; height: number; radius?: number; colors: Palette; style?: object;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.surface2, opacity },
        style,
      ]}
    />
  );
}

/** Une carte de la grille de plats (mêmes proportions que DishCardGrid). */
function SkeletonDishCard({ colors }: { colors: Palette }) {
  return (
    <View style={[styles.dishCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <SkeletonBlock height={108} radius={0} colors={colors} />
      <View style={{ padding: 12, gap: 8 }}>
        <SkeletonBlock height={14} width="72%" colors={colors} />
        <SkeletonBlock height={11} width="45%" colors={colors} />
        <View style={styles.dishFoot}>
          <SkeletonBlock height={16} width={58} colors={colors} />
          <SkeletonBlock height={32} width={32} radius={16} colors={colors} />
        </View>
      </View>
    </View>
  );
}

/** Grille de plats en chargement — remplace un Loader plein écran sur l'écran Recherche. */
export function SkeletonDishGrid({ colors, count = 6 }: { colors: Palette; count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.cell}><SkeletonDishCard colors={colors} /></View>
      ))}
    </View>
  );
}

/** Une ligne de conversation/restaurant (avatar carré + 2 lignes de texte). */
function SkeletonRow({ colors }: { colors: Palette }) {
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <SkeletonBlock width={60} height={60} radius={16} colors={colors} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBlock height={14} width="60%" colors={colors} />
        <SkeletonBlock height={11} width="40%" colors={colors} />
        <SkeletonBlock height={11} width="80%" colors={colors} />
      </View>
    </View>
  );
}

/** Liste de lignes en chargement — conversations, restaurants… */
export function SkeletonList({ colors, count = 5 }: { colors: Palette; count?: number }) {
  return (
    <View style={{ gap: 12, marginTop: 20 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonRow key={i} colors={colors} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 14 },
  cell: { width: '47%', flexGrow: 1 },
  dishCard: { flex: 1, borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  dishFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: 20, borderWidth: 1 },
});
