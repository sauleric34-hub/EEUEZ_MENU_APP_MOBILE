import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow, glowSubtle } from '../../../constants/theme';
import { PressableScale, ConfettiBurst, EmojiPop, useButtonPress } from '../../../components/Animations';
import { RESTAURANTS_LISTE, MOCK_RESTAURANT_USER } from '../../../data/mockData';
import { useAppContext } from '../../../context/AppContext';

function PlatCard({ plat, onAdd }: { plat: any; onAdd: () => void }) {
  const { confettiVisible, emojiVisible, emoji, triggerSuccess } = useButtonPress();
  const slideIn = useRef(new Animated.Value(30)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideIn, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleAdd = () => {
    triggerSuccess('🛒');
    onAdd();
  };

  return (
    <Animated.View style={[s.platCard, glowSubtle(Colors.client.primary), { opacity: fadeIn, transform: [{ translateY: slideIn }] }]}>
      <View style={{ position: 'relative' }}>
        <ConfettiBurst visible={confettiVisible} />
        <EmojiPop emoji={emoji} visible={emojiVisible} size={28} />
      </View>
      <View style={s.platEmoji}>
        <Text style={{ fontSize: 34 }}>{plat.isPopulaire ? '⭐' : '🍽️'}</Text>
      </View>
      <View style={s.platInfo}>
        <View style={s.platHeader}>
          <Text style={s.platNom}>{plat.nom}</Text>
          {plat.isPopulaire && <View style={s.popularBadge}><Text style={s.popularText}>Top</Text></View>}
        </View>
        <Text style={s.platDesc}>{plat.description}</Text>
        <View style={s.platFooter}>
          <Text style={s.platPrix}>{plat.prix.toLocaleString()} FCFA</Text>
          <PressableScale onPress={handleAdd}>
            <View style={[s.addBtn, glow(Colors.client.glow, 8)]}>
              <Text style={s.addBtnText}>+ Ajouter</Text>
            </View>
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
}

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('');
  const { cart, addToCart } = useAppContext();
  const cartCount = cart.reduce((acc, i) => acc + i.quantite, 0);
  const fadeIn = useRef(new Animated.Value(0)).current;

  const resto = RESTAURANTS_LISTE.find(r => r.id === id) ?? RESTAURANTS_LISTE[0];

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    if (MOCK_RESTAURANT_USER.menu?.length) setActiveCategory(MOCK_RESTAURANT_USER.menu[0].id);
  }, []);

  const currentMenu = MOCK_RESTAURANT_USER.menu?.find(c => c.id === activeCategory);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>

        {/* Hero */}
        <Animated.View style={[s.hero, { opacity: fadeIn }]}>
          <PressableScale onPress={() => router.back()}>
            <View style={s.backBtn}><Text style={s.backArrow}>←</Text></View>
          </PressableScale>
          <View style={s.heroContent}>
            <View style={s.restoIconBox}><Text style={{ fontSize: 40 }}>🏪</Text></View>
            <View style={s.restoMain}>
              <Text style={s.restoNom}>{resto.nom}</Text>
              <Text style={s.restoCat}>{resto.categorie} · Yaoundé</Text>
              <View style={s.metaRow}>
                <Text style={s.metaItem}>⭐ {resto.note}</Text>
                <Text style={s.metaItem}>⏱ {resto.temps} min</Text>
                <Text style={s.metaItem}>🛵 {resto.frais} FCFA</Text>
              </View>
            </View>
            <View style={[s.ouvertBadge, { backgroundColor: resto.isOuvert ? Colors.restaurant.bg : Colors.dangerBg }]}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: resto.isOuvert ? Colors.restaurant.primary : Colors.danger }}>
                {resto.isOuvert ? '● Ouvert' : '● Fermé'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Catégories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 10 }}>
          {MOCK_RESTAURANT_USER.menu?.map(cat => (
            <PressableScale key={cat.id} onPress={() => setActiveCategory(cat.id)}>
              <View style={[s.catChip, activeCategory === cat.id && { backgroundColor: Colors.client.bg, borderColor: Colors.client.primary }]}>
                <Text style={{ fontSize: 16 }}>{cat.icone}</Text>
                <Text style={[s.catLabel, activeCategory === cat.id && { color: Colors.client.primary }]}>{cat.nom}</Text>
              </View>
            </PressableScale>
          ))}
        </ScrollView>

        {/* Plats */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
          <Text style={s.sectionTitle}>{currentMenu?.nom ?? 'Menu'}</Text>
          {(currentMenu?.plats ?? []).map(plat => (
            <PlatCard key={plat.id} plat={plat} onAdd={() => addToCart({ id: plat.id, nom: plat.nom, prix: plat.prix, quantite: 1, restaurantId: id as string })} />
          ))}
        </ScrollView>

        {/* CTA Panier */}
        {cartCount > 0 && (
          <View style={s.cartCta}>
            <PressableScale onPress={() => router.push('/(client)/cart' as any)}>
              <View style={[s.cartBtn, glow(Colors.client.glow, 14)]}>
                <View style={s.cartBadge}><Text style={s.cartBadgeText}>{cartCount}</Text></View>
                <Text style={s.cartBtnText}>🛒 Voir le panier</Text>
              </View>
            </PressableScale>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg.app },
  hero:         { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 12 },
  backBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.glass.bg, justifyContent: 'center', alignItems: 'center' },
  backArrow:    { fontSize: 22, color: Colors.text.primary },
  heroContent:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border.default },
  restoIconBox: { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.restaurant.bg, justifyContent: 'center', alignItems: 'center' },
  restoMain:    { flex: 1, gap: 4 },
  restoNom:     { ...Typography.h3 },
  restoCat:     { ...Typography.small },
  metaRow:      { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaItem:     { ...Typography.small, fontWeight: '600' },
  ouvertBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, alignSelf: 'flex-start' },
  catScroll:    { marginBottom: 8 },
  catChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.bg.surface, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border.default },
  catLabel:     { ...Typography.small, fontWeight: '700', color: Colors.text.secondary },
  sectionTitle: { ...Typography.h3, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  platCard:     { flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: 12, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border.default, gap: 12 },
  platEmoji:    { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  platInfo:     { flex: 1, gap: 6 },
  platHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  platNom:      { ...Typography.bodyBold, flex: 1 },
  popularBadge: { backgroundColor: Colors.livreur.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  popularText:  { fontSize: 10, fontWeight: '800', color: Colors.livreur.primary },
  platDesc:     { ...Typography.small, lineHeight: 18 },
  platFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  platPrix:     { ...Typography.bodyBold, color: Colors.client.primary },
  addBtn:       { backgroundColor: Colors.client.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.lg },
  addBtnText:   { color: Colors.bg.app, fontWeight: '800', fontSize: 13 },
  cartCta:      { position: 'absolute', bottom: 20, left: Spacing.md, right: Spacing.md },
  cartBtn:      { backgroundColor: Colors.client.primary, borderRadius: Radius.xl, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  cartBadge:    { backgroundColor: Colors.bg.app, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText:{ color: Colors.client.primary, fontWeight: '900', fontSize: 12 },
  cartBtnText:  { color: Colors.bg.app, fontWeight: '900', fontSize: 16 },
});
