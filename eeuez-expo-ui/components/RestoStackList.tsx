// ═══════════════════════════════════════════════════════════
//  Liste de restaurants façon « notifications de l'écran de
//  verrouillage iPhone » : les cartes qui arrivent en bas de l'écran
//  s'empilent (la suivante dépasse un peu, réduite, derrière), puis se
//  détachent une à une au défilement ; celles qui sortent par le haut
//  rétrécissent et s'estompent.
//
//  Tout est calculé sur le fil UI (Reanimated) à partir du défilement
//  du ScrollView parent : cartes de hauteur fixe → position connue.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Reanimated, {
  Extrapolation, interpolate, useAnimatedStyle, useSharedValue, type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { Bike, ChevronRight, MapPin, Star } from 'lucide-react-native';
import { Brand, Radius, cardShadow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { formatKm, formatPrice, type Resto } from '../data/menuData';
import { DishTile, PressableScale, bodyFont, displayFont } from './ui';

export const RESTO_CARD_H = 104;
const GAP = 12;
const STEP = RESTO_CARD_H + GAP;
const PEEK = 10;                       // ce qui dépasse de chaque carte empilée
const BOTTOM_REST = PEEK * 2 + 10;     // la pile repose à cette distance du bas
const STACK_DEPTH = 3;                 // cartes visibles dans la pile

export function RestoStackList({ restos, scrollY, viewH, onPress }: {
  restos: Resto[];
  /** Défilement vertical du ScrollView parent. */
  scrollY: SharedValue<number>;
  /** Hauteur visible du ScrollView parent. */
  viewH: SharedValue<number>;
  onPress: (r: Resto) => void;
}) {
  // Position de la liste dans le contenu du ScrollView
  const listY = useSharedValue(0);
  const onLayout = (e: LayoutChangeEvent) => { listY.value = e.nativeEvent.layout.y; };

  return (
    <View onLayout={onLayout} style={{ marginTop: 18, marginBottom: BOTTOM_REST, gap: GAP }}>
      {restos.map((r, i) => (
        <StackItem key={r.id} index={i} total={restos.length} listY={listY} scrollY={scrollY} viewH={viewH}>
          <RestoNotifCard resto={r} onPress={() => onPress(r)} />
        </StackItem>
      ))}
    </View>
  );
}

function StackItem({ index, total, listY, scrollY, viewH, children }: {
  index: number; total: number;
  listY: SharedValue<number>; scrollY: SharedValue<number>; viewH: SharedValue<number>;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const vh = viewH.value;
    if (vh === 0) return {};
    const top = listY.value + index * STEP - scrollY.value; // position à l'écran
    const repos = vh - RESTO_CARD_H - BOTTOM_REST;          // ligne où la pile se pose

    let translateY = 0;
    let scale = 1;
    let opacity = 1;

    // ── En bas : la carte se pose sur la pile au lieu de sortir de l'écran
    const sous = top - repos;
    if (sous > 0) {
      const profondeur = sous / STEP; // 0 = carte de devant, 1 = juste derrière…
      const d = Math.min(profondeur, STACK_DEPTH);
      scale = interpolate(d, [0, STACK_DEPTH], [1, 0.84]);
      // Retenue à la ligne de repos, chaque carte plus profonde dépasse de PEEK
      // (corrigé de la réduction, qui raccourcit la carte autour de son centre)
      translateY = -sous + d * PEEK + ((1 - scale) * RESTO_CARD_H) / 2;
      opacity = interpolate(profondeur, [0, STACK_DEPTH - 1, STACK_DEPTH], [1, 0.75, 0], Extrapolation.CLAMP);
    }

    // ── En haut : la carte qui sort rétrécit et s'estompe
    if (top < 0) {
      const t = Math.min(-top / RESTO_CARD_H, 1);
      scale *= 1 - 0.1 * t;
      opacity *= 1 - t;
      translateY += -top * 0.35; // freine légèrement sa sortie
    }

    return { opacity, transform: [{ translateY }, { scale }] };
  });

  // La carte de devant passe au-dessus de celles qu'elle recouvre
  return <Reanimated.View style={[{ zIndex: total - index }, style]}>{children}</Reanimated.View>;
}

// ─── Carte restaurant « notification » ─────────────────────────
function RestoNotifCard({ resto, onPress }: { resto: Resto; onPress: () => void }) {
  const { colors, mode } = useApp();
  // Fond opaque : les cartes empilées ne doivent pas se voir par transparence
  const fond = mode === 'dark' ? '#141b16' : '#ffffff';
  const gratuit = resto.fraisLivraison === 0;

  return (
    <PressableScale onPress={onPress} scaleTo={0.97}>
      {/* Ombre sur l'enveloppe : la carte elle-même rogne (overflow) sa couverture */}
      <View style={[styles.shadow, cardShadow(colors.shadow)]}>
      <View style={[styles.card, { backgroundColor: fond, borderColor: colors.border }]}>
        {/* Couverture en fond, à droite, fondue dans la carte */}
        {resto.cover && (
          <>
            <ExpoImage source={{ uri: resto.cover }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" />
            <LinearGradient
              colors={[fond, `${fond}d9`, `${fond}55`]} locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={styles.cover}
            />
          </>
        )}

        <View style={styles.logoRing}>
          <DishTile Icon={resto.icon} grad={resto.grad} image={resto.image} size={62} iconSize={26} radius={18} />
          <View style={[styles.openDot, { backgroundColor: resto.isOpen ? Brand.green : '#8a8f8b', borderColor: fond }]} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={[styles.row, { gap: 6 }]}>
            <Text numberOfLines={1} style={[displayFont(15.5, '800'), { color: colors.text, flexShrink: 1 }]}>{resto.name}</Text>
            <Text style={[bodyFont(10.5, '800'), { color: resto.isOpen ? Brand.green : colors.faint }]}>
              {resto.isOpen ? 'Ouvert' : 'Fermé'}
            </Text>
          </View>
          <Text numberOfLines={1} style={[bodyFont(12, '600'), { color: colors.muted, marginTop: 2 }]}>{resto.cuisine}</Text>
          <View style={[styles.row, { gap: 6, marginTop: 8 }]}>
            <View style={[styles.pill, { backgroundColor: 'rgba(247,181,0,0.14)' }]}>
              <Star size={10.5} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
              <Text style={[bodyFont(11, '800'), { color: colors.text }]}>{resto.rating}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: 'rgba(31,138,76,0.14)' }]}>
              <Bike size={11.5} color={Brand.green} strokeWidth={2.4} />
              <Text style={[bodyFont(11, '800'), { color: Brand.green }]}>{gratuit ? 'Gratuit' : formatPrice(resto.fraisLivraison)}</Text>
            </View>
            {resto.distanceKm != null && (
              <View style={[styles.row, { gap: 2 }]}>
                <MapPin size={10.5} color={colors.faint} strokeWidth={2.4} />
                <Text style={[bodyFont(11, '600'), { color: colors.faint }]}>{formatKm(resto.distanceKm)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.chevron, { backgroundColor: colors.surface2 }]}>
          <ChevronRight size={17} color={colors.muted} strokeWidth={2.5} />
        </View>
      </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    height: RESTO_CARD_H, flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: 13, borderRadius: 24, borderWidth: 1, overflow: 'hidden',
  },
  shadow: { borderRadius: 24 },
  cover: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '48%' },
  logoRing: { borderRadius: 20 },
  openDot: {
    position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.pill,
  },
  chevron: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
