// ═══════════════════════════════════════════════════════════
//  Cartes réutilisables : plat (large & grille) et restaurant
// ═══════════════════════════════════════════════════════════

import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Heart, Flame, Star, Plus, Minus, Check, ChevronRight, MapPin } from 'lucide-react-native';
import { Brand, Radius, cardShadow } from '../constants/theme';
import { useApp, cleLigne } from '../context/AppContext';
import { formatPrice, formatKm, type Dish, type Resto } from '../data/menuData';
import { PressableScale, DishTile, displayFont, bodyFont } from './ui';
import { animateListChange } from '../lib/layoutAnimation';

// ─── Cœur like ───────────────────────────────────────────────
function LikeHeart({ id }: { id: number }) {
  const { likes, toggleLike } = useApp();
  const liked = !!likes[id];
  return (
    <PressableScale onPress={() => { animateListChange(); toggleLike(id); }}>
      <View style={s.heart}>
        <Heart size={16} strokeWidth={2.4}
          color={liked ? Brand.accent : '#fff'}
          fill={liked ? Brand.accent : 'transparent'} />
      </View>
    </PressableScale>
  );
}

// ─── Carte plat « large » (carrousel Populaires) ─────────────
export function DishCardWide({ dish }: { dish: Dish }) {
  const { colors } = useApp();
  const router = useRouter();
  return (
    <PressableScale onPress={() => router.push(`/dish/${dish.id}`)} style={{ width: 210 }}>
      <View style={[s.wide, { backgroundColor: colors.surface, borderColor: colors.border }, cardShadow(colors.shadow)]}>
        <DishTile Icon={dish.icon} grad={dish.grad} image={dish.image} iconSize={52} radius={0} kente style={s.wideTile}>
          <View style={s.heartWrap}><LikeHeart id={dish.id} /></View>
          <View style={s.ordersBadge}>
            <Flame size={12} color={Brand.yellow} strokeWidth={2.5} />
            <Text style={[bodyFont(11, '700'), { color: Brand.yellow }]}>{dish.orders}</Text>
          </View>
          {dish.distanceKm != null && (
            <View style={[s.ordersBadge, s.distBadge]}>
              <MapPin size={11} color="#8fd6a8" strokeWidth={2.5} />
              <Text style={[bodyFont(10.5, '700'), { color: '#8fd6a8' }]}>
                {formatKm(dish.distanceKm)}{dish.etaMin != null ? ` · ${dish.etaMin} min` : ''}
              </Text>
            </View>
          )}
        </DishTile>
        <View style={{ padding: 13 }}>
          <Text numberOfLines={1} style={[displayFont(15, '700'), { color: colors.text }]}>{dish.name}</Text>
          <Text numberOfLines={1} style={[bodyFont(11.5, '600'), { color: colors.muted, marginTop: 3 }]}>{dish.restoName}</Text>
          <View style={s.wideFoot}>
            <Text style={[displayFont(15, '800'), { color: Brand.accentLight }]}>{formatPrice(dish.price)}</Text>
            <AddButton dishId={dish.id} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

// ─── Carte plat « grille » (Plats, Favoris, Resto) ───────────
export function DishCardGrid({ dish }: { dish: Dish }) {
  const { colors } = useApp();
  const router = useRouter();
  return (
    <PressableScale onPress={() => router.push(`/dish/${dish.id}`)} style={{ flex: 1 }}>
      <View style={[s.grid, { backgroundColor: colors.surface, borderColor: colors.border }, cardShadow(colors.shadow)]}>
        <DishTile Icon={dish.icon} grad={dish.grad} image={dish.image} iconSize={44} radius={0} kente style={s.gridTile}>
          <View style={s.heartWrap}><LikeHeart id={dish.id} /></View>
        </DishTile>
        <View style={{ padding: 12 }}>
          <Text numberOfLines={1} style={[displayFont(14.5, '700'), { color: colors.text }]}>{dish.name}</Text>
          <View style={[s.row, { gap: 5, marginTop: 4 }]}>
            <Star size={12} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
            <Text style={[bodyFont(11.5, '700'), { color: colors.muted }]}>{dish.rating}</Text>
            <Text numberOfLines={1} style={[bodyFont(11.5, '600'), { color: colors.faint, flex: 1 }]}> · {dish.restoName}</Text>
          </View>
          <View style={s.wideFoot}>
            <Text style={[displayFont(14.5, '800'), { color: Brand.accentLight }]}>{formatPrice(dish.price)}</Text>
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
  };

  const onInc = () => {
    cartInc(cle);
    animatePop();
  };

  const onDec = () => {
    cartDec(cle);
    animatePop();
  };

  const animatePop = () => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.2, useNativeDriver: true, speed: 50, bounciness: 16 }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
  };

  return (
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
  heart: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(11,16,13,0.72)',
    alignItems: 'center', justifyContent: 'center',
  },
  heartWrap: { position: 'absolute', top: 10, right: 10 },
  ordersBadge: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill,
    backgroundColor: 'rgba(11,16,13,0.8)',
  },
  distBadge: { left: undefined, right: 10, bottom: 10 },
  wide: { width: 210, borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  wideTile: { height: 132, borderRadius: 0 },
  wideFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  grid: { flex: 1, borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  gridTile: { height: 108, borderRadius: 0 },
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
  restoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    padding: 12, borderRadius: Radius.lg, borderWidth: 1,
  },
});
