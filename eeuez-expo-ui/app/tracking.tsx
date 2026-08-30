// ═══════════════════════════════════════════════════════════
//  Suivi de livraison en direct
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, ScrollView, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ChevronLeft, Bike, Phone, Check, MapPin, Star, PackageSearch, QrCode } from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { TRACK_STEPS, TRACK_ETA } from '../data/menuData';
import { ScreenBg } from '../components/ScreenBg';
import { PressableScale, CenterMessage, displayFont, bodyFont } from '../components/ui';
import { ConfirmReception } from '../components/ConfirmReception';
import { LiveDeliveryMap } from '../components/LiveDeliveryMap';
import { useToast } from '../context/ToastContext';

export default function TrackingScreen() {
  const { colors, mode, trackStep, activeOrder, reloadOrders } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const enLivraison = activeOrder?.livraison_statut === 'en_livraison';
  const suivi = activeOrder?.suivi ?? null;
  const etaLabel = enLivraison && suivi?.eta_minutes
    ? `Arrive dans ~${suivi.eta_minutes} min`
    : (TRACK_ETA[trackStep] ?? TRACK_ETA[0]);
  // Vraie carte dès que le livreur est en route ET qu'on a une position à afficher.
  const showLiveMap = enLivraison && !!(suivi?.livreur_position || suivi?.destination);

  // ─── Fondu enchaîné entre l'aperçu stylisé (SVG) et la vraie carte ──
  // Les deux calques restent montés le temps du fondu, puis celui qui vient
  // de disparaître se démonte (pas de WebView inutile une fois basculé).
  const mapFade = useRef(new Animated.Value(showLiveMap ? 1 : 0)).current;
  const [renderStyled, setRenderStyled] = useState(!showLiveMap);
  const [renderLive, setRenderLive] = useState(showLiveMap);
  useEffect(() => {
    if (showLiveMap) setRenderLive(true); else setRenderStyled(true);
    Animated.timing(mapFade, {
      toValue: showLiveMap ? 1 : 0, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      if (showLiveMap) setRenderStyled(false); else setRenderLive(false);
    });
  }, [showLiveMap, mapFade]);

  // Rafraîchit dès l'ouverture de l'écran, puis en continu tant qu'il est affiché.
  // useFocusEffect (au lieu de useEffect) garantit un refresh immédiat à chaque
  // fois qu'on revient sur la page, et relance proprement l'intervalle.
  useFocusEffect(
    useCallback(() => {
      reloadOrders();                                   // immédiat
      const id = setInterval(reloadOrders, 5000);       // puis toutes les 5 s (filet de sécurité)
      return () => clearInterval(id);
    }, [reloadOrders]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const ok = await reloadOrders();
      if (!ok) toast.error('Impossible de rafraîchir le suivi. Vérifiez votre connexion.');
    } finally {
      setRefreshing(false);
    }
  }, [reloadOrders, toast]);

  // Ouvre le composeur téléphonique avec le numéro du livreur (nettoyé des espaces).
  const callDriver = useCallback((phone?: string) => {
    const num = (phone || '').replace(/[^\d+]/g, '');
    if (!num) return;
    Linking.openURL(`tel:${num}`).catch(() => {});
  }, []);

  if (!activeOrder) {
    return (
      <ScreenBg><SafeAreaView style={{ flex: 1 }}>
        <CenterMessage
          Icon={PackageSearch} colors={colors}
          title="Aucune commande en cours"
          subtitle="Passez une commande pour suivre votre livraison en direct."
        />
      </SafeAreaView></ScreenBg>
    );
  }

  const orderRef = `#MENU-${activeOrder.id}`;
  const restoName = activeOrder.restaurant_details?.nom ?? 'Restaurant';

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.accent} colors={[Brand.accent]} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <PressableScale onPress={() => router.back()}>
              <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ChevronLeft size={20} color={colors.text} />
              </View>
            </PressableScale>
            <View>
              <Text style={[displayFont(22, '800'), { color: colors.text }]}>Suivi en direct</Text>
              <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 2 }]}>{orderRef} · {restoName}</Text>
            </View>
          </View>

          {/* Carte — vraie carte en direct pendant la livraison, sinon aperçu.
              Fondu enchaîné entre les deux plutôt qu'un basculement brutal. */}
          <View style={[styles.map, { borderColor: colors.border }]}>
            {renderStyled && (
              <Animated.View style={[
                StyleSheet.absoluteFill,
                { opacity: mapFade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
              ]}>
                <LinearGradient colors={['#0f1a13', '#0a120d']} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
                <Svg width="100%" height="100%" viewBox="0 0 340 200" style={StyleSheet.absoluteFill}>
                  <Path d="M40 165 C 110 150, 130 60, 210 60 S 300 45, 305 40" fill="none"
                    stroke={Brand.accent} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="10 12" opacity={0.9} />
                </Svg>
                <View style={styles.startDot} />
                <View style={styles.destWrap}>
                  <PingDot />
                  <MapPin size={20} color={Brand.accent} fill={Brand.accent} strokeWidth={1.5} />
                </View>
                <View style={styles.scooter}>
                  <View style={styles.scooterBadge}><Bike size={24} color="#fff" strokeWidth={2.2} /></View>
                </View>
              </Animated.View>
            )}
            {renderLive && (
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: mapFade }]}>
                <LiveDeliveryMap
                  driver={suivi?.livreur_position ?? null}
                  destination={suivi?.destination ?? null}
                  dark={mode === 'dark'}
                />
              </Animated.View>
            )}
          </View>

          {/* Livreur — infos réelles dès qu'un livreur est assigné */}
          {suivi?.livreur && (
            <View style={[styles.courier, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LinearGradient colors={[Brand.green, Brand.greenDark]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.courierAvatar}>
                <Bike size={24} color="#fff" strokeWidth={2} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[displayFont(15.5, '700'), { color: colors.text }]}>
                  {suivi.livreur.nom || 'Livreur'} · Livreur
                </Text>
                {suivi.livreur.note > 0 && (
                  <View style={[styles.row, { gap: 4, marginTop: 2 }]}>
                    <Star size={12} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
                    <Text style={[bodyFont(12, '700'), { color: Brand.yellow }]}>{suivi.livreur.note.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              {!!suivi.livreur.telephone && (
                <PressableScale onPress={() => callDriver(suivi.livreur!.telephone)}>
                  <View style={[styles.contactBtn, { backgroundColor: Brand.green + '22', borderColor: Brand.green + '55' }]}>
                    <Phone size={18} color="#8fd6a8" strokeWidth={2.2} />
                  </View>
                </PressableScale>
              )}
            </View>
          )}

          {/* Confirmation de réception — visible quand le livreur est en route */}
          {enLivraison && (
            <PressableScale onPress={() => setShowConfirm(true)} style={{ marginTop: 16 }}>
              <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.confirmCta, glow(Brand.accent, 20)]}>
                <QrCode size={20} color="#fff" strokeWidth={2.3} />
                <View style={{ flex: 1 }}>
                  <Text style={[bodyFont(15, '800'), { color: '#fff' }]}>J'ai reçu ma commande</Text>
                  <Text style={[bodyFont(11.5, '600'), { color: '#ffffffcc', marginTop: 1 }]}>Scanner le QR du livreur ou saisir le code</Text>
                </View>
              </LinearGradient>
            </PressableScale>
          )}

          {/* Progression */}
          <View style={[styles.progress, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Text style={[displayFont(16, '700'), { color: colors.text, flex: 1 }]}>Progression</Text>
              <Text style={[bodyFont(13, '800'), { color: Brand.accentLight }]}>{etaLabel}</Text>
            </View>

            <View style={{ marginTop: 16 }}>
              {TRACK_STEPS.map((step, i) => {
                const done = i < trackStep;
                const active = i === trackStep;
                const last = i === TRACK_STEPS.length - 1;
                const dotBg = done ? Brand.green : active ? Brand.accent : colors.surface2;
                const dotBorder = done ? Brand.green : active ? Brand.accent : colors.border;
                const titleColor = done || active ? colors.text : colors.faint;
                return (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepAxis}>
                      <TimelineDot done={done} active={active} dotBg={dotBg} dotBorder={dotBorder} />
                      {!last && <View style={[styles.line, { backgroundColor: done ? Brand.green : colors.border }]} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 16 }}>
                      <Text style={[bodyFont(14.5, '700'), { color: titleColor }]}>{step.title}</Text>
                      <Text style={[bodyFont(12, '500'), { color: colors.faint, marginTop: 2 }]}>{step.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {activeOrder && (
        <ConfirmReception
          visible={showConfirm}
          orderId={activeOrder.id}
          onClose={() => setShowConfirm(false)}
          onConfirmed={async () => {
            setShowConfirm(false);
            // Recharge avant de quitter : la page Profil (liste « Mes commandes »)
            // doit déjà voir la commande comme livrée à son arrivée.
            await reloadOrders();
            router.replace('/profil');
            toast.success('Commande livrée avec succès !');
          }}
        />
      )}
    </ScreenBg>
  );
}

/** Anneau qui pulse (radar) sur le point de destination — signale un suivi « en direct ». */
function PingDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return <Animated.View style={[styles.destPing, { opacity, transform: [{ scale }] }]} />;
}

/** Point de la timeline — celui de l'étape active pulse (anneau qui se dilate en boucle). */
function TimelineDot({ done, active, dotBg, dotBorder }: {
  done: boolean; active: boolean; dotBg: string; dotBorder: string;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.dotWrap}>
      {active && (
        <Animated.View
          pointerEvents="none"
          style={[styles.dotRing, { borderColor: Brand.accent, opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
        />
      )}
      <View style={[
        styles.dot,
        { backgroundColor: dotBg, borderColor: dotBorder },
        active && { shadowColor: Brand.accent, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
      ]}>
        {done && <Check size={15} color="#fff" strokeWidth={3} />}
        {active && <View style={styles.activeDot} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  map: { height: 196, borderRadius: 26, marginTop: 18, overflow: 'hidden', borderWidth: 1 },
  startDot: {
    position: 'absolute', left: 26, bottom: 20, width: 20, height: 20, borderRadius: 10,
    backgroundColor: Brand.green, borderWidth: 5, borderColor: Brand.green + '33',
  },
  destWrap: { position: 'absolute', right: 22, top: 24, alignItems: 'center', justifyContent: 'center' },
  destPing: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: Brand.accent, opacity: 0.4 },
  scooter: { position: 'absolute', left: '50%', top: '50%', marginLeft: -22, marginTop: -22 },
  scooterBadge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  courier: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, borderWidth: 1, marginTop: 16 },
  courierAvatar: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  contactBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmCta: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 18, borderRadius: Radius.pill },
  progress: { padding: 18, borderRadius: 24, borderWidth: 1, marginTop: 16 },
  stepRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepAxis: { alignItems: 'center', alignSelf: 'stretch' },
  dotWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dotRing: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2 },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  line: { width: 2.5, flex: 1, minHeight: 24, marginVertical: 2, borderRadius: 2 },
});
