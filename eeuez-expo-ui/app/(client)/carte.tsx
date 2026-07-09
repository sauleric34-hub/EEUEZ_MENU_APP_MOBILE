// ═══════════════════════════════════════════════════════════
//  Carte — vraie carte interactive (react-native-maps)
//  Restaurants géolocalisés, classés par le moteur de suggestion.
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { MapPin, Sun, Moon, Star, Bike, Timer, Store, LocateFixed } from 'lucide-react-native';
import { Brand, Radius, glow } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { formatPrice, formatKm, type Resto } from '../../data/menuData';
import { DishTile, PressableScale, IconButton, displayFont, bodyFont } from '../../components/ui';

// Centre par défaut : Douala (Akwa)
const DEFAULT_CENTER = { latitude: 4.05, longitude: 9.70 };
const CITY_DELTA = { latitudeDelta: 0.18, longitudeDelta: 0.18 };

// Style sombre « nuit africaine » pour Google Maps (ignoré sur Apple Maps)
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0e1712' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7d8a80' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b100d' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c2a20' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6c7a6f' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#27392c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1420' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#101b14' }] },
];

export default function CarteScreen() {
  const { colors, mode, toggleTheme, restaurants, recoRestos, dishesOfResto, dishById, userLoc } = useApp();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [selId, setSelId] = useState<number | null>(null);

  // Distances/ETA calculées par le moteur de recommandation
  const recoById = useMemo(
    () => new Map(recoRestos.map(r => [r.id, r])),
    [recoRestos],
  );
  // Restos affichables (coordonnées présentes)
  const located = useMemo(
    () => restaurants.filter(r => r.latitude != null && r.longitude != null),
    [restaurants],
  );

  const initialRegion: Region = {
    latitude: userLoc?.lat ?? DEFAULT_CENTER.latitude,
    longitude: userLoc?.lon ?? DEFAULT_CENTER.longitude,
    ...CITY_DELTA,
  };

  const sel = selId != null ? located.find(r => r.id === selId) ?? null : null;
  const selReco = sel ? recoById.get(sel.id) : undefined;
  // Plat du jour réel du restaurant (défini dans le workspace), sinon 1er plat
  const selDish = sel
    ? ((sel.platDuJourId ? dishById(sel.platDuJourId) : undefined) ?? dishesOfResto(sel.id)[0] ?? null)
    : null;
  const selDistance = selReco?.distanceKm ?? sel?.distanceKm ?? null;
  const selEta = selReco?.etaMin ?? (sel ? sel.tempsLivraison : null);

  const selectResto = (r: Resto) => {
    setSelId(r.id);
    if (r.latitude != null && r.longitude != null) {
      mapRef.current?.animateToRegion(
        { latitude: r.latitude, longitude: r.longitude, latitudeDelta: 0.045, longitudeDelta: 0.045 },
        450,
      );
    }
  };

  const recenter = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: userLoc?.lat ?? DEFAULT_CENTER.latitude,
        longitude: userLoc?.lon ?? DEFAULT_CENTER.longitude,
        ...CITY_DELTA,
      },
      450,
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={mode === 'dark' ? DARK_MAP_STYLE : []}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onPress={() => setSelId(null)}
      >
        {located.map(r => {
          const active = selId === r.id;
          return (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.latitude as number, longitude: r.longitude as number }}
              onPress={(e) => { e.stopPropagation(); selectResto(r); }}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={active ? 15 : 5}
            >
              <View style={styles.pinWrap}>
                <View style={[styles.pinBadge, { borderColor: active ? Brand.yellow : 'rgba(255,255,255,0.85)' }]}>
                  <Star size={8} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
                  <Text style={styles.pinBadgeTxt}>{r.rating}</Text>
                </View>
                <LinearGradient
                  colors={r.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[styles.pin, { borderColor: active ? Brand.yellow : 'rgba(255,255,255,0.85)' }]}
                >
                  <View style={{ transform: [{ rotate: '-45deg' }] }}>
                    <r.icon size={19} color="#fff" strokeWidth={2.2} />
                  </View>
                </LinearGradient>
                <View style={styles.pinTip} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Header overlay */}
      <SafeAreaView edges={['top']} pointerEvents="box-none">
        <View style={styles.header}>
          <View style={[styles.locPill, { backgroundColor: colors.nav, borderColor: colors.border }]}>
            <MapPin size={16} color={Brand.accentLight} strokeWidth={2.3} />
            <Text style={[bodyFont(13.5, '700'), { color: colors.text }]}>
              {userLoc ? 'Autour de vous' : 'Douala (position inconnue)'}
            </Text>
          </View>
          <IconButton Icon={LocateFixed} onPress={recenter} colors={colors} size={48} color={Brand.accentLight} />
          <IconButton Icon={mode === 'dark' ? Sun : Moon} onPress={toggleTheme} colors={colors} size={48} />
        </View>
      </SafeAreaView>

      {/* Fiche restaurant sélectionné */}
      {sel && (
        <View style={[styles.card, { backgroundColor: colors.nav, borderColor: colors.border }, glow(colors.shadow, 40)]}>
          <View style={styles.cardHead}>
            <DishTile Icon={sel.icon} grad={sel.grad} image={sel.image} size={88} iconSize={40} radius={18} />
            <View style={{ flex: 1 }}>
              <View style={styles.row}>
                <Text style={[displayFont(17, '800'), { color: colors.text, flex: 1 }]}>{sel.name}</Text>
                <View style={styles.row}>
                  <Star size={12} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
                  <Text style={[bodyFont(11.5, '800'), { color: Brand.yellow, marginLeft: 3 }]}>{sel.rating}</Text>
                </View>
              </View>
              <Text numberOfLines={2} style={[bodyFont(11.5, '500'), { color: colors.muted, marginTop: 3 }]}>{sel.cuisine} · {sel.bio}</Text>
              <View style={[styles.row, { gap: 14, marginTop: 9 }]}>
                <View style={styles.row}>
                  <Bike size={13} color="#8fd6a8" strokeWidth={2.3} />
                  <Text style={[bodyFont(11.5, '700'), { color: '#8fd6a8', marginLeft: 4 }]}>{formatKm(selDistance)}</Text>
                </View>
                {selEta != null && (
                  <View style={styles.row}>
                    <Timer size={13} color={Brand.accentLight} strokeWidth={2.3} />
                    <Text style={[bodyFont(11.5, '700'), { color: Brand.accentLight, marginLeft: 4 }]}>{selEta} min</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Plat du jour */}
          {selDish && (
            <View style={[styles.dishJour, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <DishTile Icon={selDish.icon} grad={selDish.grad} image={selDish.image} size={52} iconSize={24} radius={14} />
              <View style={{ flex: 1 }}>
                <Text style={[bodyFont(10, '800'), { color: Brand.yellow, letterSpacing: 0.8 }]}>PLAT DU JOUR</Text>
                <Text numberOfLines={1} style={[displayFont(14.5, '700'), { color: colors.text, marginTop: 2 }]}>{selDish.name}</Text>
              </View>
              <Text style={[displayFont(15, '800'), { color: Brand.accentLight }]}>{formatPrice(selDish.price)}</Text>
            </View>
          )}

          <View style={styles.cardActions}>
            {selDish && (
              <PressableScale onPress={() => router.push(`/dish/${selDish.id}`)} style={{ flex: 1 }}>
                <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.seeDish}>
                  <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>Voir le plat</Text>
                </LinearGradient>
              </PressableScale>
            )}
            <PressableScale onPress={() => router.push(`/resto/${sel.id}`)} style={selDish ? undefined : { flex: 1 }}>
              <View style={[styles.restoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Store size={20} color={colors.text} strokeWidth={2.2} />
              </View>
            </PressableScale>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  pinWrap: { alignItems: 'center', paddingTop: 12 },
  pin: {
    width: 46, height: 46, borderRadius: 23, borderBottomLeftRadius: 4, borderWidth: 2.5,
    transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center',
  },
  pinTip: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.35)', marginTop: 3 },
  pinBadge: {
    position: 'absolute', top: 0, right: -12, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.pill,
    backgroundColor: '#0b100d', borderWidth: 1.5,
  },
  pinBadgeTxt: { color: Brand.yellow, fontSize: 9, fontWeight: '800' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 8,
  },
  locPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13, borderRadius: Radius.pill, borderWidth: 1,
  },
  card: {
    position: 'absolute', left: 14, right: 14, bottom: 100, zIndex: 25,
    borderRadius: 26, borderWidth: 1, overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', gap: 14, padding: 14 },
  dishJour: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 14, padding: 12, borderRadius: 18, borderWidth: 1,
  },
  cardActions: { flexDirection: 'row', gap: 10, padding: 14 },
  seeDish: { paddingVertical: 14, borderRadius: Radius.pill, alignItems: 'center' },
  restoBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
