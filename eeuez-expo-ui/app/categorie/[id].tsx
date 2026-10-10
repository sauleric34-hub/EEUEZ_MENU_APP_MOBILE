// ═══════════════════════════════════════════════════════════
//  Page d'une catégorie — ouverte depuis les boutons de l'accueil.
//  Image de présentation (choisie par l'admin) en grand, titre en
//  pastille, puis les plats de la catégorie en grille « vitrine ».
//
//  Transition : l'écran entre en fondu (Stack), puis l'image se pose
//  en dézoomant, la pastille glisse depuis la gauche et les cartes
//  montent en cascade. Au défilement, l'image part en parallaxe et
//  s'étire si on tire vers le bas.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import Reanimated, {
  Easing, Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle,
  useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { Bike, ChevronLeft, Flame, MapPin, SearchX, Star, UtensilsCrossed } from 'lucide-react-native';
import { Brand, Radius, cardShadow, hexToRgba } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { CascadeReveal, CenterMessage, DishTile, Loader, PressableScale, bodyFont, displayFont } from '../../components/ui';
import { AddButton } from '../../components/cards';
import { distanceKm, formatKm, formatPrice, type Category, type Dish } from '../../data/menuData';

const HERO_H = 300;
const PAGE_PAD = 18;
const GAP = 14;

