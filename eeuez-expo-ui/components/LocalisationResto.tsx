// ═══════════════════════════════════════════════════════════
//  Section « Localisation » de la fiche restaurant
//  Mini-carte OpenStreetMap + ouverture de l'itinéraire dans
//  l'application de navigation du téléphone.
// ═══════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, Linking, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { MapPin, Navigation } from 'lucide-react-native';

import { LEAFLET_HEAD, tileLayerJs } from '../lib/leaflet';
import { Brand, Radius } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { PressableScale, displayFont, bodyFont } from './ui';

interface Props {
  nom: string;
  latitude: number | null;
  longitude: number | null;
  adresse?: string | null;
}

/** Ouvre l'itinéraire dans l'app de cartes native, avec repli navigateur. */
async function ouvrirItineraire(lat: number, lon: number, nom: string) {
  // Schémas natifs : Plans sur iOS, geo: sur Android. Ils ouvrent
  // directement l'app installée, ce qu'une URL web ne garantit pas.
  const etiquette = encodeURIComponent(nom);
  const natif = Platform.select({
    ios: `maps://?daddr=${lat},${lon}&q=${etiquette}`,
    android: `geo:${lat},${lon}?q=${lat},${lon}(${etiquette})`,
    default: '',
  });
  const web = `https://www.openstreetmap.org/directions?to=${lat}%2C${lon}`;

  try {
    if (natif && (await Linking.canOpenURL(natif))) {
      await Linking.openURL(natif);
      return;
    }
    await Linking.openURL(web);
  } catch {
    Alert.alert(
      'Itinéraire indisponible',
      "Aucune application de navigation n'a pu être ouverte sur cet appareil.",
    );
  }
}

export function LocalisationResto({ nom, latitude, longitude, adresse }: Props) {
  const { colors, mode } = useApp();
  const dark = mode === 'dark';

  // Le HTML ne dépend que des coordonnées et du thème : on évite de
  // reconstruire la WebView à chaque rendu du parent.
  const html = useMemo(() => {
    if (latitude == null || longitude == null) return '';
    return `<!DOCTYPE html><html><head>${LEAFLET_HEAD}
      <style>html,body,#map{margin:0;height:100%;background:transparent;}</style>
      </head><body><div id="map"></div><script>
        // Carte volontairement inerte : elle situe le restaurant d'un coup
        // d'œil. Le geste de défilement doit rester à la page, sinon la
        // carte « capture » le doigt et bloque le scroll de la fiche.
        var map = L.map('map', {
          zoomControl:false, attributionControl:false,
          dragging:false, scrollWheelZoom:false, doubleClickZoom:false,
          touchZoom:false, keyboard:false, tap:false,
        }).setView([${latitude}, ${longitude}], 16);
        ${tileLayerJs(dark)}
        L.marker([${latitude}, ${longitude}], {
          icon: L.divIcon({
            className:'', iconSize:[34,34], iconAnchor:[17,34],
            html:'<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;'
               + 'transform:rotate(-45deg);background:linear-gradient(135deg,${Brand.accentTop},${Brand.accentBot});'
               + 'border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.4);"></div>',
          }),
        }).addTo(map);
      </script></body></html>`;
  }, [latitude, longitude, dark]);

  // Sans coordonnées, une carte vide n'apprend rien : on n'affiche
  // simplement pas la section.
  if (latitude == null || longitude == null) return null;

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={[displayFont(17, '700'), { color: colors.text }]}>Localisation</Text>

      {!!adresse && (
        <View style={styles.adresseLigne}>
          <MapPin size={15} color={colors.muted} strokeWidth={2.2} />
          <Text style={[bodyFont(13, '500'), { color: colors.muted, flex: 1 }]}>{adresse}</Text>
        </View>
      )}

      <View style={[styles.carteWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <WebView
          source={{ html }}
          style={styles.carte}
          scrollEnabled={false}
          originWhitelist={['*']}
          javaScriptEnabled
          // La carte est décorative : elle ne doit pas intercepter le
          // défilement vertical de la fiche restaurant.
          pointerEvents="none"
        />
      </View>

      <PressableScale
        onPress={() => ouvrirItineraire(latitude, longitude, nom)}
        style={{ marginTop: 10 }}
      >
        <View style={[styles.bouton, { borderColor: Brand.accent + '55', backgroundColor: Brand.accent + '14' }]}>
          <Navigation size={17} color={Brand.accentLight} strokeWidth={2.3} />
          <Text style={[bodyFont(13.5, '800'), { color: Brand.accentLight }]}>
            Itinéraire vers le restaurant
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  adresseLigne: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  carteWrap: {
    marginTop: 12, height: 170, borderRadius: Radius.lg,
    overflow: 'hidden', borderWidth: 1,
  },
  carte: { flex: 1, backgroundColor: 'transparent' },
  bouton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: Radius.pill, borderWidth: 1,
  },
});
