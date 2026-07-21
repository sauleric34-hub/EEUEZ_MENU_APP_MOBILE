// ═══════════════════════════════════════════════════════════
//  Détail d'un plat — galerie, description, notation, chat
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Animated, Alert,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft, Heart, Flame, Star, ChevronRight, MessageCircle, Store, Plus, Minus, Bike, Clock,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { formatPrice, mapPlat, type Dish } from '../../data/menuData';
import { fetchPlat, ratePlat, openConversation } from '../../services/menu';
import { KenteStripe, PressableScale, Loader, displayFont, bodyFont } from '../../components/ui';
import { StarRating } from '../../components/StarRating';
import { SelecteurComplements } from '../../components/SelecteurComplements';

function StatCard({ Icon, color, value, label, bg, border }: {
  Icon: any; color: string; value: string; label: string; bg: string; border: string;
}) {
  return (
    <View style={[styles.stat, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.statTop}>
        <Icon size={15} color={color} fill={color} strokeWidth={0} />
        <Text style={[displayFont(16, '800'), { color }]}>{value}</Text>
      </View>
      <Text style={[bodyFont(10.5, '600'), { color: '#8a8f88', marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

export default function DishDetail() {
  const { colors, likes, toggleLike, addToCart, dishById, restoById, user } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cached = dishById(Number(id));
  const [fetched, setFetched] = useState<Dish | null>(null);
  const [qty, setQty] = useState(1);
  const [imgIndex, setImgIndex] = useState(0);
  const [rating, setRating] = useState<{ note: string; mine: number | null } | null>(null);
  const [rateErr, setRateErr] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  const addPop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // On re-fetch systématiquement : le détail porte ma_note (authentifié)
    fetchPlat(Number(id)).then(d => setFetched(mapPlat(d))).catch(() => {});
  }, [id]);

  const dish = fetched ?? cached;
  if (!dish) {
    return <View style={{ flex: 1, backgroundColor: colors.page }}><Loader colors={colors} /></View>;
  }

  const liked = !!likes[dish.id];
  const resto = restoById(dish.restoId);
  const restoName = resto?.name ?? dish.restoName;
  const RestoIcon = resto?.icon ?? dish.icon;
  const restoGrad = resto?.grad ?? dish.grad;
  const restoRating = resto?.rating ?? dish.rating;
  const shownRating = rating?.note ?? dish.rating;
  const myRating = rating?.mine ?? dish.myRating;
  const gallery = dish.images.length ? dish.images : [];

  // Compléments retenus : { [groupeId]: optionId }.
  const [choix, setChoix] = useState<Record<number, number>>({});

  const groupes = dish.groupesComplements ?? [];

  /** Groupes obligatoires encore sans réponse — bloque l'ajout au panier. */
  const groupesManquants = groupes.filter(
    g => g.obligatoire && g.options.length > 0 && choix[g.id] == null,
  );

  /** Détail des options choisies, libellés compris (pour le panier). */
  const complementsChoisis = groupes.flatMap(groupe => {
    const option = groupe.options.find(o => o.id === choix[groupe.id]);
    return option
      ? [{
          optionId: option.id,
          groupeNom: groupe.nom,
          optionNom: option.nom,
          supplement: option.supplement,
        }]
      : [];
  });

  const supplement = complementsChoisis.reduce((a, c) => a + c.supplement, 0);

  const addAndGo = () => {
    if (groupesManquants.length) {
      Alert.alert(
        'Choix requis',
        `Veuillez choisir : ${groupesManquants.map(g => g.nom).join(', ')}.`,
      );
      return;
    }
    // Petit pop de confirmation avant de rejoindre le panier
    Animated.sequence([
      Animated.spring(addPop, { toValue: 0.92, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(addPop, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 16 }),
    ]).start();
    addToCart(dish.id, qty, complementsChoisis);
    setTimeout(() => router.push('/(client)/panier'), 180);
  };

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setImgIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const rate = async (note: number) => {
    setRateErr(null);
    try {
      const res = await ratePlat(dish.id, note);
      setRating({ note: String(res.note), mine: res.ma_note });
    } catch (e) {
      // On surface l'erreur (session expirée / réseau) au lieu de la masquer.
      setRateErr(e instanceof Error ? e.message : 'Impossible d\'enregistrer la note.');
    }
  };

  // Ouvre (ou retrouve) la discussion sur CE plat puis pousse la page chat
  const discuss = async () => {
    if (openingChat) return;
    setOpeningChat(true);
    try {
      const conv = await openConversation(dish.id);
      router.push(`/chat/${conv.id}`);
    } catch { /* non connecté ou hors-ligne */ }
    finally { setOpeningChat(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 170 }}>
        {/* ── Galerie / hero ── */}
        <View style={styles.hero}>
          {gallery.length > 0 ? (
            <>
              <ScrollView
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onGalleryScroll}
              >
                {gallery.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={{ width, height: 280 }} resizeMode="cover" />
                ))}
              </ScrollView>
              {gallery.length > 1 && (
                <View style={styles.dots}>
                  {gallery.map((_, i) => (
                    <View key={i} style={[
                      styles.dot,
                      i === imgIndex
                        ? { backgroundColor: Brand.accent, width: 22 }
                        : { backgroundColor: 'rgba(255,255,255,0.55)' },
                    ]} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <LinearGradient colors={dish.grad} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.heroGrad}>
              <dish.icon size={110} color="#fff" strokeWidth={1.7} />
            </LinearGradient>
          )}
          <KenteStripe height={8} style={styles.heroStripe} />
        </View>

        <View style={{ padding: 20 }}>
          <View style={styles.titleRow}>
            <Text style={[displayFont(25, '800'), { color: colors.text, flex: 1 }]}>{dish.name}</Text>
            <Text style={[displayFont(22, '800'), { color: Brand.accentLight }]}>{formatPrice(dish.price)}</Text>
          </View>

          {/* Livraison — frais fixés par le restaurant pour ce plat */}
          <View style={styles.deliveryRow}>
            <Bike size={15} color={Brand.accentLight} strokeWidth={2.3} />
            <Text style={[bodyFont(12.5, '600'), { color: colors.muted }]}>
              Livraison {dish.fraisLivraison > 0 ? formatPrice(dish.fraisLivraison) : 'offerte'}
            </Text>
            {resto && (
              <>
                <View style={styles.sep} />
                <Clock size={14} color="#8fd6a8" strokeWidth={2.3} />
                <Text style={[bodyFont(12.5, '600'), { color: colors.muted }]}>~{resto.tempsLivraison} min</Text>
              </>
            )}
          </View>

          <View style={styles.statsRow}>
            <StatCard Icon={Flame} color={Brand.yellow} value={dish.orders} label="commandes" bg={colors.surface} border={colors.border} />
            <StatCard Icon={Heart} color="#ff6b70" value={dish.likes} label="j'aime" bg={colors.surface} border={colors.border} />
            <StatCard Icon={Star} color="#8fd6a8" value={shownRating} label="note" bg={colors.surface} border={colors.border} />
          </View>

          {/* Restaurant */}
          <PressableScale onPress={() => router.push(`/resto/${dish.restoId}`)}>
            <View style={[styles.restoStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {resto?.image ? (
                <Image source={{ uri: resto.image }} style={styles.restoIcon} resizeMode="cover" />
              ) : (
                <LinearGradient colors={restoGrad} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.restoIcon}>
                  <RestoIcon size={22} color="#fff" strokeWidth={2.1} />
                </LinearGradient>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[displayFont(15, '700'), { color: colors.text }]}>{restoName}</Text>
                <View style={[styles.row, { gap: 4, marginTop: 2 }]}>
                  <Star size={11} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
                  <Text style={[bodyFont(11.5, '600'), { color: colors.muted }]}>{restoRating} · Voir le profil</Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.faint} />
            </View>
          </PressableScale>

          {/* Compléments à choisir + ce qui vient avec le plat */}
          {(groupes.length > 0 || dish.elementsInclus.length > 0) && (
            <SelecteurComplements
              groupes={groupes}
              inclus={dish.elementsInclus}
              choix={choix}
              onChange={setChoix}
            />
          )}

          {/* Description */}
          {dish.description ? (
            <>
              <Text style={[displayFont(17, '700'), { color: colors.text, marginTop: 22 }]}>Description</Text>
              <Text style={[bodyFont(13.5, '500'), { color: colors.muted, marginTop: 8, lineHeight: 20 }]}>{dish.description}</Text>
            </>
          ) : null}

          {/* Ingrédients */}
          {dish.composition.length > 0 && (
            <>
              <Text style={[displayFont(17, '700'), { color: colors.text, marginTop: 22 }]}>Ingrédients</Text>
              <View style={styles.chips}>
                {dish.composition.map(ing => (
                  <View key={ing} style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                    <Text style={[bodyFont(12.5, '600'), { color: colors.text }]}>{ing}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Notation */}
          {user && (
            <View style={[styles.rateBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[displayFont(16, '700'), { color: colors.text, marginBottom: 12 }]}>Notez ce plat</Text>
              <StarRating value={myRating} onRate={rate} colors={colors} />
              {rateErr && (
                <Text style={[bodyFont(12, '600'), { color: '#ff6b70', marginTop: 8, textAlign: 'center' }]}>{rateErr}</Text>
              )}
            </View>
          )}

          {/* Actions — Discuter (plein, accent) + Restaurant (contour) */}
          <View style={styles.actionRow}>
            <PressableScale onPress={discuss} style={{ flex: 1.4 }}>
              <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.actionPrimary, glow(Brand.accent, 14)]}>
                <MessageCircle size={18} color="#fff" strokeWidth={2.5} />
                <Text style={[bodyFont(14.5, '800'), { color: '#fff' }]}>
                  {openingChat ? 'Ouverture…' : 'Discuter'}
                </Text>
              </LinearGradient>
            </PressableScale>
            <PressableScale onPress={() => router.push(`/resto/${dish.restoId}`)} style={{ flex: 1 }}>
              <View style={[styles.actionSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Store size={18} color={Brand.green} strokeWidth={2.4} />
                <Text style={[bodyFont(14, '800'), { color: colors.text }]}>Restaurant</Text>
              </View>
            </PressableScale>
          </View>
        </View>
      </ScrollView>

      {/* Boutons flottants — épinglés en haut de l'image, hors du défilement */}
      <PressableScale onPress={() => router.back()} style={[styles.floatBtn, { top: insets.top + 8, left: 16 }]}>
        <ChevronLeft size={22} color="#fff" />
      </PressableScale>
      <PressableScale onPress={() => toggleLike(dish.id)} style={[styles.floatBtn, { top: insets.top + 8, right: 16 }]}>
        <Heart size={19} color={liked ? Brand.accent : '#fff'} fill={liked ? Brand.accent : 'transparent'} strokeWidth={2.3} />
      </PressableScale>

      {/* Barre de commande — juste au-dessus de la navigation système */}
      <View style={[styles.orderBar, { backgroundColor: colors.nav, borderColor: colors.border, bottom: Math.max(insets.bottom, 10) + 8 }, glow(colors.shadow, 30)]}>
        <View style={[styles.stepper, { backgroundColor: colors.surface2 }]}>
          <PressableScale onPress={() => setQty(q => Math.max(1, q - 1))}>
            <View style={[styles.stepBtn, { backgroundColor: colors.surface }]}><Minus size={18} color={colors.text} strokeWidth={2.6} /></View>
          </PressableScale>
          <Text style={[displayFont(15, '800'), { color: colors.text, minWidth: 24, textAlign: 'center' }]}>{qty}</Text>
          <PressableScale onPress={() => setQty(q => q + 1)}>
            <View style={[styles.stepBtn, { backgroundColor: Brand.accent }]}><Plus size={18} color="#fff" strokeWidth={2.6} /></View>
          </PressableScale>
        </View>
        <Animated.View style={{ flex: 1, transform: [{ scale: addPop }] }}>
          <PressableScale onPress={addAndGo}>
            <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.addBtn, glow(Brand.accent, 18)]}>
              <Plus size={17} color="#fff" strokeWidth={2.8} />
              {/* Le montant inclut les suppléments : le client voit tout de
                  suite ce que son choix change au prix. */}
              <Text style={[bodyFont(15, '800'), { color: '#fff' }]}>
                Ajouter · {formatPrice((dish.price + supplement) * qty)}
              </Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hero: { height: 280 },
  heroGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroStripe: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroBtn: {
    position: 'absolute', left: 18, width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(11,16,13,0.8)', alignItems: 'center', justifyContent: 'center',
    zIndex: 20,
  },
  heroBtnR: { left: undefined, right: 18 },
  dots: {
    position: 'absolute', bottom: 14, alignSelf: 'center',
    flexDirection: 'row', gap: 6, alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  sep: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(150,150,150,0.5)' },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  stat: { flex: 1, paddingVertical: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  restoStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 20, borderWidth: 1, marginTop: 16,
  },
  restoIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1 },
  rateBox: { marginTop: 24, padding: 18, borderRadius: 22, borderWidth: 1, alignItems: 'center' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: Radius.pill,
  },
  actionSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: Radius.pill, borderWidth: 1.5,
  },
  floatBtn: {
    position: 'absolute', width: 42, height: 42, borderRadius: 21, zIndex: 50,
    backgroundColor: 'rgba(11,16,13,0.82)', alignItems: 'center', justifyContent: 'center',
  },
  orderBar: {
    position: 'absolute', left: 14, right: 14, zIndex: 30,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: Radius.pill, borderWidth: 1,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, padding: 5 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 15, borderRadius: Radius.pill,
  },
});
