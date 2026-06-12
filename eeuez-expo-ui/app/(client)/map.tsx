import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Animated, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow } from '../../constants/theme';
import { PressableScale } from '../../components/Animations';

const QUARTIERS = [
  { id: 'b1', nom: 'Bastos', emoji: '🏢', distance: '1.2 km', restos: 8 },
  { id: 'b2', nom: 'Centre Ville', emoji: '🏙️', distance: '2.0 km', restos: 14 },
  { id: 'b3', nom: 'Nlongkak', emoji: '🌳', distance: '0.8 km', restos: 5 },
  { id: 'b4', nom: 'Mimboman', emoji: '🏘️', distance: '3.5 km', restos: 6 },
  { id: 'b5', nom: 'Omnisport', emoji: '🏟️', distance: '1.7 km', restos: 10 },
];

export default function MapScreen() {
  const router = useRouter();
  const [selectedZone, setSelectedZone] = useState('');
  const [query, setQuery] = useState('');
  const fadeIn = useRef(new Animated.Value(0)).current;
  const mapScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(mapScale, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
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
          <View style={s.searchBar}>
            <Text style={{ fontSize: 16 }}>🗺️</Text>
            <TextInput
              placeholder="Chercher un quartier, une rue…"
              placeholderTextColor={Colors.text.muted}
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
            />
          </View>
        </Animated.View>

        {/* Carte simulée */}
        <Animated.View style={[s.mapBox, { transform: [{ scale: mapScale }] }]}>
          <Text style={s.mapTitle}>📍 Yaoundé, Cameroun</Text>
          <Text style={s.mapSubtitle}>Sélectionnez une zone de livraison</Text>
          {/* Grille des zones */}
          <View style={s.zonesGrid}>
            {QUARTIERS.map(q => (
              <PressableScale key={q.id} onPress={() => setSelectedZone(q.id === selectedZone ? '' : q.id)}>
                <View style={[s.zonePin, selectedZone === q.id && { backgroundColor: Colors.client.bg, borderColor: Colors.client.primary }]}>
                  <Text style={{ fontSize: 20 }}>{q.emoji}</Text>
                </View>
              </PressableScale>
            ))}
          </View>
        </Animated.View>

        {/* Liste des zones */}
        <View style={s.listSection}>
          <Text style={s.sectionTitle}>📍 Zones de livraison disponibles</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 12 }}>
            {QUARTIERS.map(q => (
              <PressableScale key={q.id} onPress={() => setSelectedZone(q.id === selectedZone ? '' : q.id)}>
                <View style={[s.zoneChip, selectedZone === q.id && { backgroundColor: Colors.client.bg, borderColor: Colors.client.primary }]}>
                  <Text style={{ fontSize: 22 }}>{q.emoji}</Text>
                  <View>
                    <Text style={[s.zoneName, selectedZone === q.id && { color: Colors.client.primary }]}>{q.nom}</Text>
                    <Text style={s.zoneMeta}>{q.distance} · {q.restos} restos</Text>
                  </View>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </View>

        {/* CTA Commander */}
        {selectedZone && (
          <Animated.View style={[s.ctaSection, { opacity: fadeIn }]}>
            <View style={s.selectedInfo}>
              <Text style={s.selectedLabel}>Zone sélectionnée</Text>
              <Text style={s.selectedNom}>
                {QUARTIERS.find(q => q.id === selectedZone)?.emoji} {QUARTIERS.find(q => q.id === selectedZone)?.nom}
              </Text>
            </View>
            <PressableScale onPress={() => router.push('/(client)' as any)}>
              <View style={[s.confirmBtn, glow(Colors.client.glow, 12)]}>
                <Text style={s.confirmText}>✓ Confirmer cette adresse</Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: Colors.bg.app },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 12 },
  backBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.glass.bg, justifyContent: 'center', alignItems: 'center' },
  backArrow:     { fontSize: 22, color: Colors.text.primary },
  searchBar:     { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border.default, gap: 8 },
  searchInput:   { flex: 1, fontSize: 15, color: Colors.text.primary },
  mapBox:        { margin: Spacing.md, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border.default, minHeight: 200, alignItems: 'center', gap: 12 },
  mapTitle:      { ...Typography.h3 },
  mapSubtitle:   { ...Typography.small },
  zonesGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginTop: 8 },
  zonePin:       { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.bg.elevated, borderWidth: 1, borderColor: Colors.border.default, justifyContent: 'center', alignItems: 'center' },
  listSection:   { marginBottom: 12 },
  sectionTitle:  { ...Typography.h3, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  zoneChip:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border.default, minWidth: 160 },
  zoneName:      { ...Typography.bodyBold, fontSize: 14 },
  zoneMeta:      { ...Typography.small, marginTop: 2 },
  ctaSection:    { padding: Spacing.md, gap: 12 },
  selectedInfo:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectedLabel: { ...Typography.small },
  selectedNom:   { ...Typography.bodyBold, color: Colors.client.primary },
  confirmBtn:    { backgroundColor: Colors.client.primary, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  confirmText:   { color: Colors.bg.app, fontWeight: '900', fontSize: 16 },
});
