import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MapView, { Marker, Callout, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { PressableScale } from '../../components/Animations';
import { restaurantService } from '../../services/apiService';
import { useAppContext } from '../../context/AppContext';
import { Store, Bike, MapPin, Search, X, Truck, ChevronLeft } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

export default function ExploreScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { simulatedDeliveries } = useAppContext();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 3.848;
      let lon = 11.502; // Default Yaoundé
      
      if (status === 'granted') {
        try {
          let loc = await Location.getCurrentPositionAsync({});
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
          setLocation(loc.coords);
          
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: lat,
              longitude: lon,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }, 1000);
          }
        } catch(e) {
           console.log("Error getting loc", e);
        }
      }
      
      // Helper function for retrying the fetch
      const fetchWithRetry = async (latitude: number, longitude: number, retries = 5, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
          try {
            const data: any = await restaurantService.getMapRestaurants(latitude, longitude);
            setRestaurants(data);
            setLoading(false);
            return; // Success, exit retry loop
          } catch (err) {
            console.log(`Erreur fetch map restos (essai ${i + 1}/${retries})`, err);
            if (i < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              throw err; // All retries failed
            }
          }
        }
      };

      try {
        await fetchWithRetry(lat, lon, 9999, 3000); // Retry infiniment
      } catch (err) {
        console.log('Erreur fetch map restos finale', err);
        setLoading(false);
      }
    })();
  }, []);

  const filteredRestos = restaurants.filter(r => 
    r.nom.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Map Background */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: location ? location.latitude : 3.848,
          longitude: location ? location.longitude : 11.502,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {filteredRestos.map((resto) => (
          <Marker
            key={resto.id}
            coordinate={{ latitude: parseFloat(resto.latitude), longitude: parseFloat(resto.longitude) }}
            title={resto.nom}
            description={resto.adresse}
            onPress={() => router.push(`/(client)/restaurant/${resto.id}` as any)}
          >
            <View style={s.markerPin}>
              <Store size={18} color={Colors.client.primary} />
            </View>
          </Marker>
        ))}

        {/* Rendu des trajets et motos */}
        {simulatedDeliveries.map(d => {
          if (d.currentStep < 4 || d.routePath.length === 0) return null;
          
          const pos = d.routePath[d.currentIndex];
          if (!pos) return null;

          let displayStartIndex = d.currentIndex;
          if (d.displayRoute && pos) {
              let minD = Infinity;
              for (let i = 0; i < d.displayRoute.length; i++) {
                 const p = d.displayRoute[i];
                 const dx = p.latitude - pos.latitude;
                 const dy = p.longitude - pos.longitude;
                 const distance = dx*dx + dy*dy;
                 if (distance < minD) { minD = distance; displayStartIndex = i; }
              }
          }
          const remainingPath = d.displayRoute ? d.displayRoute.slice(displayStartIndex) : d.routePath.slice(d.currentIndex);
          
          if (remainingPath.length === 0) return null;

          return (
            <React.Fragment key={`deliv-${d.id}`}>
              <Polyline
                coordinates={remainingPath}
                strokeColor={Colors.client.primary}
                strokeWidth={4}
                lineDashPattern={[10, 10]}
              />
              <Marker coordinate={pos} anchor={{x: 0.5, y: 0.5}}>
                <View style={s.livreurPinSmall}>
                  <Bike size={20} color={Colors.client.primary} />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      <SafeAreaView style={s.safeArea} pointerEvents="box-none">
        {/* Floating Search Bar */}
        <View style={s.header}>
          <PressableScale onPress={() => router.back()}>
            <View style={s.backBtn}><ChevronLeft size={24} color={Colors.text.primary} /></View>
          </PressableScale>
          <View style={s.searchBar}>
            <Search size={16} color={Colors.text.muted} />
            <TextInput
              placeholder="Rechercher un restaurant..."
              placeholderTextColor={Colors.text.muted}
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <PressableScale onPress={() => setQuery('')}>
                <X size={18} color={Colors.text.muted} />
              </PressableScale>
            )}
          </View>
        </View>

        {simulatedDeliveries.length > 0 && (
          <PressableScale onPress={() => router.push('/(client)/suivi' as any)} scaleDown={0.98}>
            <View style={s.activeOrderBanner}>
              <Truck size={24} color={Colors.client.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.activeOrderTitle}>
                  {simulatedDeliveries.length > 1 ? `${simulatedDeliveries.length} livraisons en cours !` : 'Livraison en cours !'}
                </Text>
                <Text style={s.activeOrderSub}>Cliquez pour suivre vos commandes</Text>
              </View>
              <Text style={{ fontSize: 20, color: Colors.client.primary }}>›</Text>
            </View>
          </PressableScale>
        )}

        {loading && (
          <View style={s.loadingBox}>
            <Text style={s.loadingText}>Chargement de la carte...</Text>
          </View>
        )}
      </SafeAreaView>
      
      {/* My Location FAB */}
      <PressableScale
        style={s.fab}
        scaleDown={0.9}
        onPress={() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: location ? location.latitude : 3.848,
              longitude: location ? location.longitude : 11.502,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }, 1000);
          }
        }}
      >
        <MapPin size={24} color={Colors.client.primary} />
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.app },
  safeArea: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, paddingHorizontal: 14, height: 44, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text.primary },
  loadingBox: { alignSelf: 'center', marginTop: 20, backgroundColor: Colors.bg.surface, paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.full, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  loadingText: { ...Typography.small, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 40, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width:0, height:4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  markerPin: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.client.primary, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
  calloutCard: { width: 160, backgroundColor: Colors.bg.surface, padding: 10, borderRadius: Radius.md, alignItems: 'center' },
  calloutTitle: { ...Typography.bodyBold, fontSize: 14, textAlign: 'center' },
  calloutSub: { ...Typography.small, marginTop: 4, color: Colors.text.secondary },
  calloutAction: { ...Typography.small, marginTop: 6, color: Colors.client.primary, fontWeight: '700' },
  activeOrderBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.elevated, padding: Spacing.md, borderRadius: Radius.lg, marginTop: Spacing.md, shadowColor: '#000', shadowOffset: { width:0, height:4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8, gap: 12, borderWidth: 1, borderColor: Colors.client.primary + '55' },
  activeOrderTitle: { ...Typography.bodyBold, fontSize: 15 },
  activeOrderSub: { ...Typography.small, color: Colors.client.primary, marginTop: 2 },
  livreurPinSmall: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.client.primary, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
});
