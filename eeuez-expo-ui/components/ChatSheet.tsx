// Bottom sheet de discussion avec le restaurant
import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { X, Send } from 'lucide-react-native';
import { Brand, Radius } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { type LucideIcon } from 'lucide-react-native';
import { DishTile, displayFont, bodyFont } from './ui';
import { type Gradient } from '../data/menuData';

interface ChatSheetProps {
  visible: boolean;
  onClose: () => void;
  restoName: string;
  Icon: LucideIcon;
  grad: Gradient;
}

export function ChatSheet({ visible, onClose, restoName, Icon, grad }: ChatSheetProps) {
  const { colors } = useApp();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.page, borderColor: colors.border }]} onPress={() => {}}>
          <View style={[styles.grab, { backgroundColor: colors.border }]} />
          <View style={styles.head}>
            <DishTile Icon={Icon} grad={grad} size={46} iconSize={22} radius={14} />
            <View style={{ flex: 1 }}>
              <Text style={[displayFont(16, '700'), { color: colors.text }]}>{restoName}</Text>
              <Text style={[bodyFont(11.5, '700'), { color: Brand.green, marginTop: 2 }]}>● En ligne</Text>
            </View>
            <Pressable onPress={onClose} style={[styles.close, { backgroundColor: colors.surface }]}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={{ gap: 10, marginTop: 18 }}>
            <View style={[styles.bubbleIn, { backgroundColor: colors.surface2 }]}>
              <Text style={[bodyFont(13.5, '500'), { color: colors.text }]}>Bonjour ! Bienvenue chez nous. Comment pouvons-nous vous aider ?</Text>
            </View>
            <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubbleOut}>
              <Text style={[bodyFont(13.5, '500'), { color: '#fff' }]}>Bonjour, mon plat sera prêt dans combien de temps ?</Text>
            </LinearGradient>
            <View style={[styles.bubbleIn, { backgroundColor: colors.surface2 }]}>
              <Text style={[bodyFont(13.5, '500'), { color: colors.text }]}>Dans 15 minutes environ. Merci de votre patience !</Text>
            </View>
          </View>

          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[bodyFont(14, '500'), { color: colors.faint, flex: 1 }]}>Écrire un message…</Text>
            <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtn}>
              <Send size={18} color="#fff" strokeWidth={2.4} />
            </LinearGradient>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, borderTopWidth: 1, padding: 18, paddingBottom: 30 },
  grab: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bubbleIn: { alignSelf: 'flex-start', maxWidth: '80%', padding: 12, borderRadius: 18, borderBottomLeftRadius: 4 },
  bubbleOut: { alignSelf: 'flex-end', maxWidth: '80%', padding: 12, borderRadius: 18, borderBottomRightRadius: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
    paddingLeft: 18, paddingRight: 8, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
