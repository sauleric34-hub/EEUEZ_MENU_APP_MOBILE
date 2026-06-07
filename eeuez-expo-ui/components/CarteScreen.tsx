import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, TouchableOpacity, TextInput, FlatList, Keyboard } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { restaurantService } from '../services/apiService';
import { RESTAURANTS_LISTE } from '../data/mockData';
import { useRouter } from 'expo-router';
import { PressableScale } from './Animations';

const { width, height } = Dimensions.get('window');

// Base de données simulée des repères (Landmarks/Zones) pour l'autocomplétion
const LANDMARKS = [
  { id: '1', nom: 'Bastos', desc: 'Yaoundé, Centre', distance: '1.2 km', latitude: 3.8700, longitude: 11.5100, type: 'zone' },
  { id: '2', nom: 'Dispensary De Messassi', desc: 'Centre médical, clinique · Mfoundi', distance: '16.3 km', latitude: 3.8850, longitude: 11.5150, type: 'hopital' },
  { id: '3', nom: 'Diderot', desc: 'Yaoundé, Centre', distance: '2.5 km', latitude: 3.8800, longitude: 11.5200, type: 'zone' },
  { id: '4', nom: 'Direction Générale des Impôts', desc: 'Administration', distance: '7.9 km', latitude: 3.8650, longitude: 11.5120, type: 'admin' },
  { id: '5', nom: 'Le Diapazon', desc: 'Boîte de nuit · Rue 1.363, Yaoundé 4e', distance: '10.3 km', latitude: 3.8750, longitude: 11.5250, type: 'loisir' },
  { id: '6', nom: 'Mvan', desc: 'Yaoundé, Sud', distance: '8.4 km', latitude: 3.8400, longitude: 11.5000, type: 'zone' },
  { id: '7', nom: 'Titi Garage', desc: 'Yaoundé, Essos', distance: '4.1 km', latitude: 3.8900, longitude: 11.5300, type: 'zone' },
  { id: '8', nom: 'Centre Ville', desc: 'Avenue Kennedy, Yaoundé', distance: '0.5 km', latitude: 3.8480, longitude: 11.5020, type: 'zone' },
  { id: '9', nom: 'Hôpital de District de Mvog Ada', desc: 'Hôpital militaire', distance: '7.8 km', latitude: 3.8600, longitude: 11.5200, type: 'hopital' },
];

