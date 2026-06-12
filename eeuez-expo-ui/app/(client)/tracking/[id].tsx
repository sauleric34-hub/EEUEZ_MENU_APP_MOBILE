import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow } from '../../../constants/theme';
import { PressableScale, PulseRing } from '../../../components/Animations';

const ETAPES = [
  { key: 'acceptee',        label: 'Commande acceptée',     emoji: '✅', done: true },
  { key: 'en_preparation',  label: 'En préparation',        emoji: '👨‍🍳', done: true },
  { key: 'livreur_assigne', label: 'Livreur en route',      emoji: '🛵', done: false, active: true },
  { key: 'en_livraison',    label: 'En chemin chez vous',   emoji: '📍', done: false },
  { key: 'livree',          label: 'Livraison terminée',    emoji: '🎉', done: false },
];

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [eta, setEta] = useState(12);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    const timer = setInterval(() => setEta(e => Math.max(0, e - 1)), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <Animated.View style={[s.header, { opacity: fadeIn }]}>
          <PressableScale onPress={() => router.back()}>
            <View style={s.backBtn}><Text style={s.backArrow}>←</Text></View>
          </PressableScale>
          <Text style={s.title}>📍 Suivi commande</Text>
          <View style={{ width: 44 }} />
        </Animated.View>

        {/* ETA Hero */}
        <Animated.View style={[s.etaHero, { opacity: fadeIn }]}>
          <PulseRing color={Colors.client.primary} size={90}>
            <Animated.View style={[s.etaCircle, { transform: [{ scale: pulseAnim }], ...glow(Colors.client.glow, 20) }]}>
              <Text style={s.etaEmoji}>🛵</Text>
            </Animated.View>
          </PulseRing>
          <Text style={s.etaLabel}>Arrivée estimée</Text>
          <Text style={s.etaTime}>{eta} min</Text>
          <Text style={s.etaSub}>Commande #{id?.toString().slice(0, 6)}</Text>
        </Animated.View>

        {/* Étapes */}
        <Animated.View style={[s.etapesBox, { opacity: fadeIn }]}>
          <Text style={s.etapesTitle}>Progression</Text>
          {ETAPES.map((etape, i) => (
            <View key={etape.key} style={s.etapeRow}>
              <View style={[
                s.etapeDot,
                etape.done && { backgroundColor: Colors.client.primary },
                etape.active && { backgroundColor: Colors.livreur.primary, ...glow(Colors.livreur.glow, 8) },
              ]}>
                <Text style={{ fontSize: etape.active ? 16 : 14 }}>{etape.emoji}</Text>
              </View>
              {i < ETAPES.length - 1 && (
                <View style={[s.etapeLine, etape.done && { backgroundColor: Colors.client.primary }]} />
              )}
              <Text style={[
                s.etapeLabel,
                etape.done && { color: Colors.client.primary },
                etape.active && { color: Colors.livreur.primary, fontWeight: '700' },
              ]}>
                {etape.label}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* Infos livreur */}
        <Animated.View style={[s.livreurCard, { opacity: fadeIn }]}>
          <View style={s.livreurIcon}>
            <Text style={{ fontSize: 28 }}>🛵</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.livreurNom}>Koffi Mensah</Text>
            <Text style={s.livreurInfo}>Yamaha · YD-5678-A · ⭐ 4.9</Text>
          </View>
          <PressableScale onPress={() => {}}>
            <View style={[s.callBtn, glow(Colors.client.glow, 8)]}>
              <Text style={s.callBtnText}>📞 Appeler</Text>
            </View>
          </PressableScale>
        </Animated.View>

      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg.app },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  backBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.glass.bg, justifyContent: 'center', alignItems: 'center' },
  backArrow:    { fontSize: 22, color: Colors.text.primary },
  title:        { ...Typography.h3, fontSize: 18 },
  etaHero:      { alignItems: 'center', paddingVertical: Spacing.xl, gap: 10 },
  etaCircle:    { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.client.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.client.primary },
  etaEmoji:     { fontSize: 40 },
  etaLabel:     { ...Typography.small },
  etaTime:      { fontSize: 52, fontWeight: '900', color: Colors.client.primary, letterSpacing: -2 },
  etaSub:       { ...Typography.small },
  etapesBox:    { marginHorizontal: Spacing.md, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border.default, gap: 0 },
  etapesTitle:  { ...Typography.h3, marginBottom: Spacing.md },
  etapeRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6, position: 'relative' },
  etapeDot:     { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  etapeLine:    { position: 'absolute', left: 21, top: 44, width: 2, height: 10, backgroundColor: Colors.border.default },
  etapeLabel:   { ...Typography.body, color: Colors.text.secondary, flex: 1 },
  livreurCard:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, marginTop: Spacing.lg, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border.default, gap: 14 },
  livreurIcon:  { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.livreur.bg, justifyContent: 'center', alignItems: 'center' },
  livreurNom:   { ...Typography.bodyBold },
  livreurInfo:  { ...Typography.small, marginTop: 2 },
  callBtn:      { backgroundColor: Colors.client.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.lg },
  callBtnText:  { color: Colors.bg.app, fontWeight: '800', fontSize: 13 },
});
