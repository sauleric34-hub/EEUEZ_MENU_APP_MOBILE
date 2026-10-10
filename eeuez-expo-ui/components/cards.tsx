// ═══════════════════════════════════════════════════════════
//  Cartes réutilisables : plat (large & grille) et restaurant
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Reanimated, {
  Easing, Extrapolation, cancelAnimation, interpolate, useAnimatedScrollHandler, useAnimatedStyle,
  useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Heart, Flame, Star, Plus, Minus, ChevronRight, MapPin } from 'lucide-react-native';
import { Brand, Radius, KenteColors, cardShadow } from '../constants/theme';
import { useApp, cleLigne } from '../context/AppContext';
import { useFlyToCart } from '../context/FlyToCartContext';
import { formatPrice, formatKm, type Category, type Dish, type Resto } from '../data/menuData';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale, DishTile, FadeSlideIn, KenteStripe, displayFont, bodyFont } from './ui';
import { animateListChange } from '../lib/layoutAnimation';

// Dégradé de lisibilité posé sur la photo : transparent en haut, sombre en bas
const SCRIM = ['rgba(8,12,9,0)', 'rgba(8,12,9,0.55)', 'rgba(8,12,9,0.94)'] as const;
const SCRIM_STOPS = [0.3, 0.62, 1] as const;

// ─── Cœur like : rebond + éclat de particules aux couleurs kente ─
const PARTICLES = 8;
const BURST_RADIUS = 22;

function LikeHeart({ id }: { id: number }) {
  const { likes, toggleLike } = useApp();
  const liked = !!likes[id];
  const scale = useSharedValue(1);
  const burst = useSharedValue(0);

  const onPress = () => {
    const willLike = !liked;
    animateListChange();
    toggleLike(id);
    scale.value = withSequence(
      withTiming(willLike ? 0.6 : 0.8, { duration: 90 }),
      withSpring(1, { damping: 5, stiffness: 320 }),
    );
    if (willLike) {
      burst.value = 0;
      burst.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });
    }
  };

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <PressableScale onPress={onPress} scaleTo={1}>
      <View style={s.heart}>
        {Array.from({ length: PARTICLES }).map((_, i) => <Particle key={i} index={i} burst={burst} />)}
        <Reanimated.View style={heartStyle}>
          <Heart size={16} strokeWidth={2.4}
            color={liked ? Brand.accent : '#fff'}
            fill={liked ? Brand.accent : 'transparent'} />
        </Reanimated.View>
      </View>
    </PressableScale>
  );
}