export default function CarteScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedResto, setSelectedResto] = useState<any>(null);
  
  // États de recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredPlaces, setFilteredPlaces] = useState<any[]>([]);

  const mapRef = useRef<MapView>(null);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const router = useRouter();

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        fetchRestaurants(3.86667, 11.51667);
        return;
      }

      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(loc);
      fetchRestaurants(loc.coords.latitude, loc.coords.longitude);
    })();
  }, []);

  const fetchRestaurants = (lat: number, lon: number) => {
    restaurantService.getMapRestaurants(lat, lon, 50)
      .then(res => {
        if (!res.data || res.data.length === 0) {
          setRestaurants(RESTAURANTS_LISTE);
        } else {
          setRestaurants(res.data);
        }
      })
      .catch(err => {
        console.log("Info: Le backend est hors-ligne, chargement données simulées");
        setRestaurants(RESTAURANTS_LISTE);
      });
  };

  const allPlaces = React.useMemo(() => {
    const places = LANDMARKS.map(l => ({ ...l, isRestaurant: false }));
    restaurants.forEach(r => {
      places.push({
        id: `resto_${r.id}`,
        nom: r.nom,
        desc: r.categorie,
        type: 'resto',
        distance: 'À proximité',
        latitude: r.latitude,
        longitude: r.longitude,
        isRestaurant: true,
        restoData: r
      });
    });
    return places;
  }, [restaurants]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length > 0) {
      const filtered = allPlaces.filter(place => 
        place.nom.toLowerCase().includes(text.toLowerCase()) || 
        place.desc.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredPlaces(filtered);
    } else {
      setFilteredPlaces(allPlaces);
    }
    setShowDropdown(true);
  };

  const selectPlace = (place: any) => {
    setSearchQuery(place.nom);
    setShowDropdown(false);
    Keyboard.dismiss();
    
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015
      }, 1000);
    }

    if (place.isRestaurant) {
      setTimeout(() => {
        handleMarkerPress(place.restoData);
      }, 300);
    }
  };

  const handleMarkerPress = (resto: any) => {
    setSelectedResto(resto);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 8,
      useNativeDriver: true
    }).start();
    mapRef.current?.animateToRegion({
      latitude: resto.latitude,
      longitude: resto.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    }, 500);
  };

  const closeBottomSheet = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true
    }).start(() => setSelectedResto(null));
  };

  const getPlaceIcon = (type: string) => {
    switch(type) {
      case 'hopital': return '🏥';
      case 'loisir': return '🍸';
      case 'admin': return '🏛️';
      case 'resto': return '🍽️';
      default: return '📍';
    }
  };

  return (
    <View style={s.container}>
      {/* Top Bar with Hamburger Only */}
      <View style={s.topBarContainer}>
        <PressableScale onPress={onOpenDrawer}>
          <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
        </PressableScale>
      </View>

      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={{
          latitude: 3.86667,
          longitude: 11.51667,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onPress={() => { setShowDropdown(false); Keyboard.dismiss(); }}
      >
        {restaurants.map(resto => {
          const isSelected = selectedResto?.id === resto.id;
          return (
            <Marker
              key={resto.id}
              coordinate={{ latitude: resto.latitude, longitude: resto.longitude }}
              onPress={() => handleMarkerPress(resto)}
            >
              <View style={{ alignItems: 'center', transform: [{ scale: isSelected ? 1.2 : 1 }] }}>
                <View style={[s.proMarker, { backgroundColor: resto.isOuvert ? Colors.client.primary : Colors.text.muted }]}>
                  <View style={s.proMarkerInner}>
                    <Text style={{ fontSize: 16 }}>{resto.logo || resto.emoji || '🍽️'}</Text>
                  </View>
                </View>
                <View style={[s.proMarkerTail, { borderTopColor: resto.isOuvert ? Colors.client.primary : Colors.text.muted }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <TouchableOpacity 
        style={s.locationBtn} 
        onPress={() => {
          if (location && mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01
            }, 500);
          }
        }}
      >
        <Text style={{ fontSize: 24 }}>📍</Text>
      </TouchableOpacity>

      {/* Bottom Search UI (Yango style) */}
      <View style={[s.bottomSearchContainer, showDropdown && s.bottomSearchContainerExpanded]}>
        {showDropdown && <View style={s.dragHandle} />}
        <View style={s.searchContainer}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput 
            style={s.searchInput}
            placeholder="Où voulez-vous manger ?"
            placeholderTextColor={Colors.text.muted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => {
              if (searchQuery.trim().length === 0) setFilteredPlaces(allPlaces);
              setShowDropdown(true);
            }}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setShowDropdown(false); }}>
              <View style={s.clearBtn}><Text style={{ color: '#FFF', fontSize: 10 }}>✕</Text></View>
            </TouchableOpacity>
          )}
        </View>

        {showDropdown && (
          <View style={{ flex: 1, marginTop: 15 }}>
            <FlatList
              data={filteredPlaces}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => {
                return (
                  <TouchableOpacity style={s.resultItem} onPress={() => selectPlace(item)}>
                    <Text style={s.resultIcon}>{getPlaceIcon(item.type)}</Text>
                    <View style={s.resultTextContainer}>
                      <Text style={s.resultName}>{item.nom}</Text>
                      <Text style={s.resultDesc}>{item.desc}</Text>
                    </View>
                    <Text style={s.resultDistance}>{item.distance}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* Bottom Sheet Animé */}
      <Animated.View style={[s.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
        {selectedResto && (
          <View>
            <TouchableOpacity style={s.closeArea} onPress={closeBottomSheet} />
            <View style={s.sheetContent}>
              <View style={s.dragHandle} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={s.sheetThumb}>
                  <Text style={{ fontSize: 40 }}>{selectedResto.logo || selectedResto.emoji || '🍽️'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={s.sheetTitle}>{selectedResto.nom}</Text>
                  <Text style={s.sheetCat}>{selectedResto.categorie} · ⭐ {selectedResto.note}</Text>
                  <Text style={s.sheetCat}>Livraison: {selectedResto.tempsLivraisonEstime || selectedResto.temps} min</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={s.orderBtn}
                onPress={() => {
                  closeBottomSheet();
                  router.push(`/restaurant/${selectedResto.id}`);
                }}
              >
                <Text style={s.orderBtnText}>Voir le Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.screen },
  map: { width: '100%', height: '100%' },
  
  topBarContainer: { position: 'absolute', top: 50, left: 15, right: 15, zIndex: 100 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hamburger: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  hamburgerText: { fontSize: 22 },
  
  searchContainer: { height: 48, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  searchInput: { flex: 1, fontSize: 16, color: Colors.text.primary, height: '100%' },
  clearBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.text.muted, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border.default },
  resultIcon: { fontSize: 24, marginRight: 16, opacity: 0.6 },
  resultTextContainer: { flex: 1 },
  resultName: { ...Typography.bodyBold, fontSize: 16, marginBottom: 2 },
  resultDesc: { ...Typography.small, color: Colors.text.secondary },
  resultDistance: { ...Typography.small, color: Colors.text.muted, marginLeft: 10 },
  proMarker: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 6
  },
  proMarkerInner: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
  },
  proMarkerTail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  locationBtn: { position: 'absolute', bottom: 120, right: 20, width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5, zIndex: 10 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 200 },
  closeArea: { height: height, width: '100%', position: 'absolute', bottom: 200 },
  sheetContent: { backgroundColor: Colors.bg.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 15 },
  dragHandle: { width: 40, height: 5, backgroundColor: Colors.border.default, borderRadius: 2.5, alignSelf: 'center', marginBottom: 20 },
  sheetThumb: { width: 80, height: 80, borderRadius: Radius.lg, backgroundColor: Colors.client.primary + '22', justifyContent: 'center', alignItems: 'center' },
  sheetTitle: { ...Typography.h2, fontSize: 20 },
  sheetCat: { ...Typography.body, color: Colors.text.secondary, marginTop: 4 },
  orderBtn: { marginTop: 20, backgroundColor: Colors.client.primary, paddingVertical: 15, borderRadius: Radius.lg, alignItems: 'center' },
  orderBtnText: { color: '#FFF', ...Typography.bodyBold, fontSize: 16 },
  
  bottomSearchContainer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.bg.surface,
    padding: 15,
    paddingBottom: 30,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 15,
    zIndex: 100
  },
  bottomSearchContainerExpanded: {
    top: 60,
  }
});