type SortKey = 'populaires' | 'proches' | 'prix' | 'notes';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'populaires', label: 'Populaires' },
  { key: 'proches', label: 'Les plus proches' },
  { key: 'prix', label: 'Petits prix' },
  { key: 'notes', label: 'Mieux notés' },
];

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, categories, plats, restoById, userLoc, dataLoading } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [sort, setSort] = useState<SortKey>('populaires');

  const cat = categories.find(c => c.id === Number(id));

  /** Distance du plat = distance de son restaurant. */
  const distFor = React.useCallback((restoId: number): number | null => {
    const r = restoById(restoId);
    if (!userLoc || !r || r.latitude == null || r.longitude == null) return r?.distanceKm ?? null;
    return distanceKm(userLoc.lat, userLoc.lon, r.latitude, r.longitude);
  }, [restoById, userLoc]);

  const list = useMemo(() => {
    if (!cat) return [];
    const items = plats.filter(d => d.categoryId === cat.id);
    switch (sort) {
      case 'proches':
        return items.sort((a, b) => (distFor(a.restoId) ?? Infinity) - (distFor(b.restoId) ?? Infinity));
      case 'prix': return items.sort((a, b) => a.price - b.price);
      case 'notes': return items.sort((a, b) => b.noteValue - a.noteValue);
      default: return items.sort((a, b) => b.ordersCount - a.ordersCount);
    }
  }, [cat, plats, sort, distFor]);

  const nbRestos = useMemo(() => new Set(list.map(d => d.restoId)).size, [list]);

  // ─── Animations ────────────────────────────────────────────
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });
  const enter = useSharedValue(0);
  const pill = useSharedValue(0);
  useEffect(() => {
    enter.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    pill.value = withDelay(180, withTiming(1, { duration: 520, easing: Easing.out(Easing.back(1.4)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const stretch = y < 0 ? 1 + -y / HERO_H : 1;          // tirer vers le bas → l'image s'étire
    const entree = interpolate(enter.value, [0, 1], [1.14, 1]); // l'image se pose en dézoomant
    return {
      opacity: enter.value,
      transform: [
        { translateY: y < 0 ? y / 2 : y * 0.45 },
        { scale: stretch * entree },
      ],
    };
  });
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pill.value,
    transform: [{ translateX: interpolate(pill.value, [0, 1], [-60, 0]) }],
  }));
  // Barre compacte (titre) qui apparaît une fois l'image dépassée
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_H - 150, HERO_H - 90], [0, 1], Extrapolation.CLAMP),
  }));

  if (!cat) {
    return (
      <View style={[styles.root, { backgroundColor: colors.page, paddingTop: insets.top }]}>
        <BackButton onPress={() => router.back()} top={insets.top + 8} colors={colors} />
        {dataLoading ? <Loader colors={colors} /> : (
          <CenterMessage Icon={SearchX} colors={colors} title="Catégorie introuvable" subtitle="Elle a peut-être été retirée du menu." />
        )}
      </View>
    );
  }

  const cellW = (width - PAGE_PAD * 2 - GAP) / 2;

  return (
    <View style={[styles.root, { backgroundColor: colors.page }]}>
      <Reanimated.ScrollView
        onScroll={onScroll} scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Image de présentation */}
        <View style={{ height: HERO_H }}>
          <Reanimated.View style={[StyleSheet.absoluteFill, heroStyle]}>
            <Hero cat={cat} />
          </Reanimated.View>
          <LinearGradient
            pointerEvents="none"
            colors={[hexToRgba(colors.page, 0), hexToRgba(colors.page, 0.6), colors.page]}
            locations={[0.55, 0.82, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* Titre en pastille, accroché au bord gauche */}
        <Reanimated.View style={[styles.pillWrap, pillStyle]}>
          <LinearGradient
            colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.pill}
          >
            <Text numberOfLines={1} style={[displayFont(28, '800'), { color: '#fff' }]}>{cat.name}</Text>
          </LinearGradient>
        </Reanimated.View>

        <View style={{ paddingHorizontal: PAGE_PAD }}>
          {!!cat.description && (
            <Text style={[bodyFont(13.5, '500'), { color: colors.muted, marginTop: 14, lineHeight: 20 }]}>{cat.description}</Text>
          )}
          <View style={[styles.row, { gap: 8, marginTop: 12 }]}>
            <Stat label={`${list.length} plat${list.length > 1 ? 's' : ''}`} colors={colors} />
            {nbRestos > 0 && <Stat label={`${nbRestos} restaurant${nbRestos > 1 ? 's' : ''}`} colors={colors} />}
          </View>
        </View>

        {/* Tri */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: PAGE_PAD, marginTop: 20 }}
        >
          {SORTS.filter(s => s.key !== 'proches' || userLoc).map(s => {
            const actif = s.key === sort;
            return (
              <PressableScale key={s.key} onPress={() => setSort(s.key)}>
                <View style={[
                  styles.sortChip,
                  actif
                    ? { backgroundColor: colors.text, borderColor: colors.text }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}>
                  <Text style={[bodyFont(12.5, '700'), { color: actif ? colors.page : colors.muted }]}>{s.label}</Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>

        {/* Plats */}
        {list.length === 0 ? (
          <CenterMessage
            Icon={UtensilsCrossed} colors={colors}
            title="Bientôt au menu" subtitle="Aucun plat dans cette catégorie pour le moment."
          />
        ) : (
          <View style={styles.grid}>
            {list.map((d, i) => (
              <CascadeReveal key={`${sort}-${d.id}`} index={Math.min(i, 8)} style={{ width: cellW }}>
                <VitrineCard dish={d} width={cellW} distance={distFor(d.restoId)} />
              </CascadeReveal>
            ))}
          </View>
        )}
      </Reanimated.ScrollView>

      {/* Barre compacte + retour */}
      <Reanimated.View
        pointerEvents="none"
        style={[styles.bar, { paddingTop: insets.top, height: insets.top + 58, backgroundColor: colors.page, borderBottomColor: colors.border }, barStyle]}
      >
        <Text numberOfLines={1} style={[displayFont(17, '800'), { color: colors.text }]}>{cat.name}</Text>
      </Reanimated.View>
      <BackButton onPress={() => router.back()} top={insets.top + 8} colors={colors} />
    </View>
  );
}

/** Image de présentation, ou à défaut le dégradé de la catégorie avec sa grande icône. */
function Hero({ cat }: { cat: Category }) {
  if (cat.cover) {
    return <ExpoImage source={{ uri: cat.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" />;
  }
  return (
    <LinearGradient colors={cat.grad} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, styles.heroFallback]}>
      {cat.iconImage
        ? <ExpoImage source={{ uri: cat.iconImage }} style={{ width: 120, height: 120, borderRadius: 32 }} contentFit="cover" />
        : <cat.icon size={120} color="rgba(255,255,255,0.9)" strokeWidth={1.4} />}
    </LinearGradient>
  );
}

function BackButton({ onPress, top, colors }: { onPress: () => void; top: number; colors: any }) {
  return (
    <PressableScale onPress={onPress} style={[styles.back, { top }]}>
      <View style={[styles.backInner, { backgroundColor: colors.surface === '#ffffff' ? '#fff' : 'rgba(11,16,13,0.75)' }, cardShadow(colors.shadow)]}>
        <ChevronLeft size={22} color={colors.text} strokeWidth={2.4} />
      </View>
    </PressableScale>
  );
}

function Stat({ label, colors }: { label: string; colors: any }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[bodyFont(11.5, '700'), { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

// ─── Carte « vitrine » : photo nette, logo du restaurant, prix
//     et frais de livraison bien visibles (distincte de la page Plats). ──
function VitrineCard({ dish, width, distance }: { dish: Dish; width: number; distance: number | null }) {
  const { colors, restoById } = useApp();
  const router = useRouter();
  const resto = restoById(dish.restoId);
  const gratuit = dish.fraisLivraison === 0;

  return (
    <PressableScale onPress={() => router.push(`/dish/${dish.id}`)} scaleTo={0.96}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ height: width * 0.92 }}>
          <DishTile Icon={dish.icon} grad={dish.grad} image={dish.image} iconSize={44} radius={0} style={StyleSheet.absoluteFill} />
          {resto && (
            <View style={styles.logo}>
              <DishTile Icon={resto.icon} grad={resto.grad} image={resto.image} size={32} iconSize={15} radius={9} />
            </View>
          )}
          {dish.isPopular && (
            <View style={styles.hot}>
              <Flame size={11} color="#fff" strokeWidth={2.6} />
              <Text style={[bodyFont(10, '800'), { color: '#fff' }]}>Top</Text>
            </View>
          )}
          <View style={styles.add}><AddButton dishId={dish.id} /></View>
        </View>

        <View style={{ padding: 11 }}>
          <Text numberOfLines={1} style={[displayFont(14.5, '700'), { color: colors.text }]}>{dish.name}</Text>
          <View style={[styles.row, { justifyContent: 'space-between', marginTop: 4 }]}>
            <Text style={[displayFont(15.5, '800'), { color: colors.text }]}>{formatPrice(dish.price)}</Text>
            <View style={[styles.row, { gap: 3 }]}>
              <Star size={11} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
              <Text style={[bodyFont(11, '700'), { color: colors.muted }]}>{dish.rating}</Text>
            </View>
          </View>
          <View style={[styles.row, { gap: 6, marginTop: 8 }]}>
            {distance != null && (
              <View style={[styles.row, { gap: 3 }]}>
                <MapPin size={11} color={colors.faint} strokeWidth={2.4} />
                <Text style={[bodyFont(11, '600'), { color: colors.faint }]}>{formatKm(distance)}</Text>
              </View>
            )}
            <View style={styles.fee}>
              <Bike size={12} color={Brand.green} strokeWidth={2.4} />
              <Text style={[bodyFont(11, '800'), { color: Brand.green }]}>
                {gratuit ? 'Gratuit' : formatPrice(dish.fraisLivraison)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  pillWrap: { marginTop: -46, alignSelf: 'flex-start' },
  pill: {
    paddingLeft: PAGE_PAD + 4, paddingRight: 26, paddingVertical: 10,
    borderTopRightRadius: Radius.pill, borderBottomRightRadius: Radius.pill,
    ...{ shadowColor: Brand.accent, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  },
  stat: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1 },
  sortChip: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAGE_PAD, marginTop: 18 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  logo: {
    position: 'absolute', top: 8, left: 8, padding: 2, borderRadius: 11, backgroundColor: '#fff',
  },
  hot: {
    position: 'absolute', top: 10, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: Brand.danger,
  },
  add: { position: 'absolute', right: 8, bottom: 8 },
  fee: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: 'rgba(31,138,76,0.14)',
  },
  back: { position: 'absolute', left: 14 },
  backInner: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: 1,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 70,
  },
});