function Particle({ index, burst }: { index: number; burst: SharedValue<number> }) {
  const angle = (index / PARTICLES) * Math.PI * 2;
  const color = KenteColors[index % KenteColors.length];
  const style = useAnimatedStyle(() => {
    const t = burst.value;
    const dist = BURST_RADIUS * t;
    return {
      opacity: t === 0 ? 0 : interpolate(t, [0, 0.15, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { scale: interpolate(t, [0, 0.3, 1], [0.4, 1.1, 0.3]) },
      ],
    };
  });
  return <Reanimated.View pointerEvents="none" style={[s.particle, { backgroundColor: color }, style]} />;
}

// ─── Reflet brillant qui balaie la carte de temps en temps ─────
function Shine({ width, delay }: { width: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      withDelay(4200, withTiming(0, { duration: 0 })),
    ), -1));
    return () => cancelAnimation(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-90, width + 30]) },
      { rotate: '18deg' },
    ],
  }));
  return (
    <Reanimated.View pointerEvents="none" style={[s.shine, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Reanimated.View>
  );
}

// ─── Carte plat « large » immersive (carrousel Populaires) ────
const WIDE_W = 210;
const WIDE_H = 252;
const CAROUSEL_GAP = 14;
const STEP = WIDE_W + CAROUSEL_GAP;
const PARALLAX = 26; // débord de la photo de chaque côté, pour la parallaxe

export function DishCardWide({ dish, scrollX, index = 0, shine = false }: {
  dish: Dish;
  /** Défilement du carrousel parent → la photo glisse en parallaxe. */
  scrollX?: SharedValue<number>;
  index?: number;
  shine?: boolean;
}) {
  const { colors } = useApp();
  const router = useRouter();

  const photoStyle = useAnimatedStyle(() => {
    if (!scrollX) return {};
    const d = index * STEP - scrollX.value;
    return {
      transform: [{ translateX: interpolate(d, [-STEP, STEP], [PARALLAX, -PARALLAX], Extrapolation.CLAMP) }],
    };
  });

  return (
    <PressableScale onPress={() => router.push(`/dish/${dish.id}`)} style={{ width: WIDE_W }} scaleTo={0.96}>
      <View style={[s.card, { height: WIDE_H, backgroundColor: colors.surface2 }, cardShadow(colors.shadow)]}>
        <Reanimated.View style={[s.photo, { left: -PARALLAX, right: -PARALLAX }, photoStyle]}>
          <DishTile Icon={dish.icon} grad={dish.grad} image={dish.image} iconSize={58} radius={0} style={{ flex: 1, paddingBottom: 80 }} />
        </Reanimated.View>
        <LinearGradient colors={SCRIM} locations={SCRIM_STOPS} style={StyleSheet.absoluteFill} pointerEvents="none" />
        {shine && <Shine width={WIDE_W} delay={1200 + index * 650} />}
        <KenteStripe height={4} style={s.kente} />

        <View style={s.topRow}>
          <View style={s.chip}>
            <Flame size={12} color={Brand.yellow} strokeWidth={2.5} />
            <Text style={[bodyFont(11, '800'), { color: Brand.yellow }]}>{dish.orders}</Text>
          </View>
          <LikeHeart id={dish.id} />
        </View>

        <View style={s.bottom}>
          {dish.distanceKm != null && (
            <View style={[s.chip, s.distChip]}>
              <MapPin size={11} color="#8fd6a8" strokeWidth={2.5} />
              <Text style={[bodyFont(10.5, '700'), { color: '#8fd6a8' }]}>
                {formatKm(dish.distanceKm)}{dish.etaMin != null ? ` · ${dish.etaMin} min` : ''}
              </Text>
            </View>
          )}
          <Text numberOfLines={1} style={[displayFont(16.5, '800'), s.name]}>{dish.name}</Text>
          <View style={[s.row, { gap: 4, marginTop: 3 }]}>
            <Star size={11.5} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
            <Text style={[bodyFont(11.5, '700'), s.meta]}>{dish.rating}</Text>
            <Text numberOfLines={1} style={[bodyFont(11.5, '600'), s.meta, { flex: 1 }]}> · {dish.restoName}</Text>
          </View>
          <View style={s.foot}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[displayFont(16, '800'), s.price]}>{formatPrice(dish.price)}</Text>
            <AddButton dishId={dish.id} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

// ─── Carrousel en profondeur : la carte de tête est mise en avant,
//     les suivantes sont légèrement réduites et estompées. ──────────
export function DishCarousel({ dishes }: { dishes: Dish[] }) {
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => { scrollX.value = e.contentOffset.x; });
  return (
    <Reanimated.ScrollView
      horizontal showsHorizontalScrollIndicator={false}
      onScroll={onScroll} scrollEventThrottle={16}
      snapToInterval={STEP} decelerationRate="fast"
      contentContainerStyle={{ gap: CAROUSEL_GAP, paddingVertical: 8, paddingHorizontal: 2, paddingRight: 40 }}
    >
      {dishes.map((d, i) => (
        <DepthItem key={d.id} index={i} scrollX={scrollX}>
          <FadeSlideIn index={i}><DishCardWide dish={d} scrollX={scrollX} index={i} shine /></FadeSlideIn>
        </DepthItem>
      ))}
    </Reanimated.ScrollView>
  );
}

function DepthItem({ index, scrollX, children }: {
  index: number; scrollX: SharedValue<number>; children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const d = index * STEP - scrollX.value;
    return {
      opacity: interpolate(d, [-STEP, 0, STEP], [0.5, 1, 0.75], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [-STEP, 0, STEP], [0.86, 1, 0.92], Extrapolation.CLAMP) }],
    };
  });
  return <Reanimated.View style={style}>{children}</Reanimated.View>;
}

