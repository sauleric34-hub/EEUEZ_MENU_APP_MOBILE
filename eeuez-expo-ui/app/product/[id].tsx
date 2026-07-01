import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Animated, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow, glowSubtle, StatutConfig } from '../../constants/theme';
import { PressableScale, ConfettiBurst, EmojiPop, useButtonPress } from '../../components/Animations';
import { MOCK_RESTAURANT_USER } from '../../data/mockData';
import { useAppContext } from '../../context/AppContext';
import { restaurantService } from '../../services/apiService';
import {
  Store, Star, Clock, Utensils, Leaf, ShoppingCart,
  ChefHat, CheckCircle,
} from 'lucide-react-native';

function StatutPill({ statut }: { statut: string }) {
  const cfg = StatutConfig[statut] ?? StatutConfig.en_attente;
  const Icon = cfg.icon;
  return (
    <View style={[s.pill, { backgroundColor: cfg.bg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
      {Icon && <Icon size={12} color={cfg.color} />}
      <Text style={[s.pillText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function AvisStars({ note, onRate }: { note: number; onRate: (n: number) => void }) {
  return (
    <View style={s.starsRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <PressableScale key={n} onPress={() => onRate(n)}>
          <Star size={28} color={n <= note ? Colors.livreur.primary : Colors.text.muted} fill={n <= note ? Colors.livreur.primary : 'none'} />
        </PressableScale>
      ))}
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(0);
  const [added, setAdded] = useState(false);
  const { confettiVisible, emojiVisible, emoji, triggerSuccess } = useButtonPress();
  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideIn = useRef(new Animated.Value(60)).current;
  const { addToCart } = useAppContext();

  const [plat, setPlat] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideIn, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();

    const loadPlat = async () => {
      try {
        const restaurants: any = await restaurantService.getNearby(3.848, 11.502);
        let foundPlat: any = null;
        for (const r of restaurants) {
          if (r.menu) {
            for (const cat of r.menu) {
              if (cat.plats) {
                const found = cat.plats.find((p: any) => String(p.id) === String(id));
                if (found) {
                  foundPlat = { ...found, restaurantNom: r.nomEtablissement, restaurantId: r.id };
                  break;
                }
              }
            }
          }
          if (foundPlat) break;
        }

        if (foundPlat) {
          setPlat({
            ...foundPlat,
            ingredients: foundPlat.ingredients || [],
          });
        } else {
          // Fallback sur le mock local
          let mockFound = null;
          for (const cat of (MOCK_RESTAURANT_USER.menu ?? [])) {
            const found = cat.plats.find((p: any) => String(p.id) === String(id));
            if (found) {
              mockFound = { ...found, restaurantNom: MOCK_RESTAURANT_USER.nomEtablissement, restaurantId: 'r1' };
              break;
            }
          }
          if (mockFound) {
            setPlat({
              ...mockFound,
              ingredients: mockFound.ingredients || [],
            });
          } else {
            // Default fallback
            setPlat({
              id: id || 'p1',
              nom: 'Poulet DG',
              description: 'Poulet sauté aux plantains et légumes frais',
              prix: 4500,
              ingredients: ['Poulet', 'Plantains', 'Carottes', 'Poivrons'],
              noteGlobale: 4.9,
              tempsPreparation: 20,
              restaurantNom: "Le Phénix d'Or",
              restaurantId: 'r1',
              isPopulaire: true,
            });
          }
        }
      } catch (err) {
        console.error("Erreur de chargement du plat depuis l'API:", err);
        // Fallback sur le mock local
        let mockFound = null;
        for (const cat of (MOCK_RESTAURANT_USER.menu ?? [])) {
          const found = cat.plats.find((p: any) => String(p.id) === String(id));
          if (found) {
            mockFound = { ...found, restaurantNom: MOCK_RESTAURANT_USER.nomEtablissement, restaurantId: 'r1' };
            break;
          }
        }
        setPlat(mockFound || {
          id: id || 'p1',
          nom: 'Poulet DG',
          description: 'Poulet sauté aux plantains et légumes frais',
          prix: 4500,
          ingredients: ['Poulet', 'Plantains', 'Carottes', 'Poivrons'],
          noteGlobale: 4.9,
          tempsPreparation: 20,
          restaurantNom: "Le Phénix d'Or",
          restaurantId: 'r1',
          isPopulaire: true,
        });
      } finally {
        setLoading(false);
      }
    };

    loadPlat();
  }, [id]);

  const handleAdd = () => {
    if (!plat) return;
    triggerSuccess('🛒');
    setAdded(true);
    addToCart({ id: plat.id, nom: plat.nom, prix: plat.prix, quantite: qty, restaurantId: plat.restaurantId || 'r1' });
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading || !plat) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.client.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>

        {/* Confetti + Emoji */}
        <View style={{ position: 'absolute', top: 100, alignSelf: 'center', zIndex: 100 }}>
          <ConfettiBurst visible={confettiVisible} />
          <EmojiPop emoji={emoji} visible={emojiVisible} size={48} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>

          {/* Header */}
          <Animated.View style={[s.header, { opacity: fadeIn }]}>
            <PressableScale onPress={() => router.back()}>
              <View style={s.backBtn}><Text style={s.backArrow}>←</Text></View>
            </PressableScale>
            <Text style={s.headerTitle}>Détail du plat</Text>
            <View style={{ width: 44 }} />
          </Animated.View>

          {/* Hero plat */}
          <Animated.View style={[s.platHero, { opacity: fadeIn, transform: [{ translateY: slideIn }] }]}>
            <View style={[s.platEmojiBox, glowSubtle(Colors.restaurant.primary)]}>
              <Utensils size={64} color={Colors.restaurant.primary} />
            </View>
            {plat.isPopulaire && (
              <View style={s.popularBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Star size={13} color={Colors.livreur.primary} fill={Colors.livreur.primary} />
                  <Text style={s.popularText}>Plat populaire</Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Infos */}
          <Animated.View style={[s.infoBox, { opacity: fadeIn }]}>
            <Text style={s.platNom}>{plat.nom}</Text>
            <Text style={s.platResto}>
              <Store size={12} color={Colors.text.secondary} />{' '}{plat.restaurantNom}
            </Text>
            <View style={s.metaRow}>
              <View style={s.metaChip}>
                <Star size={12} color={Colors.livreur.primary} fill={Colors.livreur.primary} />
                <Text style={s.metaText}>{plat.noteGlobale ?? '4.9'}</Text>
              </View>
              <View style={s.metaChip}>
                <Clock size={12} color={Colors.text.secondary} />
                <Text style={s.metaText}>{plat.tempsPreparation ?? 20} min</Text>
              </View>
              <View style={s.metaChip}>
                {plat.isVegetarien
                  ? <Leaf size={12} color={Colors.restaurant.primary} />
                  : <Utensils size={12} color={Colors.text.secondary} />
                }
                <Text style={s.metaText}>{plat.isVegetarien ? 'Végétarien' : 'Viande'}</Text>
              </View>
            </View>
            <Text style={s.platDesc}>{plat.description}</Text>
          </Animated.View>

          {/* Ingrédients */}
          {plat.ingredients?.length > 0 && (
            <View style={s.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ChefHat size={16} color={Colors.text.primary} />
                <Text style={s.sectionTitle}>Ingrédients</Text>
              </View>
              <View style={s.ingredientsList}>
                {plat.ingredients.map((ing: string) => (
                  <View key={ing} style={s.ingredientChip}>
                    <Text style={s.ingredientText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Donner un avis */}
          <View style={s.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Star size={16} color={Colors.livreur.primary} fill={Colors.livreur.primary} />
              <Text style={s.sectionTitle}>Donner un avis</Text>
            </View>
            <AvisStars note={rating} onRate={setRating} />
            {rating > 0 && <Text style={[s.ratingLabel, { color: Colors.livreur.primary }]}>Merci pour votre avis ! ({rating}/5)</Text>}
          </View>

        </ScrollView>

        {/* CTA Commander */}
        <View style={s.ctaBox}>
          <View style={s.qtyControl}>
            <PressableScale onPress={() => setQty(q => Math.max(1, q - 1))}>
              <View style={s.qtyBtn}><Text style={s.qtyBtnText}>−</Text></View>
            </PressableScale>
            <Text style={s.qtyText}>{qty}</Text>
            <PressableScale onPress={() => setQty(q => q + 1)}>
              <View style={[s.qtyBtn, { backgroundColor: Colors.client.bg, borderColor: Colors.client.primary }]}>
                <Text style={[s.qtyBtnText, { color: Colors.client.primary }]}>+</Text>
              </View>
            </PressableScale>
          </View>
          <PressableScale onPress={handleAdd} style={{ flex: 1 }}>
            <View style={[s.addBtn, glow(Colors.client.glow, 12)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {added
                  ? <CheckCircle size={18} color={Colors.bg.app} />
                  : <ShoppingCart size={18} color={Colors.bg.app} />
                }
                <Text style={s.addBtnText}>
                  {added ? 'Ajouté !' : `Ajouter — ${((plat.prix ?? 4500) * qty).toLocaleString()} FCFA`}
                </Text>
              </View>
            </View>
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg.app },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  backBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.glass.bg, justifyContent: 'center', alignItems: 'center' },
  backArrow:      { fontSize: 22, color: Colors.text.primary },
  headerTitle:    { ...Typography.h3, fontSize: 18 },
  platHero:       { alignItems: 'center', paddingVertical: Spacing.xl },
  platEmojiBox:   { width: 140, height: 140, borderRadius: 40, backgroundColor: Colors.restaurant.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.restaurant.primary + '44' },
  popularBadge:   { marginTop: 14, backgroundColor: Colors.livreur.bg, paddingHorizontal: 16, paddingVertical: 6, borderRadius: Radius.full },
  popularText:    { fontSize: 13, fontWeight: '800', color: Colors.livreur.primary },
  infoBox:        { paddingHorizontal: Spacing.md, gap: 10 },
  platNom:        { ...Typography.h1, fontSize: 26 },
  platResto:      { ...Typography.small, color: Colors.text.secondary },
  metaRow:        { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  metaChip:       { backgroundColor: Colors.bg.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border.default, flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:       { ...Typography.small, fontWeight: '700' },
  platDesc:       { ...Typography.body, marginTop: 4, lineHeight: 22 },
  section:        { paddingHorizontal: Spacing.md, marginTop: Spacing.lg, gap: 12 },
  sectionTitle:   { ...Typography.h3, fontSize: 16 },
  ingredientsList:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ingredientChip: { backgroundColor: Colors.bg.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border.default },
  ingredientText: { ...Typography.small },
  starsRow:       { flexDirection: 'row', gap: 8 },
  ratingLabel:    { ...Typography.small, fontWeight: '700', marginTop: 4 },
  ctaBox:         { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, backgroundColor: Colors.bg.surface, borderTopWidth: 1, borderTopColor: Colors.border.default, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  qtyControl:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg.elevated, borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 8 },
  qtyBtn:         { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: Colors.border.default, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg.surface },
  qtyBtnText:     { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  qtyText:        { ...Typography.h3, minWidth: 24, textAlign: 'center' },
  addBtn:         { backgroundColor: Colors.client.primary, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  addBtnText:     { color: Colors.bg.app, fontWeight: '900', fontSize: 15 },
  pill:           { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  pillText:       { fontSize: 11, fontWeight: '700' },
});
