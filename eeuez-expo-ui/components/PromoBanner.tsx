// ═══════════════════════════════════════════════════════════
//  PromoBanner : carrousel promo plein écran (accueil)
//  Contenu entièrement piloté par l'admin (Banniere, back-office) :
//  texte, bouton « Commander » (visible seulement si relié à un plat),
//  fond (image/couleur/dégradé) et image de droite.
//  Animation d'entrée rejouée à chaque arrivée sur l'accueil : l'image
//  de droite glisse vers la droite, le texte monte, le bouton descend —
//  le fond et le voile sombre restent statiques.
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Animated, Easing,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Radius, Screen } from '../constants/theme';
import { PressableScale, displayFont, bodyFont } from './ui';
import type { BanniereDTO } from '../services/dto';

const SIDE_PADDING = 20;
const CARD_W = Screen.W - SIDE_PADDING * 2;

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Une carte : fond statique, image de droite + texte + bouton animés à l'entrée. */
function BannerCard({ banniere, active }: { banniere: BanniereDTO; active: boolean }) {
  const router = useRouter();
  const imgAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  const replay = useCallback(() => {
    imgAnim.setValue(0);
    textAnim.setValue(0);
    btnAnim.setValue(0);
    const spring = (anim: Animated.Value, delay: number) => Animated.timing(anim, {
      toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    Animated.parallel([spring(imgAnim, 0), spring(textAnim, 80), spring(btnAnim, 160)]).start();
  }, [imgAnim, textAnim, btnAnim]);

  // Rejoue à chaque fois que cette carte devient la carte active (swipe),
  // et à chaque fois que l'accueil reprend le focus.
  React.useEffect(() => { if (active) replay(); }, [active, replay]);
  useFocusEffect(useCallback(() => { if (active) replay(); }, [active, replay]));

  const texteCouleur = banniere.texte_couleur || '#ffffff';

  return (
    <View style={styles.card}>
      {/* Fond — statique, toujours affiché */}
      {banniere.fond_type === 'couleur' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: banniere.fond_couleur }]} />
      ) : banniere.fond_type === 'degrade' ? (
        <LinearGradient
          colors={[banniere.fond_degrade_debut, banniere.fond_degrade_fin]}
          start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : banniere.fond_image ? (
        <ExpoImage
          source={{ uri: banniere.fond_image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a1a' }]} />
      )}

      {/* Image de droite — animée : glisse vers la droite */}
      {banniere.image_droite && (
        <Animated.View
          style={[
            styles.rightImage,
            {
              opacity: imgAnim,
              transform: [{ translateX: imgAnim.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }],
            },
          ]}
        >
          <ExpoImage
            source={{ uri: banniere.image_droite }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
          />
        </Animated.View>
      )}

      {/* Voile sombre — statique, toujours affiché, garantit la lisibilité du texte */}
      <LinearGradient
        colors={['rgba(8,12,9,0.9)', 'rgba(8,12,9,0)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 0.5, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {banniere.badge ? (
        <View style={styles.badge}>
          <Text style={[bodyFont(10.5, '800'), { color: '#fff', letterSpacing: 0.5 }]}>{banniere.badge}</Text>
        </View>
      ) : null}

      <View style={styles.content}>
        {/* Texte — animé : monte vers le haut */}
        <Animated.View
          style={{
            opacity: textAnim,
            transform: [{ translateY: textAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }}
        >
          <Text style={[displayFont(23, '800'), { color: texteCouleur, lineHeight: 26 }]}>{banniere.titre}</Text>
          {banniere.sous_titre ? (
            <Text style={[bodyFont(12, '600'), { color: hexToRgba(texteCouleur, 0.75), marginTop: 6 }]}>
              {banniere.sous_titre}
            </Text>
          ) : null}
        </Animated.View>

        {/* Bouton « Commander » — animé : descend vers le bas — visible seulement si un plat est relié */}
        {banniere.plat != null && (
          <Animated.View
            style={{
              marginTop: 12,
              opacity: btnAnim,
              transform: [{ translateY: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }],
            }}
          >
            <PressableScale onPress={() => router.push(`/dish/${banniere.plat}`)}>
              <View style={[styles.cta, { backgroundColor: banniere.bouton_fond_couleur }]}>
                <Text style={[bodyFont(13, '800'), { color: banniere.bouton_texte_couleur }]}>Commander</Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

export function PromoBanner({ banners }: { banners: BanniereDTO[] }) {
  const [active, setActive] = useState(0);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
    setActive(Math.max(0, Math.min(banners.length - 1, idx)));
  };

  if (banners.length === 0) return null;

  return (
    <View style={{ marginTop: 22 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
      >
        {banners.map((b, i) => <BannerCard key={b.id} banniere={b} active={i === active} />)}
      </ScrollView>

      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W, height: 200, borderRadius: Radius.xl, overflow: 'hidden',
  },
  rightImage: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '48%' },
  content: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18,
    maxWidth: '62%', justifyContent: 'flex-end',
  },
  badge: {
    position: 'absolute', top: 16, left: 18,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
  },
  cta: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(120,120,120,0.35)' },
  dotActive: { width: 18, backgroundColor: '#f26a1b' },
});