// ─── Carte plat « grille » immersive (Plats, Favoris, Resto) ──
export const GRID_CARD_H = 232;

export function DishCardGrid({ dish }: { dish: Dish }) {
  const { colors } = useApp();
  const router = useRouter();
  return (
    <PressableScale onPress={() => router.push(`/dish/${dish.id}`)} style={{ flex: 1 }} scaleTo={0.96}>
      <View style={[s.card, { height: GRID_CARD_H, backgroundColor: colors.surface2 }, cardShadow(colors.shadow)]}>
        <DishTile Icon={dish.icon} grad={dish.grad} image={dish.image} iconSize={48} radius={0} style={[StyleSheet.absoluteFill, { paddingBottom: 80 }]} />
        <LinearGradient colors={SCRIM} locations={SCRIM_STOPS} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <KenteStripe height={4} style={s.kente} />

        <View style={s.topRow}>
          <View style={s.chip}>
            <Star size={11} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
            <Text style={[bodyFont(11, '800'), { color: '#fff' }]}>{dish.rating}</Text>
          </View>
          <LikeHeart id={dish.id} />
        </View>

        <View style={[s.bottom, { padding: 11 }]}>
          <Text numberOfLines={2} style={[displayFont(15, '800'), s.name, { lineHeight: 18 }]}>{dish.name}</Text>
          <Text numberOfLines={1} style={[bodyFont(11, '600'), s.meta, { marginTop: 3 }]}>{dish.restoName}</Text>
          <View style={s.foot}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[displayFont(14.5, '800'), s.price]}>{formatPrice(dish.price)}</Text>
            <AddButton dishId={dish.id} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

// ─── Bouton « + » ajouter au panier (pop + coche éphémère) ───
export function AddButton({ dishId }: { dishId: number }) {
  const { addToCart, dishById, restoById, cart, cartInc, cartDec } = useApp();
  const router = useRouter();
  const pop = useRef(new Animated.Value(1)).current;
  const anchor = useRef<View>(null);
  const flyToCart = useFlyToCart();

  const dish = dishById(dishId);
  const exigeUnChoix = (dish?.groupesComplements ?? []).some(
    g => g.obligatoire && g.options.length > 0,
  );

  const cle = cleLigne(dishId, []);
  const inCartQty = cart[cle]?.qty || 0;

  const widthAnim = useRef(new Animated.Value(inCartQty > 0 && !exigeUnChoix ? 84 : 32)).current;

  React.useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: inCartQty > 0 && !exigeUnChoix ? 84 : 32,
      useNativeDriver: false,
      speed: 40,
      bounciness: 10,
    }).start();
  }, [inCartQty, exigeUnChoix]);

  // Ni livraison ni retrait sur place actifs pour ce restaurant → rien à
  // proposer depuis le panier (seule la réservation de table, si active,
  // reste accessible depuis la fiche restaurant).
  const dishResto = restoById(dish?.restoId ?? -1);
  if (dishResto && !dishResto.livraisonActive && !dishResto.platsAEmporterActifs) {
    return null;
  }

  const onAdd = () => {
    if (exigeUnChoix) {
      router.push(`/dish/${dishId}`);
      return;
    }
    addToCart(dishId, 1);
    animatePop();
    launch();
  };

  const onInc = () => {
    cartInc(cle);
    animatePop();
    launch();
  };

  const onDec = () => {
    cartDec(cle);
    animatePop();
  };

  // Miniature du plat qui s'envole jusqu'à l'onglet Panier
  const launch = () => {
    if (!flyToCart || !dish) return;
    anchor.current?.measureInWindow((x, y, w, h) => {
      flyToCart.fly({ x: x + w / 2, y: y + h / 2 }, { image: dish.image, grad: dish.grad });
    });
  };

  const animatePop = () => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.2, useNativeDriver: true, speed: 50, bounciness: 16 }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
  };

  return (
    <View ref={anchor} collapsable={false}>
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <Animated.View style={{ width: widthAnim, height: 32 }}>
        <LinearGradient
          colors={[Brand.accentTop, Brand.accentBot]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} 
          style={s.addWrapper}
        >
        {!exigeUnChoix && inCartQty > 0 ? (
          <View style={s.addExpandedContent}>
            <PressableScale onPress={onDec} style={s.qtyBtn}>
              <Minus size={16} color="#fff" strokeWidth={3} />
            </PressableScale>
            <Text style={[displayFont(14, '700'), { color: '#fff', width: 20, textAlign: 'center' }]}>
              {inCartQty}
            </Text>
            <PressableScale onPress={onInc} style={s.qtyBtn}>
              <Plus size={16} color="#fff" strokeWidth={3} />
            </PressableScale>
          </View>
        ) : (
          <PressableScale onPress={onAdd} style={s.addCollapsedContent}>
            <Plus size={17} color="#fff" strokeWidth={3} />
          </PressableScale>
        )}
      </LinearGradient>
      </Animated.View>
    </Animated.View>
    </View>
  );
}

