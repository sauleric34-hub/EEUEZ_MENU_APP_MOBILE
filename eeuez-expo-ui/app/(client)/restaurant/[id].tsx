import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Image, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PressableScale, useButtonPress, FloatingReaction } from '../../../components/Animations';
import { Colors, Typography, Spacing, Radius, glow } from '../../../constants/theme';
import { useAppContext } from '../../../context/AppContext';
import { restaurantService } from '../../../services/apiService';
import { MOCK_RESTAURANT_USER } from '../../../data/mockData';

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { cart, addToCart, likedDishes, toggleLikeDish } = useAppContext();
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const { emojiVisible, emoji: reactionEmoji, triggerSuccess } = useButtonPress();

  const [restoFull, setRestoFull] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restaurantService.getDescription(Number(id))
      .then(res => {
        setRestoFull(res);
        setLoading(false);
      })
      .catch(err => {
        console.log("Info: Le backend est hors-ligne, chargement données simulées pour restaurant", id);
        setRestoFull(MOCK_RESTAURANT_USER);
        setLoading(false);
      });
  }, [id]);

  // Header Parallax effect
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [250, 100],
    extrapolate: 'clamp',
  });

  if (loading || !restoFull) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Chargement...</Text></View>;
  }

  const handleAddCart = (plat: any) => {
    addToCart({
      id: plat.id,
      nom: plat.nom,
      prix: plat.prix,
      quantite: 1,
      restaurantId: restoFull.id,
    });
    triggerSuccess('🛒');
  };

  const handleLike = (platId: string) => {
    toggleLikeDish(platId);
    if (!likedDishes.includes(platId)) {
      triggerSuccess('❤️');
    }
  };

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Dynamic Header */}
      <Animated.View style={[s.header, { height: headerHeight, backgroundColor: '#FF6B6B' }]}>
        <View style={s.headerOverlay} />
        <SafeAreaView style={s.topBar}>
          <PressableScale onPress={() => router.back()}>
            <View style={s.backBtn}><Text style={{ fontSize: 24, color: '#FFF' }}>←</Text></View>
          </PressableScale>
          <View style={s.notifBtn}><Text style={{ fontSize: 22 }}>💬</Text></View>
        </SafeAreaView>
        <Animated.View style={s.headerContent}>
          <Text style={{ fontSize: 60, marginBottom: 10 }}>🍽️</Text>
          <Text style={s.title}>{restoFull.nom}</Text>
          <Text style={s.subtitle}>
            {typeof restoFull.adresse === 'string' 
              ? restoFull.adresse 
              : `${restoFull.adresse?.rue || ''}, ${restoFull.adresse?.ville || ''}`}
          </Text>
        </Animated.View>
      </Animated.View>

      <ScrollView 
        contentContainerStyle={s.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        <View style={s.infoCard}>
          <View style={s.rowBetween}>
            <View>
              <Text style={s.ratingText}>⭐ {restoFull.note} ({restoFull.avis || 0} avis)</Text>
              <Text style={s.deliveryText}>🛵 {restoFull.temps} min • {restoFull.frais} FCFA</Text>
            </View>
            <View style={s.openBadge}>
              <Text style={s.openBadgeText}>{restoFull.isOuvert ? 'OUVERT' : 'FERMÉ'}</Text>
            </View>
          </View>
          <Text style={s.description}>{restoFull.description}</Text>
        </View>

        <FloatingReaction emoji={reactionEmoji} visible={emojiVisible} />

        {/* Menu */}
        {restoFull.menu.map(cat => (
          <View key={cat.id} style={s.categorySection}>
            <Text style={s.categoryTitle}>{cat.icone} {cat.nom}</Text>
            {cat.plats.map(plat => {
              const isLiked = likedDishes.includes(plat.id);
              return (
                <View key={plat.id} style={s.platCard}>
                  <View style={s.platInfo}>
                    <Text style={s.platName}>{plat.nom}</Text>
                    <Text style={s.platDesc} numberOfLines={2}>{plat.description}</Text>
                    <Text style={s.platPrice}>{plat.prix} FCFA</Text>
                  </View>
                  <View style={s.platActions}>
                    <PressableScale onPress={() => handleLike(plat.id)} scaleDown={0.8}>
                      <View style={[s.likeBtn, isLiked && s.likeBtnActive]}>
                        <Text style={{ fontSize: 16 }}>{isLiked ? '❤️' : '🤍'}</Text>
                      </View>
                    </PressableScale>
                    <PressableScale onPress={() => handleAddCart(plat)} scaleDown={0.9}>
                      <View style={[s.addBtn, { backgroundColor: Colors.client.primary }]}>
                        <Text style={s.addBtnText}>+ Ajouter</Text>
                      </View>
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <Animated.View style={s.floatingCartContainer}>
          <PressableScale onPress={() => router.push('/(client)/panier')} style={{ width: '100%' }}>
            <View style={[s.floatingCartBtn, glow(Colors.client.primary, 14)]}>
              <Text style={s.cartBadge}>{cart.reduce((sum, i) => sum + i.quantite, 0)}</Text>
              <Text style={s.cartTotal}>Voir le panier • {cart.reduce((sum, i) => sum + i.prix * i.quantite, 0)} FCFA</Text>
            </View>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.screen },
  header: { justifyContent: 'space-between', overflow: 'hidden' },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  notifBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  headerContent: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  title: { ...Typography.h1, color: '#FFF', fontSize: 32 },
  subtitle: { ...Typography.bodyBold, color: '#EEE', marginTop: 4 },
  scrollContent: { paddingTop: 20 },
  infoCard: { backgroundColor: Colors.bg.surface, marginHorizontal: Spacing.md, borderRadius: Radius.xl, padding: Spacing.lg, marginTop: -40, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  ratingText: { ...Typography.bodyBold, fontSize: 16 },
  deliveryText: { ...Typography.small, color: Colors.text.secondary, marginTop: 4 },
  openBadge: { backgroundColor: Colors.success + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  openBadgeText: { color: Colors.success, fontSize: 12, fontWeight: '800' },
  description: { ...Typography.body, color: Colors.text.secondary, lineHeight: 22 },
  categorySection: { marginTop: Spacing.xl, paddingHorizontal: Spacing.md },
  categoryTitle: { ...Typography.h2, marginBottom: Spacing.md },
  platCard: { backgroundColor: Colors.bg.elevated, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderWidth: 1, borderColor: Colors.border.default },
  platInfo: { flex: 1, marginRight: 12 },
  platName: { ...Typography.bodyBold, fontSize: 16 },
  platDesc: { ...Typography.small, color: Colors.text.muted, marginTop: 4 },
  platPrice: { ...Typography.bodyBold, color: Colors.client.primary, marginTop: 8 },
  platActions: { justifyContent: 'space-between', alignItems: 'flex-end' },
  likeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  likeBtnActive: { backgroundColor: Colors.danger + '22', borderColor: Colors.danger + '44' },
  addBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, marginTop: 12 },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  floatingCartContainer: { position: 'absolute', bottom: 30, left: Spacing.md, right: Spacing.md },
  floatingCartBtn: { backgroundColor: Colors.client.primary, borderRadius: Radius.xl, padding: 16, flexDirection: 'row', alignItems: 'center' },
  cartBadge: { backgroundColor: '#FFF', color: Colors.client.primary, width: 28, height: 28, borderRadius: 14, textAlign: 'center', lineHeight: 28, fontWeight: '800', fontSize: 14 },
  cartTotal: { flex: 1, textAlign: 'center', color: '#FFF', fontWeight: '800', fontSize: 16 },
});
