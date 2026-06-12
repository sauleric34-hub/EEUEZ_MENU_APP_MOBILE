import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow } from '../constants/theme';
import { PressableScale } from '../components/Animations';
import { RESTAURANTS_LISTE } from '../data/mockData';

const ZONES = [
  { id: 'z1', nom: 'Bastos',      coords: { x: 70, y: 40  }, restos: 8  },
  { id: 'z2', nom: 'Centre',      coords: { x: 50, y: 55  }, restos: 14 },
  { id: 'z3', nom: 'Nlongkak',    coords: { x: 30, y: 35  }, restos: 5  },
  { id: 'z4', nom: 'Mimboman',    coords: { x: 80, y: 70  }, restos: 6  },
  { id: 'z5', nom: 'Omnisport',   coords: { x: 55, y: 25  }, restos: 10 },
];

export default function CarteScreen() {
  const router = useRouter();
  const [selectedZone, setSelectedZone] = useState('');
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const zone = ZONES.find(z => z.id === selectedZone);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={[s.header, { opacity: fadeIn }]}>
          <PressableScale onPress={() => router.back()}>
            <View style={s.backBtn}><Text style={s.backArrow}>←</Text></View>
          </PressableScale>
          <Text style={s.title}>🗺️ Carte des restaurants</Text>
          <View style={{ width: 44 }} />
        </Animated.View>

        {/* Carte simulée */}
        <Animated.View style={[s.mapContainer, { opacity: fadeIn }]}>
          <View style={s.mapBg}>
            <Text style={s.mapCity}>📍 Yaoundé, Cameroun</Text>
            <Text style={s.mapSub}>Touchez une zone pour voir les restaurants</Text>
            {/* Points sur la carte */}
            {ZONES.map(zone => (
              <PressableScale key={zone.id} onPress={() => setSelectedZone(zone.id === selectedZone ? '' : zone.id)}>
                <View style={[
                  s.mapPin,
                  selectedZone === zone.id && { backgroundColor: Colors.client.primary, ...glow(Colors.client.glow, 10) }
                ]}>
                  <Text style={{ fontSize: 14 }}>🏪</Text>
                  <Text style={[s.pinLabel, selectedZone === zone.id && { color: Colors.client.primary }]}>{zone.nom}</Text>
                </View>
              </PressableScale>
            ))}
          </View>
        </Animated.View>

        {/* Info zone sélectionnée */}
        {zone && (
          <Animated.View style={[s.zoneCard, { opacity: fadeIn }]}>
            <Text style={s.zoneNom}>📍 {zone.nom}</Text>
            <Text style={s.zoneMeta}>{zone.restos} restaurants disponibles</Text>
            <PressableScale onPress={() => router.push('/(client)' as any)}>
              <View style={[s.zoneBtn, glow(Colors.client.glow, 10)]}>
                <Text style={s.zoneBtnText}>Voir les restaurants →</Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}

        {/* Liste des zones */}
        <View style={s.listSection}>
          <Text style={s.sectionTitle}>Zones disponibles</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 10 }}>
            {ZONES.map(z => (
              <PressableScale key={z.id} onPress={() => setSelectedZone(z.id === selectedZone ? '' : z.id)}>
                <View style={[s.zoneChip, selectedZone === z.id && { backgroundColor: Colors.client.bg, borderColor: Colors.client.primary }]}>
                  <Text style={[s.zoneChipNom, selectedZone === z.id && { color: Colors.client.primary }]}>{z.nom}</Text>
                  <Text style={s.zoneChipCount}>{z.restos} restos</Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg.app },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  backBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.glass.bg, justifyContent: 'center', alignItems: 'center' },
  backArrow:    { fontSize: 22, color: Colors.text.primary },
  title:        { ...Typography.h3, fontSize: 17 },
  mapContainer: { marginHorizontal: Spacing.md, marginBottom: Spacing.md },
  mapBg:        { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border.default, minHeight: 220, alignItems: 'center', gap: 12 },
  mapCity:      { ...Typography.h3 },
  mapSub:       { ...Typography.small, textAlign: 'center' },
  mapPin:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.bg.elevated, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, margin: 4, borderWidth: 1, borderColor: Colors.border.default },
  pinLabel:     { ...Typography.small, fontWeight: '700' },
  zoneCard:     { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.client.primary + '44', gap: 8 },
  zoneNom:      { ...Typography.h3 },
  zoneMeta:     { ...Typography.small },
  zoneBtn:      { backgroundColor: Colors.client.primary, borderRadius: Radius.lg, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  zoneBtnText:  { color: Colors.bg.app, fontWeight: '800' },
  listSection:  { gap: 8 },
  sectionTitle: { ...Typography.h3, paddingHorizontal: Spacing.md },
  zoneChip:     { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border.default, minWidth: 130, gap: 4 },
  zoneChipNom:  { ...Typography.bodyBold, fontSize: 14 },
  zoneChipCount:{ ...Typography.small },
});