// ─── Tuile catégorie (accueil) ───────────────────────────────
// Pastille arrondie dans la couleur de la catégorie, reflet en haut,
// icône blanche (ou image choisie par l'admin), nom en dessous.
const CAT_TILE = 64;

export function CategoryTile({ cat, index = 0, onPress }: { cat: Category; index?: number; onPress: () => void }) {
  const { colors } = useApp();
  return (
    <FadeSlideIn index={index}>
      <PressableScale onPress={onPress} scaleTo={0.9} style={s.catItem}>
        <View style={[s.catShadow, { shadowColor: cat.grad[1] }]}>
          <LinearGradient colors={cat.grad} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={s.catTile}>
            {cat.iconImage ? (
              <ExpoImage source={{ uri: cat.iconImage }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <cat.icon size={28} color="#fff" strokeWidth={2} />
            )}
            {/* Reflet : léger voile clair sur la moitié haute */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
              style={s.catGloss}
            />
          </LinearGradient>
        </View>
        <Text numberOfLines={2} style={[bodyFont(11.5, '700'), s.catLabel, { color: colors.text }]}>{cat.name}</Text>
      </PressableScale>
    </FadeSlideIn>
  );
}

// ─── Carte restaurant « logo flottant » (accueil) ─────────────
// Couverture en fond, logo rond qui déborde du bord et lévite doucement.
const RESTO_W = 156;
const LOGO = 64;
const COVER_H = 74;

export function RestoFloatCard({ resto, index = 0 }: { resto: Resto; index?: number }) {
  const { colors } = useApp();
  const router = useRouter();

  // Lévitation : monte et redescend en boucle, décalée d'une carte à l'autre
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withDelay(index * 260, withRepeat(withSequence(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
    ), -1));
    return () => cancelAnimation(float);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -5 * float.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(float.value, [0, 1], [0.45, 0.2]),
    transform: [{ scaleX: interpolate(float.value, [0, 1], [1, 0.75]) }],
  }));

  return (
    <PressableScale onPress={() => router.push(`/resto/${resto.id}`)} scaleTo={0.95}>
      <View style={[s.restoFloat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <DishTile
          Icon={resto.icon} grad={resto.grad} image={resto.cover} iconSize={0} radius={0}
          style={{ height: COVER_H }}
        >
          <LinearGradient colors={['rgba(8,12,9,0)', 'rgba(8,12,9,0.45)']} style={StyleSheet.absoluteFill} />
        </DishTile>

        {/* Ombre au sol qui se resserre quand le logo s'élève */}
        <Reanimated.View style={[s.logoShadow, shadowStyle]} />
        <Reanimated.View style={[s.logoWrap, { borderColor: colors.surface === '#ffffff' ? '#fff' : colors.page }, logoStyle]}>
          <DishTile Icon={resto.icon} grad={resto.grad} image={resto.image} iconSize={26} radius={LOGO / 2} size={LOGO - 6} />
        </Reanimated.View>

        <View style={s.restoBody}>
          <Text numberOfLines={1} style={[displayFont(14.5, '800'), { color: colors.text, textAlign: 'center' }]}>{resto.name}</Text>
          <Text numberOfLines={1} style={[bodyFont(11, '600'), { color: colors.faint, textAlign: 'center', marginTop: 2 }]}>{resto.cuisine}</Text>
          <View style={[s.row, s.restoMeta]}>
            <Star size={11} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
            <Text style={[bodyFont(11, '800'), { color: colors.text }]}>{resto.rating}</Text>
            {resto.distanceKm != null && (
              <>
                <View style={[s.dot, { backgroundColor: colors.faint }]} />
                <MapPin size={10.5} color={Brand.green} strokeWidth={2.5} />
                <Text style={[bodyFont(11, '700'), { color: colors.muted }]}>{formatKm(resto.distanceKm)}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

// ─── Carte restaurant (liste) ────────────────────────────────
export function RestoCard({ resto }: { resto: Resto }) {
  const { colors } = useApp();
  const router = useRouter();
  const Icon = resto.icon;
  return (
    <PressableScale onPress={() => router.push(`/resto/${resto.id}`)}>
      <View style={[s.restoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <DishTile Icon={resto.icon} grad={resto.grad} image={resto.image} size={58} iconSize={26} radius={Radius.md} />
        <View style={{ flex: 1 }}>
          <Text style={[displayFont(16, '700'), { color: colors.text }]}>{resto.name}</Text>
          <Text style={[bodyFont(12, '600'), { color: colors.muted, marginTop: 2 }]}>{resto.cuisine}</Text>
          <View style={[s.row, { gap: 5, marginTop: 5 }]}>
            <Star size={12} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
            <Text style={[bodyFont(12, '700'), { color: colors.text }]}>{resto.rating}</Text>
            <Text style={[bodyFont(12, '600'), { color: colors.faint }]}> · {resto.followers} abonnés</Text>
          </View>
        </View>
        <ChevronRight size={20} color={colors.faint} />
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { borderRadius: Radius.xl, overflow: 'hidden' },
  photo: { position: 'absolute', top: 0, bottom: 0 },
  kente: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.9 },
  topRow: {
    position: 'absolute', top: 12, left: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill,
    backgroundColor: 'rgba(11,16,13,0.62)',
  },
  distChip: { alignSelf: 'flex-start', marginBottom: 8 },
  heart: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(11,16,13,0.62)',
    alignItems: 'center', justifyContent: 'center',
  },
  particle: { position: 'absolute', width: 6, height: 6, borderRadius: 3, left: 14, top: 14 },
  shine: { position: 'absolute', top: -60, bottom: -60, left: 0, width: 56 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 13 },
  name: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  meta: { color: 'rgba(255,255,255,0.78)' },
  price: { color: Brand.accentLight, flexShrink: 1, marginRight: 8 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  addWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  addCollapsedContent: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  addExpandedContent: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  qtyBtn: {
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  catItem: { width: 74, alignItems: 'center' },
  catShadow: {
    borderRadius: 22, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  catTile: {
    width: CAT_TILE, height: CAT_TILE, borderRadius: 22, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  catGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: CAT_TILE * 0.55 },
  catLabel: { marginTop: 8, textAlign: 'center', lineHeight: 14 },
  restoFloat: { width: RESTO_W, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  logoWrap: {
    position: 'absolute', top: COVER_H - LOGO / 2, alignSelf: 'center',
    width: LOGO, height: LOGO, borderRadius: LOGO / 2, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoShadow: {
    position: 'absolute', top: COVER_H + LOGO / 2 + 2, alignSelf: 'center',
    width: LOGO * 0.7, height: 6, borderRadius: 3, backgroundColor: '#000',
  },
  restoBody: { paddingTop: LOGO / 2 + 12, paddingHorizontal: 10, paddingBottom: 12 },
  restoMeta: { gap: 4, marginTop: 7, justifyContent: 'center' },
  dot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 2 },
  restoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    padding: 12, borderRadius: Radius.lg, borderWidth: 1,
  },
});
