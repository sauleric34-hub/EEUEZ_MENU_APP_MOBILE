import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Animated, Modal,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, glow } from '../constants/theme';
import { PressableScale, PulseRing } from '../components/Animations';
import {
  CheckCircle2, ChefHat, Bike, MapPin, PartyPopper, Phone, X
} from 'lucide-react-native';

const ETAPES = [
  { key: 'acceptee',        label: 'Commande acceptée',     icon: (c: string) => <CheckCircle2 size={16} color={c} />, done: true },
  { key: 'en_preparation',  label: 'En préparation',        icon: (c: string) => <ChefHat size={16} color={c} />, done: true },
  { key: 'livreur_assigne', label: 'Livreur assigné',       icon: (c: string) => <Bike size={16} color={c} />, done: false, active: true },
  { key: 'en_livraison',    label: 'En chemin chez vous',   icon: (c: string) => <MapPin size={16} color={c} />, done: false },
  { key: 'livree',          label: 'Livraison terminée',    icon: (c: string) => <PartyPopper size={16} color={c} />, done: false },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  commandeId?: string;
}

export default function DeliveryTrackingModal({ visible, onClose, commandeId }: Props) {
  const [eta, setEta] = useState(12);
  const slideUp  = useRef(new Animated.Value(600)).current;
  const fadeIn   = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideUp, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.parallel([
        Animated.timing(slideUp, { toValue: 600, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeIn, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: fadeIn }]}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideUp }] }]}>

          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MapPin size={22} color={Colors.text.primary} />
              <Text style={s.title}>Suivi de livraison</Text>
            </View>
            <PressableScale onPress={onClose}>
              <View style={s.closeBtn}><X size={18} color={Colors.text.secondary} /></View>
            </PressableScale>
          </View>

          {/* ETA */}
          <View style={s.etaRow}>
            <PulseRing color={Colors.client.primary} size={70}>
              <Animated.View style={[s.etaCircle, { transform: [{ scale: pulseAnim }] }]}>
                <Bike size={28} color={Colors.client.primary} />
              </Animated.View>
            </PulseRing>
            <View style={s.etaInfo}>
              <Text style={s.etaLabel}>Arrivée estimée</Text>
              <Text style={s.etaTime}>{eta} min</Text>
              {commandeId && <Text style={s.etaCmd}>Commande #{commandeId.slice(0, 6)}</Text>}
            </View>
          </View>

          {/* Étapes */}
          <View style={s.etapesBox}>
            {ETAPES.map((etape) => (
              <View key={etape.key} style={s.etapeRow}>
                <View style={[
                  s.etapeDot,
                  etape.done && { backgroundColor: Colors.client.primary },
                  etape.active && { backgroundColor: Colors.livreur.primary, ...glow(Colors.livreur.glow, 6) },
                ]}>
                  {etape.icon(etape.done ? Colors.bg.app : etape.active ? Colors.bg.app : Colors.text.muted)}
                </View>
                <Text style={[
                  s.etapeLabel,
                  etape.done && { color: Colors.client.primary },
                  etape.active && { color: Colors.livreur.primary, fontWeight: '700' },
                ]}>
                  {etape.label}
                </Text>
                {etape.active && <View style={s.liveDot} />}
              </View>
            ))}
          </View>

          {/* Livreur */}
          <View style={s.livreurRow}>
            <View style={s.livreurIcon}>
              <Bike size={24} color={Colors.bg.app} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.livreurNom}>Koffi Mensah</Text>
              <Text style={s.livreurInfo}>⭐ 4.9 · Yamaha YD-5678-A</Text>
            </View>
            <PressableScale onPress={() => {}}>
              <View style={[s.callBtn, glow(Colors.client.glow, 6)]}>
                <Phone size={20} color={Colors.bg.app} />
              </View>
            </PressableScale>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: Colors.bg.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.lg, paddingBottom: 40, gap: 16, borderTopWidth: 1, borderTopColor: Colors.border.default },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border.default, alignSelf: 'center', marginBottom: 8 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:        { ...Typography.h3 },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  closeText:    { color: Colors.text.secondary, fontWeight: '700' },
  etaRow:       { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: Colors.bg.elevated, borderRadius: Radius.xl, padding: Spacing.md },
  etaCircle:    { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.client.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.client.primary },
  etaInfo:      { flex: 1, gap: 4 },
  etaLabel:     { ...Typography.small },
  etaTime:      { fontSize: 36, fontWeight: '900', color: Colors.client.primary, letterSpacing: -1 },
  etaCmd:       { ...Typography.small },
  etapesBox:    { gap: 10 },
  etapeRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  etapeDot:     { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  etapeLabel:   { flex: 1, ...Typography.body, color: Colors.text.secondary },
  liveDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  livreurRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg.elevated, borderRadius: Radius.xl, padding: Spacing.md },
  livreurIcon:  { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.livreur.bg, justifyContent: 'center', alignItems: 'center' },
  livreurNom:   { ...Typography.bodyBold },
  livreurInfo:  { ...Typography.small, marginTop: 2 },
  callBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.client.primary, justifyContent: 'center', alignItems: 'center' },
  callBtnText:  { fontSize: 20 },
});
