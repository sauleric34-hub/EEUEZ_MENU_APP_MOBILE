import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated,
  ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Colors, Typography, Spacing, Radius, glow, glowSubtle } from '../../constants/theme';
import { PressableScale, ConfettiBurst, EmojiPop, useButtonPress } from '../../components/Animations';
import { useAppContext } from '../../context/AppContext';
import { commandeService } from '../../services/apiService';
import {
  MailX, RefreshCw, Home, Bike, UserCircle2, PartyPopper,
  TriangleAlert, Phone, MessageCircle, ChevronLeft
} from 'lucide-react-native';

// Fonction Haversine pour calculer la distance en km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function SuiviScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { simulatedDeliveries } = useAppContext();
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnims = useRef(Array(6).fill(0).map(() => new Animated.Value(0))).current;
  const { confettiVisible, emojiVisible, emoji, triggerSuccess } = useButtonPress();

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(params.order_id ? Number(params.order_id) : null);
  const [orderDetail, setOrderDetail] = useState<any>(null);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
    Animated.stagger(80, slideAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true })
    )).start();
  }, []);

  // Si aucun selectedOrderId n'est défini mais qu'il y a des commandes actives, on prend la première
  useEffect(() => {
     if (!selectedOrderId && simulatedDeliveries.length > 0) {
        setSelectedOrderId(simulatedDeliveries[0].id);
     }
  }, [selectedOrderId, simulatedDeliveries]);

  // Fetch du detail de la commande pour afficher les plats, total etc.
  useEffect(() => {
     if (selectedOrderId) {
        commandeService.getDetail(selectedOrderId).then(res => setOrderDetail(res)).catch(e=>{});
     }
  }, [selectedOrderId]);

  const activeDelivery = simulatedDeliveries.find(d => d.id === selectedOrderId);
  
  // Recentre la map si l'ordre change
  useEffect(() => {
     if (activeDelivery && mapRef.current && activeDelivery.routePath.length > 0) {
        mapRef.current.fitToCoordinates([activeDelivery.rPos, activeDelivery.clientPos], {
           edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
           animated: true,
        });
     }
  }, [activeDelivery?.id]);

  if (simulatedDeliveries.length === 0 && !selectedOrderId) {
    return (
      <View style={[s.screen, { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }]}>
        <MailX size={64} color={Colors.text.muted} style={{ marginBottom: 20 }} />
        <Text style={[Typography.h3, { textAlign: 'center', color: Colors.text.primary }]}>Aucune commande en cours</Text>
        <Text style={[Typography.body, { textAlign: 'center', color: Colors.text.secondary, marginTop: 10, marginBottom: 30 }]}>
          Passez une commande pour suivre sa livraison en temps réel.
        </Text>
        <PressableScale onPress={() => router.push('/(client)/explore' as any)} style={{ width: '100%', maxWidth: 250 }}>
          <View style={[s.contactBtn, { flex: undefined, width: '100%' }, glow(Colors.client.glow, 8)]}>
             <Text style={s.contactBtnText}>Commander</Text>
          </View>
        </PressableScale>
      </View>
    );
  }

  if (!activeDelivery) {
    return (
      <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.app} />
        <RefreshCw size={44} color={Colors.client.primary} style={{ marginBottom: 12 }} />
        <Text style={[Typography.h3, { marginTop: 10, color: Colors.text.primary }]}>Synchronisation...</Text>
        <Text style={[Typography.body, { color: Colors.text.muted, marginTop: 5 }]}>Recherche de votre commande...</Text>
      </View>
    );
  }

  const { routePath, currentIndex, isRecalculating, detourMarker, clientPos, currentStep } = activeDelivery;
  
  // Estimation du temps
  let etaMinutes = 0;
  if (routePath.length > 0 && currentIndex < routePath.length) {
     const currentPos = routePath[currentIndex];
     const dist = calculateDistance(currentPos.latitude, currentPos.longitude, clientPos.latitude, clientPos.longitude);
     const speedKmh = 15;
     const hours = dist / speedKmh;
     etaMinutes = Math.ceil(hours * 60);
  }

  const livreurPos = routePath.length > 0 ? routePath[currentIndex] : null;

  // Points restants à tracer (on coupe la route là où le livreur se trouve approximativement)
  let displayStartIndex = currentIndex;
  if (activeDelivery.displayRoute && livreurPos) {
      let minD = Infinity;
      for (let i = 0; i < activeDelivery.displayRoute.length; i++) {
         const p = activeDelivery.displayRoute[i];
         const dx = p.latitude - livreurPos.latitude;
         const dy = p.longitude - livreurPos.longitude;
         const d = dx*dx + dy*dy;
         if (d < minD) { minD = d; displayStartIndex = i; }
      }
  }
  const remainingPath = activeDelivery.displayRoute 
      ? activeDelivery.displayRoute.slice(displayStartIndex) 
      : routePath.slice(currentIndex);

  const ETAPES = [
    { label: 'Commande reçue',       heure: '12:05', acteur: 'Client' },
    { label: 'Acceptée',             heure: '12:07', acteur: 'Restaurant' },
    { label: 'En préparation',       heure: '12:08', acteur: 'Cuisine' },
    { label: 'Livreur assigné',      heure: '12:26', acteur: 'Menu' },
    { label: 'En route vers vous',   heure: '12:28', acteur: 'Paul N.' },
    { label: 'Livraison effectuée',  heure: 'Maint.', acteur: '' },
  ];

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView>

        {/* Sélecteur de commande (si multiple) */}
        {simulatedDeliveries.length > 1 && (
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.md, gap: 10 }}>
              {simulatedDeliveries.map(d => (
                 <PressableScale key={d.id} onPress={() => setSelectedOrderId(d.id)}>
                    <View style={[
                       s.orderSelector, 
                       selectedOrderId === d.id && s.orderSelectorActive
                    ]}>
                       <Text style={[s.orderSelectorText, selectedOrderId === d.id && s.orderSelectorTextActive]}>
                          Cmd #{d.id.toString().slice(0, 5)}
                       </Text>
                    </View>
                 </PressableScale>
              ))}
           </ScrollView>
        )}

        <View style={{ position: 'relative' }}>
          <ConfettiBurst visible={confettiVisible} />
          <EmojiPop emoji={emoji} visible={emojiVisible} size={28} />
        </View>

        {/* Header simple */}
        <View style={s.header}>
          <PressableScale onPress={() => router.back()}>
            <View style={s.backBtn}><ChevronLeft size={24} color={Colors.text.primary} /></View>
          </PressableScale>
          <Text style={s.headerTitle}>Suivi en direct</Text>
          <View style={s.headerRight} />
        </View>

        {/* Carte / Simulation */}
        <View style={[s.mapCard, glowSubtle(Colors.client.primary)]}>
          <View style={s.mapContainer}>
            <MapView
              ref={mapRef}
              style={s.map}
              showsUserLocation={false}
              showsMyLocationButton={false}
            >
              {remainingPath.length > 0 && currentStep >= 4 && (
                <Polyline
                  coordinates={remainingPath}
                  strokeColor={Colors.client.primary}
                  strokeWidth={5}
                  lineDashPattern={[12, 10]}
                />
              )}
              
              <Marker coordinate={clientPos} title="Vous êtes ici">
                <View style={s.homeMarker}>
                  <Home size={20} color={Colors.client.primary} />
                </View>
              </Marker>

              {livreurPos && currentStep >= 4 && (
                <Marker coordinate={livreurPos} anchor={{x: 0.5, y: 0.5}}>
                  <Animated.View style={[s.livreurPin, { transform: [{ scale: pulseAnim }] }]}>
                    <Bike size={24} color={Colors.bg.surface} />
                  </Animated.View>
                </Marker>
              )}
            </MapView>
          </View>

          {/* Info livreur (Affiché dès que la commande est reçue, mais on simule que le livreur est assigné direct) */}
          <View style={s.livreurInfo}>
            <View style={s.livreurAvatarBox}>
               <UserCircle2 size={30} color={Colors.client.primary} />
            </View>
            <View style={s.livreurDetails}>
              <Text style={s.livreurNom}>Paul N. (Livreur Menu)</Text>
              <Text style={s.livreurMoto}>Yamaha YZF-R3 · CM-842-A</Text>
              <View style={s.etaRow}>
                <Text style={s.etaLabel}>{currentStep === 5 ? 'Livraison terminée' : 'Arrivée estimée'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {currentStep === 5 && <PartyPopper size={20} color={Colors.success} />}
                  <Text style={[s.etaValue, { color: currentStep === 5 ? Colors.success : Colors.client.primary }]}>
                    {currentStep === 5 ? 'Livré !' : `~${etaMinutes} minutes`}
                  </Text>
                </View>
              </View>
              {isRecalculating && (
                <View style={{ backgroundColor: Colors.warning + '33', padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, borderRadius: 8 }}>
                   <TriangleAlert size={16} color={Colors.warning} />
                   <Text style={{ color: Colors.warning, fontWeight: 'bold' }}>Détour détecté ! Recalcul...</Text>
                </View>
              )}
            </View>

            {/* Timeline */}
            <View style={s.timeline}>
              <Text style={s.timelineTitle}>Progression</Text>
              {ETAPES.map((etape, index) => {
                const isPassed = index <= currentStep;
                const isCurrent = index === currentStep;
                return (
                  <Animated.View key={index} style={[s.stepRow, { opacity: slideAnims[index], transform: [{ translateY: slideAnims[index].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                    <View style={s.stepLeft}>
                      <Text style={[s.stepHeure, isPassed && s.stepHeurePassed]}>{etape.heure}</Text>
                    </View>
                    <View style={s.stepLine}>
                      <View style={[s.stepDot, isPassed && s.stepDotPassed, isCurrent && s.stepDotCurrent]} />
                      {index < ETAPES.length - 1 && <View style={[s.stepTrail, isPassed && s.stepTrailPassed]} />}
                    </View>
                    <View style={s.stepRight}>
                      <Text style={[s.stepLabel, isPassed && s.stepLabelPassed]}>{etape.label}</Text>
                      {etape.acteur !== '' && <Text style={s.stepActeur}>{etape.acteur}</Text>}
                    </View>
                  </Animated.View>
                );
              })}
            </View>

            {/* Boutons d'action rapides */}
            {currentStep < 5 && (
               <View style={s.actionsRow}>
                 <PressableScale onPress={() => triggerSuccess('📞')}>
                   <View style={[s.contactBtn, { flexDirection: 'row', gap: 8 }]}>
                     <Phone size={16} color={Colors.bg.app} />
                     <Text style={s.contactBtnText}>Appeler Paul</Text>
                   </View>
                 </PressableScale>
                 <PressableScale onPress={() => triggerSuccess('💬')}>
                   <View style={[s.contactBtn, { backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border.default, flexDirection: 'row', gap: 8 }]}>
                     <MessageCircle size={16} color={Colors.text.primary} />
                     <Text style={[s.contactBtnText, { color: Colors.text.primary }]}>Message</Text>
                   </View>
                 </PressableScale>
               </View>
            )}
            
            {orderDetail && (
               <View style={s.orderDetailsBox}>
                  <Text style={s.orderDetailsTitle}>Détails de la commande</Text>
                  {orderDetail.lignes?.map((l:any, i:number) => (
                     <View key={i} style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
                        <Text style={{color: Colors.text.secondary}}>{l.quantite}x {l.nom_plat}</Text>
                        <Text style={{color: Colors.text.primary, fontWeight: 'bold'}}>{l.prix_unitaire * l.quantite} F</Text>
                     </View>
                  ))}
               </View>
            )}
            
          </View>
        </View>

      </SafeAreaView>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: Colors.bg.app },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.glass.bg, justifyContent: 'center', alignItems: 'center' },
  backArrow:     { fontSize: 22, color: Colors.text.primary },
  headerTitle:   { ...Typography.h3 },
  headerRight:   { width: 44 },
  mapCard:       { marginHorizontal: Spacing.md, marginBottom: Spacing.xl, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border.subtle },
  mapContainer:  { height: 280, width: '100%' },
  map:           { ...StyleSheet.absoluteFillObject },
  homeMarker:    { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.client.primary },
  livreurPin:    { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.client.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.bg.surface, shadowColor: Colors.client.primary, shadowOffset: {width:0,height:8}, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10 },
  livreurInfo:   { padding: Spacing.lg, backgroundColor: Colors.bg.surface },
  livreurAvatarBox:{ width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: -40, borderWidth: 4, borderColor: Colors.bg.surface },
  livreurDetails:{ alignItems: 'center', marginTop: 10, borderBottomWidth: 1, borderBottomColor: Colors.border.subtle, paddingBottom: Spacing.md },
  livreurNom:    { ...Typography.h3, marginBottom: 2 },
  livreurMoto:   { ...Typography.small, color: Colors.text.muted, marginBottom: 12 },
  etaRow:        { backgroundColor: Colors.client.bg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.lg, alignItems: 'center', width: '100%' },
  etaLabel:      { ...Typography.small, color: Colors.client.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  etaValue:      { fontSize: 24, fontWeight: '900', color: Colors.client.primary },
  timeline:      { marginTop: Spacing.lg },
  timelineTitle: { ...Typography.bodyBold, marginBottom: Spacing.md },
  stepRow:       { flexDirection: 'row', minHeight: 46 },
  stepLeft:      { width: 50, alignItems: 'flex-end', paddingRight: 10, paddingTop: 2 },
  stepHeure:     { fontSize: 12, color: Colors.text.muted, fontWeight: '600' },
  stepHeurePassed:{ color: Colors.text.secondary },
  stepLine:      { width: 20, alignItems: 'center' },
  stepDot:       { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.border.default, borderWidth: 3, borderColor: Colors.bg.surface, zIndex: 2 },
  stepDotCurrent:{ backgroundColor: Colors.client.primary, borderColor: Colors.client.bg, transform: [{ scale: 1.4 }] },
  stepDotPassed: { backgroundColor: Colors.client.primary },
  stepTrail:     { width: 2, flex: 1, backgroundColor: Colors.border.default, marginTop: -4, marginBottom: -4, zIndex: 1 },
  stepTrailPassed:{ backgroundColor: Colors.client.primary },
  stepRight:     { flex: 1, paddingLeft: 10, paddingBottom: 16 },
  stepLabel:     { ...Typography.body, color: Colors.text.muted, fontWeight: '600' },
  stepLabelPassed:{ color: Colors.text.primary },
  stepActeur:    { ...Typography.small, color: Colors.client.primary, marginTop: 2, fontWeight: '700' },
  actionsRow:    { flexDirection: 'row', gap: 12, marginTop: Spacing.lg },
  contactBtn:    { flex: 1, backgroundColor: Colors.client.primary, paddingVertical: 14, borderRadius: Radius.lg, alignItems: 'center' },
  contactBtnText:{ color: Colors.bg.app, fontWeight: '800', fontSize: 14 },
  orderDetailsBox: { marginTop: Spacing.lg, padding: Spacing.md, backgroundColor: Colors.bg.elevated, borderRadius: Radius.lg },
  orderDetailsTitle: { ...Typography.bodyBold, marginBottom: Spacing.sm },
  orderSelector: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border.default },
  orderSelectorActive: { backgroundColor: Colors.client.bg, borderColor: Colors.client.primary },
  orderSelectorText: { ...Typography.small, fontWeight: '600' },
  orderSelectorTextActive: { color: Colors.client.primary },
});
