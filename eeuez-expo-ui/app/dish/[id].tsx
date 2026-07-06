// ═══════════════════════════════════════════════════════════
//  Détail d'un plat
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft, Heart, Flame, Star, ChevronRight, MessageCircle, Store, Plus, Minus,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { formatPrice, mapPlat, type Dish } from '../../data/menuData';
import { fetchPlat } from '../../services/menu';
import { KenteStripe, PressableScale, Loader, displayFont, bodyFont } from '../../components/ui';
import { ChatSheet } from '../../components/ChatSheet';

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
  const { colors, likes, toggleLike, addToCart, dishById, restoById } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cached = dishById(Number(id));
  const [fetched, setFetched] = useState<Dish | null>(null);
  const [qty, setQty] = useState(1);
  const [chat, setChat] = useState(false);

  useEffect(() => {
    if (!cached) fetchPlat(Number(id)).then(d => setFetched(mapPlat(d))).catch(() => {});
  }, [cached, id]);

  const dish = cached ?? fetched;
  if (!dish) {
    return <View style={{ flex: 1, backgroundColor: colors.page }}><Loader colors={colors} /></View>;
  }

  const liked = !!likes[dish.id];
  const resto = restoById(dish.restoId);
  const restoName = resto?.name ?? dish.restoName;
  const RestoIcon = resto?.icon ?? dish.icon;
  const restoGrad = resto?.grad ?? dish.grad;
  const restoRating = resto?.rating ?? dish.rating;
  const descriptionText = dish.description.trim() || (
    dish.composition.length ? `Préparé avec ${dish.composition.join(', ')}.` : ''
  );
  const addAndGo = () => { addToCart(dish.id, qty); router.push('/(client)/panier'); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Hero */}
        <LinearGradient colors={dish.grad} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.hero}>
          {dish.image ? <Image source={{ uri: dish.image }} style={styles.heroImage} resizeMode="cover" /> : null}
          {dish.image ? (
            <LinearGradient
              colors={['rgba(11,16,13,0.18)', 'rgba(11,16,13,0.58)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.heroShade}
            />
          ) : null}
          <KenteStripe height={8} style={styles.heroStripe} />
          {!dish.image ? <dish.icon size={110} color="#fff" strokeWidth={1.7} /> : null}
          <PressableScale onPress={() => router.back()}>
            <View style={styles.heroBtn}><ChevronLeft size={22} color="#fff" /></View>
          </PressableScale>
          <PressableScale onPress={() => toggleLike(dish.id)}>
            <View style={[styles.heroBtn, styles.heroBtnR]}>
              <Heart size={19} color={liked ? Brand.accent : '#fff'} fill={liked ? Brand.accent : 'transparent'} strokeWidth={2.3} />
            </View>
          </PressableScale>
        </LinearGradient>

        <View style={{ padding: 20 }}>
          <View style={styles.titleRow}>
            <Text style={[displayFont(25, '800'), { color: colors.text, flex: 1 }]}>{dish.name}</Text>
            <Text style={[displayFont(22, '800'), { color: Brand.accentLight }]}>{formatPrice(dish.price)}</Text>
          </View>

          <View style={styles.statsRow}>
            <StatCard Icon={Flame} color={Brand.yellow} value={dish.orders} label="commandes" bg={colors.surface} border={colors.border} />
            <StatCard Icon={Heart} color="#ff6b70" value={dish.likes} label="j'aime" bg={colors.surface} border={colors.border} />
            <StatCard Icon={Star} color="#8fd6a8" value={dish.rating} label="note" bg={colors.surface} border={colors.border} />
          </View>

          {/* Restaurant strip */}
          <PressableScale onPress={() => router.push(`/resto/${dish.restoId}`)}>
            <View style={[styles.restoStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LinearGradient colors={restoGrad} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.restoIcon}>
                <RestoIcon size={22} color="#fff" strokeWidth={2.1} />
              </LinearGradient>
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

          {descriptionText ? (
            <>
              <Text style={[displayFont(17, '700'), { color: colors.text, marginTop: 22 }]}>Description</Text>
              <Text style={[bodyFont(13.5, '500'), { color: colors.muted, marginTop: 8, lineHeight: 20 }]}>{descriptionText}</Text>
            </>
          ) : null}

          {dish.composition.length > 0 && (
            <>
              <Text style={[displayFont(17, '700'), { color: colors.text, marginTop: 22 }]}>Composition</Text>
              <View style={styles.chips}>
                {dish.composition.map(ing => (
                  <View key={ing} style={[styles.chip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                    <Text style={[bodyFont(12.5, '600'), { color: colors.text }]}>{ing}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.actionRow}>
            <PressableScale onPress={() => setChat(true)} style={{ flex: 1 }}>
              <View style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MessageCircle size={17} color={colors.text} strokeWidth={2.2} />
                <Text style={[bodyFont(14, '700'), { color: colors.text }]}>Discuter</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={() => router.push(`/resto/${dish.restoId}`)} style={{ flex: 1 }}>
              <View style={[styles.actionBtn, { backgroundColor: Brand.green + '1c', borderColor: Brand.green + '55' }]}>
                <Store size={17} color="#8fd6a8" strokeWidth={2.2} />
                <Text style={[bodyFont(14, '700'), { color: '#8fd6a8' }]}>Restaurant</Text>
              </View>
            </PressableScale>
          </View>
        </View>
      </ScrollView>

      {/* Barre de commande */}
      <View style={[styles.orderBar, { backgroundColor: colors.nav, borderColor: colors.border }, glow(colors.shadow, 30)]}>
        <View style={[styles.stepper, { backgroundColor: colors.surface2 }]}>
          <PressableScale onPress={() => setQty(q => Math.max(1, q - 1))}>
            <View style={[styles.stepBtn, { backgroundColor: colors.surface }]}><Minus size={18} color={colors.text} strokeWidth={2.6} /></View>
          </PressableScale>
          <Text style={[displayFont(15, '800'), { color: colors.text, minWidth: 22, textAlign: 'center' }]}>{qty}</Text>
          <PressableScale onPress={() => setQty(q => q + 1)}>
            <View style={[styles.stepBtn, { backgroundColor: Brand.accent }]}><Plus size={18} color="#fff" strokeWidth={2.6} /></View>
          </PressableScale>
        </View>
        <PressableScale onPress={addAndGo} style={{ flex: 1 }}>
          <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
            <Text style={[bodyFont(15, '800'), { color: '#fff' }]}>Ajouter · {formatPrice(dish.price * qty)}</Text>
          </LinearGradient>
        </PressableScale>
      </View>

      <ChatSheet visible={chat} onClose={() => setChat(false)} restoName={restoName} Icon={RestoIcon} grad={restoGrad} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hero: { height: 262, alignItems: 'center', justifyContent: 'center' },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroShade: { ...StyleSheet.absoluteFillObject },
  heroStripe: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroBtn: {
    position: 'absolute', top: 52, left: 18, width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(11,16,13,0.8)', alignItems: 'center', justifyContent: 'center',
  },
  heroBtnR: { left: undefined, right: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  stat: { flex: 1, paddingVertical: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  restoStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 20, borderWidth: 1, marginTop: 16,
  },
  restoIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: Radius.pill, borderWidth: 1,
  },
  orderBar: {
    position: 'absolute', left: 14, right: 14, bottom: 18, zIndex: 30,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: Radius.pill, borderWidth: 1,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, padding: 6 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addBtn: { paddingVertical: 15, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
