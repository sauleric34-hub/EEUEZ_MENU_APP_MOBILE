// ═══════════════════════════════════════════════════════════
//  Sélecteur de lieu de livraison — GPS précis
//  Carte (pin central), position actuelle, recherche de lieu,
//  et enregistrement pour les prochaines livraisons.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, ActivityIndicator,
  Keyboard, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  ChevronLeft, LocateFixed, Search, MapPin, Check, Star, X, Home,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { searchPlaces, reverseGeocode, type PlaceResult } from '../services/addresses';
import { PressableScale, bodyFont } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { LeafletPickerMap, type LeafletPickerHandle } from '../components/LeafletPickerMap';

const DEFAULT = { latitude: 4.0611, longitude: 9.7089 }; // Douala

export default function LocationPicker() {
  const { colors, mode, userLoc, addresses, addAddress, setDeliveryAddress, makeDefaultAddress, removeAddress } = useApp();
  const toast = useToast();
  const router = useRouter();
  const mapRef = useRef<LeafletPickerHandle>(null);

  const [center, setCenter] = useState(userLoc ? { latitude: userLoc.lat, longitude: userLoc.lon } : DEFAULT);
  const [address, setAddress] = useState('');
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [label, setLabel] = useState('');
  const [details, setDetails] = useState('');
  const [saveIt, setSaveIt] = useState(true);
  const [busy, setBusy] = useState(false);
  const revTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Évite un toast à chaque tick de debounce quand le géocodage est en
  // panne (ex : hors-ligne pendant qu'on glisse la carte) — un seul
  // avertissement tant que l'échec persiste.
  const geocodeFailNotified = useRef(false);
  const searchFailNotified = useRef(false);
  // Petit rebond du pin (pattern « drop pin ») à chaque fois que la carte
  // s'arrête de bouger : il repart d'une position légèrement soulevée et
  // retombe avec un léger dépassement avant de se stabiliser.
  const pinDrop = useRef(new Animated.Value(0)).current;
  const bouncePin = () => {
    pinDrop.setValue(-10);
    Animated.spring(pinDrop, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 12 }).start();
  };

  // Reverse-geocode le centre de la carte (debounce)
  const resolveCenter = (lat: number, lon: number) => {
    setResolving(true);
    if (revTimer.current) clearTimeout(revTimer.current);
    revTimer.current = setTimeout(async () => {
      try {
        const txt = await reverseGeocode(lat, lon);
        geocodeFailNotified.current = false;
        setAddress(txt || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      } catch {
        setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        if (!geocodeFailNotified.current) {
          geocodeFailNotified.current = true;
          toast.error("Adresse introuvable pour ce point (connexion instable ?).");
        }
      } finally {
        setResolving(false);
      }
    }, 500);
  };

  useEffect(() => {
    resolveCenter(center.latitude, center.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La carte Leaflet remonte son centre uniquement une fois le geste terminé
  // (événement Leaflet `moveend`) : c'est donc le point exact où faire
  // rebondir le pin.
  const onCenterChange = (lat: number, lng: number) => {
    setCenter({ latitude: lat, longitude: lng });
    resolveCenter(lat, lng);
    bouncePin();
  };

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Autorisez la localisation pour utiliser votre position actuelle.');
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      // moveTo → la carte émettra onCenterChange (met à jour le centre + l'adresse).
      mapRef.current?.moveTo(pos.coords.latitude, pos.coords.longitude);
    } catch {
      toast.error("Impossible d'obtenir votre position actuelle. Vérifiez que le GPS est activé.");
    }
  };

  // Recherche de lieu (Nominatim), debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearch = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const found = await searchPlaces(text);
        searchFailNotified.current = false;
        setResults(found);
      } catch {
        setResults([]);
        if (!searchFailNotified.current) {
          searchFailNotified.current = true;
          toast.error('La recherche de lieu a échoué. Vérifiez votre connexion.');
        }
      } finally {
        setSearching(false);
      }
    }, 450);
  };

  const pickResult = (p: PlaceResult) => {
    Keyboard.dismiss();
    setResults([]);
    setQuery('');
    mapRef.current?.moveTo(p.latitude, p.longitude);
    setCenter({ latitude: p.latitude, longitude: p.longitude });
    setAddress(p.label);
  };

  const pickSaved = (id: number) => {
    const a = addresses.find(x => x.id === id);
    if (!a) return;
    setDeliveryAddress({
      adresse: a.adresse, details: a.details, latitude: Number(a.latitude), longitude: Number(a.longitude),
      label: a.label, savedId: a.id,
    });
    router.back();
  };

  const confirm = async () => {
    if (busy) return;
    // Coordonnées arrondies (le backend n'accepte que 6 décimales)
    const lat = Number(center.latitude.toFixed(6));
    const lon = Number(center.longitude.toFixed(6));
    const adresseText = address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    // Cible locale : ce qui sera livré, que l'enregistrement réussisse ou non
    const target = {
      adresse: adresseText, details: details.trim(), latitude: lat, longitude: lon,
      label: label.trim() || undefined,
    };
    setBusy(true);
    try {
      if (saveIt) {
        try {
          const saved = await addAddress({
            label: label.trim(), adresse: adresseText, details: details.trim(),
            latitude: lat, longitude: lon,
          });
          setDeliveryAddress({
            adresse: saved.adresse, details: saved.details,
            latitude: Number(saved.latitude), longitude: Number(saved.longitude),
            label: saved.label, savedId: saved.id,
          });
        } catch {
          // Enregistrement pour plus tard échoué → on livre quand même à ce lieu cette fois-ci
          setDeliveryAddress(target);
          toast.error("Le lieu n'a pas pu être enregistré, mais la livraison est bien prise en compte.");
        }
      } else {
        setDeliveryAddress(target);
      }
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {/* ─── Région carte : occupe TOUT l'espace au-dessus du panneau ─── */}
      <View style={styles.mapRegion}>
        <LeafletPickerMap
          ref={mapRef}
          initialLat={center.latitude}
          initialLng={center.longitude}
          dark={mode === 'dark'}
          onCenterChange={onCenterChange}
        />

        {/* Pin fixe, centré sur la carte. La pointe indique le point exact
            de livraison ; le petit disque au sol marque ce point au sol. */}
        <View pointerEvents="none" style={styles.pinLayer}>
          <Animated.View style={[styles.marker, { transform: [{ translateY: pinDrop }] }]}>
            <MapPin size={46} color={Brand.accent} fill={Brand.accent} strokeWidth={0} />
            <View style={styles.markerDot} />
          </Animated.View>
        </View>
        <View pointerEvents="none" style={styles.pinLayer}>
          <View style={styles.markerBase} />
        </View>

        {/* Contrôles superposés à la carte (retour, recherche, ma position) */}
        <SafeAreaView edges={['top']} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View style={styles.topBar}>
            <PressableScale onPress={() => router.back()}>
              <View style={[styles.iconBtn, { backgroundColor: colors.nav, borderColor: colors.border }, glow('#000', 6)]}>
                <ChevronLeft size={22} color={colors.text} />
              </View>
            </PressableScale>
            <View style={[styles.searchPill, { backgroundColor: colors.nav, borderColor: colors.border }, glow('#000', 6)]}>
              <Search size={17} color={Brand.accentLight} strokeWidth={2.3} />
              <TextInput
                value={query} onChangeText={onSearch}
                placeholder="Rechercher un lieu, quartier…" placeholderTextColor={colors.faint}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {searching && <ActivityIndicator size="small" color={Brand.accent} />}
              {!!query && !searching && (
                <PressableScale onPress={() => { setQuery(''); setResults([]); }}>
                  <X size={17} color={colors.faint} />
                </PressableScale>
              )}
            </View>
          </View>

          {/* Résultats de recherche */}
          {results.length > 0 && (
            <View style={[styles.results, { backgroundColor: colors.nav, borderColor: colors.border }, glow('#000', 10)]}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {results.map((r, i) => (
                  <PressableScale key={i} onPress={() => pickResult(r)}>
                    <View style={[styles.resultRow, { borderBottomColor: colors.border }]}>
                      <MapPin size={15} color={Brand.accentLight} strokeWidth={2.2} />
                      <Text numberOfLines={2} style={[bodyFont(13, '500'), { color: colors.text, flex: 1 }]}>{r.label}</Text>
                    </View>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bouton « ma position », ancré en bas à droite de la carte */}
          <View style={{ flex: 1 }} pointerEvents="box-none">
            <PressableScale onPress={useMyLocation} style={styles.locateBtn}>
              <View style={[styles.iconBtn, { backgroundColor: colors.nav, borderColor: colors.border }, glow(Brand.accent, 14)]}>
                <LocateFixed size={22} color={Brand.accentLight} strokeWidth={2.2} />
              </View>
            </PressableScale>
          </View>
        </SafeAreaView>
      </View>

      {/* ─── Panneau bas : adresse détectée + enregistrement ─── */}
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.page, borderColor: colors.border }]}>
        {/* Poignée : signale un panneau distinct de la carte */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {/* Adresses enregistrées (accès rapide) */}
        {addresses.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
            {addresses.map(a => (
              <PressableScale key={a.id} onPress={() => pickSaved(a.id)}>
                <View style={[styles.savedChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Home size={13} color={Brand.accentLight} strokeWidth={2.3} />
                  <Text numberOfLines={1} style={[bodyFont(12, '700'), { color: colors.text, maxWidth: 120 }]}>
                    {a.label || a.adresse}
                  </Text>
                  {a.is_default && <Star size={11} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />}
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        )}

        <Text style={[bodyFont(11.5, '700'), { color: colors.faint, letterSpacing: 0.5 }]}>LIEU DE LIVRAISON</Text>
        <View style={[styles.addrCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.addrPinBadge, { backgroundColor: Brand.accent + '18' }]}>
            <MapPin size={17} color={Brand.accent} strokeWidth={2.4} />
          </View>
          {resolving ? (
            <View style={styles.addrResolving}>
              <ActivityIndicator size="small" color={Brand.accent} />
              <Text style={[bodyFont(13, '500'), { color: colors.muted }]}>Localisation…</Text>
            </View>
          ) : (
            <Text numberOfLines={2} style={[bodyFont(13.5, '600'), { color: colors.text, flex: 1 }]}>{address}</Text>
          )}
        </View>

        <TextInput
          value={details} onChangeText={setDetails}
          placeholder="Précisions (étage, porte, repère…)" placeholderTextColor={colors.faint}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />

        {saveIt && (
          <TextInput
            value={label} onChangeText={setLabel}
            placeholder="Nom du lieu (Maison, Bureau…)" placeholderTextColor={colors.faint}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          />
        )}

        <PressableScale onPress={() => setSaveIt(s => !s)}>
          <View style={styles.saveToggle}>
            <View style={[styles.checkbox, saveIt ? { backgroundColor: Brand.accent, borderColor: Brand.accent } : { borderColor: colors.border }]}>
              {saveIt && <Check size={13} color="#fff" strokeWidth={3} />}
            </View>
            <Text style={[bodyFont(13, '600'), { color: colors.muted }]}>Enregistrer ce lieu pour mes prochaines livraisons</Text>
          </View>
        </PressableScale>

        <PressableScale onPress={confirm} style={{ marginTop: 14 }}>
          <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.confirmBtn, glow(Brand.accent, 22)]}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Check size={19} color="#fff" strokeWidth={2.6} />
                <Text style={[bodyFont(15.5, '800'), { color: '#fff' }]}>Livrer à cette adresse</Text>
              </>
            )}
          </LinearGradient>
        </PressableScale>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // La région carte prend tout l'espace restant ; la WebView la remplit
  // (absoluteFill interne), et le pin se centre donc SUR la carte.
  mapRegion: { flex: 1, overflow: 'hidden' },

  // Deux couches centrées : le marqueur (pointe vers le centre) et son ombre
  // au sol (au point exact). marginBottom = hauteur de l'icône, pour que la
  // pointe — et non le centre du marqueur — tombe pile au centre.
  pinLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  marker: { marginBottom: 46, alignItems: 'center' },
  markerDot: { position: 'absolute', top: 12, width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },
  markerBase: { width: 16, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.25)' },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8 },
  iconBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  searchPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 11 },
  results: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 18, borderWidth: 1, maxHeight: 240, overflow: 'hidden',
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderBottomWidth: 1 },
  locateBtn: { position: 'absolute', right: 16, bottom: 16 },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1,
    paddingHorizontal: 20, paddingTop: 10,
    // Le panneau remonte légèrement sur la carte pour un chevauchement net.
    marginTop: -20,
  },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, marginBottom: 14 },
  savedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1,
  },
  addrCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderWidth: 1, borderRadius: Radius.md, padding: 12, marginTop: 8, marginBottom: 12,
  },
  addrPinBadge: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addrResolving: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  input: {
    borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontWeight: '500', marginBottom: 10,
  },
  saveToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radius.pill },
});
