import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline, AnimatedRegion, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Client } from '@stomp/stompjs';
import { Colors, Typography, Spacing, Radius } from '../../../constants/theme';
import { API_WS_URL } from '../../../constants/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PressableScale, ConfettiBurst } from '../../../components/Animations';
import { restaurantService } from '../../../services/apiService';

// Formule de Haversine pour calculer la distance entre deux points GPS en km
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Rayon de la terre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatETA(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return 'Calcul...';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

export default function TrackingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  
  // Coordonnée pour le rendu (sert à la Polyline)
  const [livreurLoc, setLivreurLoc] = useState({ latitude: 3.86667, longitude: 11.51667 }); 
  
  // Coordonnée animée pour que le Marker glisse sur la map
  const livreurLocAnim = useRef(new AnimatedRegion({ 
    latitude: 3.86667, longitude: 11.51667, latitudeDelta: 0.005, longitudeDelta: 0.005 
  })).current;

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [status, setStatus] = useState('Connexion...');
  const [arrived, setArrived] = useState(false);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  
  const [routeCoords, setRouteCoords] = useState<{latitude: number, longitude: number}[]>([]);
  const currentStep = useRef(0);

  // Variables pour le calcul du vrai ETA
  const [etaText, setEtaText] = useState('Calcul...');
  const lastTimeRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number>(0);
  const traveledDistRef = useRef<number>(0);
  const speedRef = useRef<number>(30 / 3600); // Vitesse supposée au départ: 30 km/h (exprimée en km/sec)
  const lastEtaUpdateRef = useRef<number>(0); // Pour ne pas rafraîchir le texte trop souvent

  useEffect(() => {
    // Charger les restaurants environnants pour garnir la carte
    restaurantService.getMapRestaurants(3.86667, 11.51667, 50)
      .then(res => setRestaurants(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(loc);

        // Fetch itinéraire routier via OSRM
        try {
          const start = { latitude: 3.86667, longitude: 11.51667 };
          const end = loc.coords;
          const url = `http://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map((c: any) => ({
              latitude: c[1],
              longitude: c[0]
            }));
            
            // Calcul ETA initial
            let totalDist = 0;
            for(let i=0; i<coords.length-1; i++){
              totalDist += getDistanceFromLatLonInKm(coords[i].latitude, coords[i].longitude, coords[i+1].latitude, coords[i+1].longitude);
            }
            const initialEtaSec = totalDist / speedRef.current;
            setEtaText(formatETA(initialEtaSec));
            lastEtaUpdateRef.current = Date.now();
            
            setRouteCoords(coords);
          }
        } catch (e) {
          console.log("OSRM error", e);
        }
      }
    })();

    // Setup STOMP WebSocket
    const stompClient = new Client({
      brokerURL: API_WS_URL,
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      onConnect: () => {
        setStatus('Connecté au livreur');
        stompClient.subscribe(`/topic/commande/${id}/tracking`, (message) => {
          if (message.body) {
            const data = JSON.parse(message.body);
            const newLoc = { latitude: data.latitude, longitude: data.longitude };
            livreurLocAnim.timing({ latitude: newLoc.latitude, longitude: newLoc.longitude, duration: 1000, useNativeDriver: false }).start();
            setLivreurLoc(newLoc);
            mapRef.current?.animateToRegion({
              ...newLoc,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }, 1000);
          }
        });
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        setStatus('Erreur connexion');
      },
      onWebSocketError: (event) => {
        // console.error('WS Error:', event);
        setStatus('Mode Démo (Livreur en route)');
      }
    });

    // stompClient.activate(); // Désactivé pour la démo pour éviter les erreurs de connexion WebSocket
  }, [id]);

  useEffect(() => {
    if (routeCoords.length === 0) return;
    
    // Initialisation immédiate du livreur au point de départ
    livreurLocAnim.setValue({ latitude: routeCoords[0].latitude, longitude: routeCoords[0].longitude });
    setLivreurLoc(routeCoords[0]);
    currentStep.current = 1;
    
    // Reset compteurs de vitesse moyenne
    startTimeRef.current = Date.now();
    lastTimeRef.current = Date.now();
    traveledDistRef.current = 0;

    // Simulation ultra fluide et glissante
    const N = routeCoords.length;
    const intervalMs = Math.max(100, 20000 / N); // Le trajet se fera en ~20 secondes
    
    let simInterval = setInterval(() => {
      if (currentStep.current < routeCoords.length) {
        const nextLoc = routeCoords[currentStep.current];
        const prevLoc = routeCoords[currentStep.current - 1];
        
        // --- Calcul de la vitesse MOYENNE pour éviter les sauts brutaux ---
        const now = Date.now();
        const d = getDistanceFromLatLonInKm(prevLoc.latitude, prevLoc.longitude, nextLoc.latitude, nextLoc.longitude);
        traveledDistRef.current += d;
        
        const totalTimeSec = (now - startTimeRef.current) / 1000;
        
        // On met à jour la vitesse uniquement si un délai significatif s'est écoulé (ex: 1 sec)
        // pour que la moyenne ait du sens et ne saute pas
        if (totalTimeSec > 1) {
            speedRef.current = traveledDistRef.current / totalTimeSec;
        }

        // Distance restante sur l'itinéraire
        let remainingDist = 0;
        for(let i = currentStep.current; i < routeCoords.length - 1; i++){
            remainingDist += getDistanceFromLatLonInKm(routeCoords[i].latitude, routeCoords[i].longitude, routeCoords[i+1].latitude, routeCoords[i+1].longitude);
        }

        const etaSec = remainingDist / speedRef.current;
        
        // Ne rafraîchir l'affichage que toutes les 3 secondes pour ne pas stresser l'utilisateur
        if (now - lastEtaUpdateRef.current > 3000) {
            setEtaText(formatETA(etaSec));
            lastEtaUpdateRef.current = now;
        }
        
        // Animation fluide (glissement) vers le point suivant
        livreurLocAnim.timing({
          latitude: nextLoc.latitude,
          longitude: nextLoc.longitude,
          duration: intervalMs,
          useNativeDriver: false,
        }).start();

        setLivreurLoc(nextLoc);
        const destLoc = routeCoords[routeCoords.length - 1];
        const distToDest = getDistanceFromLatLonInKm(nextLoc.latitude, nextLoc.longitude, destLoc.latitude, destLoc.longitude);
        
        // S'il est à 20 mètres ou moins du point final, on le considère comme arrivé
        if (distToDest <= 0.02) {
            setStatus('📍 Livreur Arrivé !');
            setArrived(true);
            clearInterval(simInterval);
            return;
        }

        currentStep.current += 1;
        setStatus('Livreur en route');
      } else {
        setStatus('📍 Livreur Arrivé !');
        setArrived(true);
        clearInterval(simInterval);
      }
    }, intervalMs);

    return () => clearInterval(simInterval);
  }, [routeCoords]);

  return (
    <View style={s.container}>
      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={{
          ...livreurLoc,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {routeCoords.length > 0 ? (
          <Polyline
            coordinates={routeCoords.slice(Math.max(0, currentStep.current - 1))}
            strokeColor={Colors.client.primary}
            strokeWidth={4}
            lineDashPattern={[5, 5]}
          />
        ) : location ? (
          <Polyline
            coordinates={[
              livreurLoc,
              { latitude: location.coords.latitude, longitude: location.coords.longitude }
            ]}
            strokeColor={Colors.client.primary}
            strokeWidth={4}
            lineDashPattern={[5, 5]}
          />
        ) : null}
        
        {/* Zone d'arrivée du client (cercle de 20 mètres) */}
        {location && (
          <Circle
            center={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
            radius={20}
            fillColor="rgba(0, 122, 255, 0.2)"
            strokeColor="rgba(0, 122, 255, 0.5)"
            strokeWidth={2}
          />
        )}
        
        <Marker.Animated coordinate={livreurLocAnim}>
          <View style={s.livreurPin}>
            <Text style={{ fontSize: 32 }}>🛵</Text>
          </View>
        </Marker.Animated>

        {/* Afficher les restaurants environnants */}
        {restaurants.map((resto: any) => (
          <Marker
            key={resto.id}
            coordinate={{ latitude: resto.latitude, longitude: resto.longitude }}
            title={resto.nom}
            description={resto.categorie}
          >
            <View style={s.restoMarker}>
              <Text style={{ fontSize: 16 }}>{resto.emoji || '🍽️'}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
      
      {/* Animation d'arrivée */}
      <View style={{ position: 'absolute', top: 100, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
        <ConfettiBurst visible={arrived} />
      </View>

      <SafeAreaView style={s.overlayTop} edges={['top']}>
        <View style={s.headerRow}>
          <PressableScale style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ fontSize: 24, color: '#FFF' }}>←</Text>
          </PressableScale>
          <View style={s.statusPill}>
            <Text style={s.statusText}>{status}</Text>
          </View>
        </View>
      </SafeAreaView>

      <TouchableOpacity style={s.locationBtn} onPress={() => {
        if (location && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 1000);
        } else {
          // Fallback sur le livreur si pas de localisation
          mapRef.current?.animateToRegion({ ...livreurLoc, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
        }
      }}>
        <Text style={{ fontSize: 24 }}>📍</Text>
      </TouchableOpacity>

      <View style={s.bottomSheet}>
        <Text style={s.title}>{arrived ? 'Livraison Terminée ! 🎉' : `Suivi Commande #${id}`}</Text>
        <View style={s.livreurInfo}>
          <View style={s.livreurAvatar}><Text style={{ fontSize: 24 }}>👨</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.livreurName}>Paul Nkolo</Text>
            <Text style={s.livreurSub}>🏍️ Yamaha · YD-5678-A</Text>
          </View>
          <View style={s.callBtn}><Text style={{ fontSize: 20 }}>📞</Text></View>
        </View>
        <Text style={s.eta}>{arrived ? 'Bon appétit !' : `Arrivée estimée: ${etaText}`}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.screen },
  map: { ...StyleSheet.absoluteFillObject },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  statusPill: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 15, paddingVertical: 8, borderRadius: Radius.full, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  statusText: { ...Typography.bodyBold, color: Colors.client.primary },
  livreurPin: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5, borderWidth: 2, borderColor: Colors.client.primary },
  locationBtn: { position: 'absolute', bottom: 220, right: 20, width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.bg.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 15 },
  title: { ...Typography.h3, marginBottom: 15 },
  livreurInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: Colors.border.default },
  livreurAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  livreurName: { ...Typography.bodyBold, fontSize: 16 },
  livreurSub: { ...Typography.small, color: Colors.text.secondary, marginTop: 4 },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.client.bg, justifyContent: 'center', alignItems: 'center' },
  eta: { ...Typography.h2, fontSize: 22, color: Colors.client.primary, textAlign: 'center' },
  restoMarker: { width: 30, height: 30, backgroundColor: '#FFF', borderRadius: 15, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 }
});
