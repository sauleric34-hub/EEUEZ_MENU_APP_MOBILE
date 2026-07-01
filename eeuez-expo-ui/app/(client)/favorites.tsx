import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow, glowSubtle } from '../../constants/theme';
import { PressableScale, EmojiPop, useButtonPress } from '../../components/Animations';
import { RESTAURANTS_LISTE } from '../../data/mockData';
import { useAppContext } from '../../context/AppContext';
import { Store, Star, Bike, Heart, HeartOff } from 'lucide-react-native';

function FavCard({ resto }: { resto: typeof RESTAURANTS_LISTE[0] }) {
  const router = useRouter();
  const { followedRestaurants, toggleFollowRestaurant } = useAppContext();
  const isFav = followedRestaurants.includes(resto.id);
  const { emojiVisible, triggerSuccess } = useButtonPress();
  const slideIn = useRef(new Animated.Value(40)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideIn, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const toggleFav = () => {
    toggleFollowRestaurant(resto.id);
    if (!isFav) triggerSuccess('❤️');
  };

  return (
    <Animated.View style={[s.card, glowSubtle(Colors.client.primary), { opacity: fadeIn, transform: [{ translateY: slideIn }] }]}>
      <View style={{ position: 'relative' }}>
        <EmojiPop emoji="❤️" visible={emojiVisible} size={28} />
      </View>
      <PressableScale onPress={() => router.push(`/(client)/restaurant/${resto.id}` as any)} style={{ flex: 1 }}>
        <View style={s.cardInner}>
          <View style={s.restoIcon}>
            <Store size={28} color={Colors.client.primary} />
          </View>
          <View style={s.restoInfo}>
            <Text style={s.restoNom}>{resto.nom}</Text>
            <Text style={s.restoCat}>{resto.categorie} · {resto.temps} min</Text>
            <View style={s.metaRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Star size={11} color={Colors.livreur.primary} />
                <Text style={s.note}>{resto.note}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Bike size={11} color={Colors.text.secondary} />
                <Text style={s.livraison}>{resto.frais} FCFA</Text>
              </View>
              <View style={[s.badge, { backgroundColor: resto.isOuvert ? Colors.restaurant.bg : Colors.dangerBg }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: resto.isOuvert ? Colors.restaurant.primary : Colors.danger }}>
                  {resto.isOuvert ? 'Ouvert' : 'Fermé'}
                </Text>
              </View>
            </View>
          </View>
          <PressableScale onPress={toggleFav}>
            {isFav
              ? <Heart size={24} color={Colors.danger} />
              : <HeartOff size={24} color={Colors.text.muted} />
            }
          </PressableScale>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default function FavoritesScreen() {
  const { followedRestaurants } = useAppContext();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={[s.header, { opacity: fadeIn }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Heart size={22} color={Colors.danger} />
            <Text style={s.title}>Mes Favoris</Text>
          </View>
          <Text style={s.subtitle}>{followedRestaurants.length} restaurant(s) sauvegardé(s)</Text>
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          {RESTAURANTS_LISTE.filter(r => followedRestaurants.includes(r.id)).map(resto => (
            <FavCard key={resto.id} resto={resto} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg.app },
  header:     { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  title:      { ...Typography.h2 },
  subtitle:   { ...Typography.small, marginTop: 4 },
  card:       { marginHorizontal: Spacing.md, marginBottom: 14, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border.default, overflow: 'hidden' },
  cardInner:  { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  restoIcon:  { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.restaurant.bg, justifyContent: 'center', alignItems: 'center' },
  restoInfo:  { flex: 1, gap: 4 },
  restoNom:   { ...Typography.bodyBold, fontSize: 16 },
  restoCat:   { ...Typography.small },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  note:       { ...Typography.small, fontWeight: '700', color: Colors.livreur.primary },
  livraison:  { ...Typography.small },
  badge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
});
