import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, Modal, ScrollView,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, glow } from '../constants/theme';
import { PressableScale, ConfettiBurst, EmojiPop, useButtonPress } from '../components/Animations';

interface Plat {
  id: string;
  nom: string;
  description?: string;
  prix: number;
  isPopulaire?: boolean;
  isVegetarien?: boolean;
  tempsPreparation?: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  plat?: Plat | null;
  onAddToCart?: (plat: Plat, qty: number) => void;
}

export default function ProductDetailModal({ visible, onClose, plat, onAddToCart }: Props) {
  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(0);
  const { confettiVisible, emojiVisible, emoji, triggerSuccess } = useButtonPress();
  const slideUp = useRef(new Animated.Value(700)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setQty(1);
      setRating(0);
      Animated.parallel([
        Animated.spring(slideUp, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.timing(fadeIn, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideUp, { toValue: 700, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeIn, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!plat) return null;

  const handleAdd = () => {
    triggerSuccess('🛒');
    setTimeout(() => {
      onAddToCart?.(plat, qty);
      onClose();
    }, 600);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.overlay, { opacity: fadeIn }]}>
        <PressableScale onPress={onClose} style={{ flex: 1 }}>
          <View style={{ flex: 1 }} />
        </PressableScale>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideUp }] }]}>

          {/* Handle */}
          <View style={s.handle} />

          {/* Confetti + Emoji */}
          <View style={{ position: 'absolute', top: 20, alignSelf: 'center', zIndex: 100 }}>
            <ConfettiBurst visible={confettiVisible} />
            <EmojiPop emoji={emoji} visible={emojiVisible} size={40} />
          </View>

          {/* Close */}
          <View style={s.sheetHeader}>
            <View />
            <PressableScale onPress={onClose}>
              <View style={s.closeBtn}><Text style={s.closeText}>✕</Text></View>
            </PressableScale>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Hero emoji */}
            <View style={s.platHero}>
              <View style={s.platEmojiBox}>
                <Text style={{ fontSize: 64 }}>🍽️</Text>
              </View>
              {plat.isPopulaire && (
                <View style={s.popularBadge}>
                  <Text style={s.popularText}>⭐ Plat populaire</Text>
                </View>
              )}
            </View>

            {/* Infos */}
            <View style={s.infoBox}>
              <Text style={s.platNom}>{plat.nom}</Text>
              <View style={s.metaRow}>
                {plat.tempsPreparation && (
                  <View style={s.metaChip}><Text style={s.metaText}>⏱ {plat.tempsPreparation} min</Text></View>
                )}
                {plat.isVegetarien && (
                  <View style={s.metaChip}><Text style={s.metaText}>🥦 Végétarien</Text></View>
                )}
              </View>
              {plat.description && <Text style={s.platDesc}>{plat.description}</Text>}
            </View>

            {/* Avis */}
            <View style={s.avisBox}>
              <Text style={s.avisTitle}>⭐ Votre avis</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <PressableScale key={n} onPress={() => setRating(n)}>
                    <Text style={{ fontSize: 28 }}>{n <= rating ? '⭐' : '☆'}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* CTA */}
          <View style={s.ctaBox}>
            <View style={s.qtyRow}>
              <PressableScale onPress={() => setQty(q => Math.max(1, q - 1))}>
                <View style={s.qtyBtn}><Text style={s.qtyBtnText}>−</Text></View>
              </PressableScale>
              <Text style={s.qtyText}>{qty}</Text>
              <PressableScale onPress={() => setQty(q => q + 1)}>
                <View style={[s.qtyBtn, { backgroundColor: Colors.client.bg, borderColor: Colors.client.primary }]}>
                  <Text style={[s.qtyBtnText, { color: Colors.client.primary }]}>+</Text>
                </View>
              </PressableScale>
            </View>
            <PressableScale onPress={handleAdd} style={{ flex: 1 }}>
              <View style={[s.addBtn, glow(Colors.client.glow, 12)]}>
                <Text style={s.addBtnText}>
                  🛒 Ajouter — {((plat.prix ?? 0) * qty).toLocaleString()} FCFA
                </Text>
              </View>
            </PressableScale>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: Colors.bg.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '85%', borderTopWidth: 1, borderTopColor: Colors.border.default },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border.default, alignSelf: 'center', marginTop: 12 },
  sheetHeader:  { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: 8 },
  closeBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  closeText:    { color: Colors.text.secondary, fontWeight: '700' },
  platHero:     { alignItems: 'center', paddingVertical: Spacing.lg, gap: 12 },
  platEmojiBox: { width: 120, height: 120, borderRadius: 36, backgroundColor: Colors.restaurant.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.restaurant.primary + '44' },
  popularBadge: { backgroundColor: Colors.livreur.bg, paddingHorizontal: 14, paddingVertical: 5, borderRadius: Radius.full },
  popularText:  { fontSize: 12, fontWeight: '800', color: Colors.livreur.primary },
  infoBox:      { paddingHorizontal: Spacing.lg, gap: 8, marginBottom: Spacing.md },
  platNom:      { ...Typography.h2 },
  metaRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip:     { backgroundColor: Colors.bg.elevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border.default },
  metaText:     { ...Typography.small, fontWeight: '700' },
  platDesc:     { ...Typography.body, lineHeight: 22 },
  avisBox:      { paddingHorizontal: Spacing.lg, gap: 10, marginBottom: Spacing.md },
  avisTitle:    { ...Typography.h3, fontSize: 16 },
  starsRow:     { flexDirection: 'row', gap: 6 },
  ctaBox:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, paddingBottom: 28, backgroundColor: Colors.bg.surface, borderTopWidth: 1, borderTopColor: Colors.border.default },
  qtyRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg.elevated, borderRadius: Radius.lg, paddingHorizontal: 10, paddingVertical: 8 },
  qtyBtn:       { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Colors.border.default, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg.surface },
  qtyBtnText:   { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  qtyText:      { ...Typography.h3, minWidth: 24, textAlign: 'center' },
  addBtn:       { backgroundColor: Colors.client.primary, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  addBtnText:   { color: Colors.bg.app, fontWeight: '900', fontSize: 15 },
});
