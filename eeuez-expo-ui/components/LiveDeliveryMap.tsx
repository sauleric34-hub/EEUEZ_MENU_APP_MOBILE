// ═══════════════════════════════════════════════════════════
//  Carte de suivi en direct (client)
//  Affiche la position du livreur, le lieu de livraison et
//  l'itinéraire routier entre les deux (OSRM, repli ligne droite).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, type LatLng } from 'react-native-maps';
import { Bike, MapPin } from 'lucide-react-native';
import { Brand } from '../constants/theme';
import type { GeoPointDTO } from '../services/dto';
import { bodyFont } from './ui';

interface Props {
  driver: GeoPointDTO | null;
  destination: GeoPointDTO | null;
  dark: boolean;
}

const toLatLng = (p: GeoPointDTO): LatLng => ({ latitude: p.lat, longitude: p.lon });

const DARK_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#0f1a13' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa0a6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a120d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1d2b22' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1520' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

/** Récupère un itinéraire routier via OSRM ; repli : segment direct. */
async function fetchRoute(from: GeoPointDTO, to: GeoPointDTO): Promise<LatLng[]> {
  const straight = [toLatLng(from), toLatLng(to)];
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length) {
      return coords.map((c: [number, number]) => ({ latitude: c[1], longitude: c[0] }));
    }
  } catch {
    // réseau/OSRM indisponible → ligne droite
  }
  return straight;
}

export function LiveDeliveryMap({ driver, destination, dark }: Props) {
  const mapRef = useRef<MapView>(null);
  const [route, setRoute] = useState<LatLng[]>([]);

  // (Re)calcule l'itinéraire quand la position du livreur ou la destination change.
  useEffect(() => {
    let alive = true;
    if (driver && destination) {
      fetchRoute(driver, destination).then(r => { if (alive) setRoute(r); });
    } else {
      setRoute([]);
    }
    return () => { alive = false; };
  }, [driver?.lat, driver?.lon, destination?.lat, destination?.lon]);

  const initialRegion = useMemo(() => {
    const c = driver ?? destination;
    if (!c) return undefined;
    return { latitude: c.lat, longitude: c.lon, latitudeDelta: 0.03, longitudeDelta: 0.03 };
  }, [driver?.lat, driver?.lon, destination?.lat, destination?.lon]);

  // Recadre la carte pour montrer le livreur, la destination et le trajet.
  useEffect(() => {
    const pts: LatLng[] = [];
    if (driver) pts.push(toLatLng(driver));
    if (destination) pts.push(toLatLng(destination));
    route.forEach(p => pts.push(p));
    if (pts.length >= 2 && mapRef.current) {
      mapRef.current.fitToCoordinates(pts, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [route, driver?.lat, driver?.lon, destination?.lat, destination?.lon]);

  if (!initialRegion) {
    return (
      <View style={[styles.fallback, { backgroundColor: dark ? '#0f1a13' : '#e9efe9' }]}>
        <Text style={[bodyFont(12.5, '600'), { color: '#8a938c' }]}>
          Position du livreur bientôt disponible…
        </Text>
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      customMapStyle={dark ? DARK_MAP : []}
      initialRegion={initialRegion}
      pitchEnabled={false}
      rotateEnabled={false}
      toolbarEnabled={false}
    >
      {route.length >= 2 && (
        <Polyline coordinates={route} strokeColor={Brand.accent} strokeWidth={4} />
      )}
      {destination && (
        <Marker coordinate={toLatLng(destination)} anchor={{ x: 0.5, y: 1 }} title="Lieu de livraison">
          <MapPin size={30} color={Brand.accent} fill={Brand.accent} strokeWidth={1.5} />
        </Marker>
      )}
      {driver && (
        <Marker coordinate={toLatLng(driver)} anchor={{ x: 0.5, y: 0.5 }} title="Livreur">
          <View style={styles.driverBadge}>
            <Bike size={18} color="#fff" strokeWidth={2.3} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  driverBadge: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Brand.green,
    borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
});
