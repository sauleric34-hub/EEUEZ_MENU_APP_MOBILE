import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, glowSubtle } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.80;
const CLOSE_DURATION = 230;
const OPEN_DURATION = 290;

export interface DrawerItem {
  key: string;
  label: string;
  icon: string;
  badge?: number;
  section?: string;
  danger?: boolean;
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: DrawerItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  headerTitle: string;
  headerSubtitle: string;
  headerEmoji: string;
  accentColor: string;
  accentBg: string;
}

export default function DrawerMenu({
  isOpen, onClose, items, activeKey, onNavigate,
  headerTitle, headerSubtitle, headerEmoji, accentColor, accentBg
}: DrawerProps) {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  // isVisible reste true pendant l'animation de fermeture pour capturer les touches
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 1. Rendre visible d'abord, PUIS animer
      setIsVisible(true);
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0, tension: 85, friction: 11, useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0.65, duration: OPEN_DURATION, useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animer, PUIS cacher pour laisser l'animation se terminer
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH, duration: CLOSE_DURATION, useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0, duration: CLOSE_DURATION, useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setIsVisible(false);
      });
    }
  }, [isOpen]);

  const handleNavigate = (key: string) => { onNavigate(key); onClose(); };

  if (!isVisible) return null;

  const renderItems = () => {
    const result: JSX.Element[] = [];
    let currentSection = '';
    items.forEach((item, idx) => {
      if (item.section && item.section !== currentSection) {
        currentSection = item.section;
        if (idx > 0) result.push(<View key={`div-${idx}`} style={styles.divider} />);
        result.push(<Text key={`sec-${idx}`} style={styles.sectionLabel}>{item.section}</Text>);
      }
      const isActive = item.key === activeKey;
      result.push(
        <TouchableOpacity
          key={item.key}
          style={[styles.item, isActive && { backgroundColor: accentBg }]}
          onPress={() => handleNavigate(item.key)}
          activeOpacity={0.7}
        >
          <Text style={styles.itemIcon}>{item.icon}</Text>
          <Text style={[
            styles.itemLabel,
            isActive && { color: accentColor, fontWeight: '700' },
            item.danger && { color: Colors.danger },
          ]}>
            {item.label}
          </Text>
          {item.badge !== undefined && item.badge > 0 && (
            <View style={[styles.badge, { backgroundColor: accentColor }]}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          )}
          {isActive && <View style={[styles.activeBar, { backgroundColor: accentColor }]} />}
        </TouchableOpacity>
      );
    });
    return result;
  };

  return (
    // ─── CONTENEUR UNIQUE : couvre tout l'écran, elevation pour Android
    <View
      style={styles.root}
      pointerEvents="box-none"  // Le conteneur lui-même ne bloque pas, mais ses enfants oui
    >
      {/* ─── OVERLAY : appui → fermeture ─────────────────────────────── */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={onClose}
        activeOpacity={1}
      >
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: overlayOpacity }]}
        />
      </TouchableOpacity>

      {/* ─── PANNEAU DRAWER ───────────────────────────────────────────── */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
        <SafeAreaView style={{ flex: 1 }}>

          {/* En-tête */}
          <View style={[styles.drawerHeader, { borderBottomColor: accentColor + '25' }]}>
            <View style={[styles.avatarCircle, { backgroundColor: accentBg }, glowSubtle(accentColor)]}>
              <Text style={styles.avatarEmoji}>{headerEmoji}</Text>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={styles.headerName} numberOfLines={1}>{headerTitle}</Text>
              <Text style={styles.headerRole}>{headerSubtitle}</Text>
            </View>
            {/* Bouton fermeture */}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Items */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {renderItems()}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerLogo, { color: accentColor }]}>EEUEZ</Text>
            <Text style={styles.footerTag}>Menu · v1.0 Bêta</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── CONTENEUR RACINE ─────────────────────────────────────────────────────
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,         // iOS / web
    elevation: 999,       // Android : obligatoire pour passer au-dessus de tout
  },
  // ─── PANEL ────────────────────────────────────────────────────────────────
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: Colors.bg.app,
    borderRightWidth: 1,
    borderRightColor: Colors.glass.border,
    // Ombre portée côté droit
    shadowColor: '#000',
    shadowOffset: { width: 12, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 30,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 22 },
  headerName: { ...Typography.bodyBold, fontSize: 15, color: Colors.text.primary },
  headerRole: { ...Typography.caption, color: Colors.text.secondary, marginTop: 2, fontSize: 11 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.glass.bg,
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: Colors.text.secondary, fontSize: 14, fontWeight: '700' },
  // ─── ITEMS ────────────────────────────────────────────────────────────────
  sectionLabel: {
    ...Typography.label,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginHorizontal: 20, marginVertical: 4 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 13,
    marginHorizontal: 8, borderRadius: Radius.md, marginBottom: 2,
    position: 'relative',
  },
  itemIcon: { fontSize: 18, width: 28 },
  itemLabel: { ...Typography.body, color: Colors.text.secondary, marginLeft: 12, flex: 1 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  activeBar: { position: 'absolute', right: 0, top: '20%', width: 3, height: '60%', borderRadius: 2 },
  // ─── FOOTER ───────────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: Colors.border.default,
    alignItems: 'center',
  },
  footerLogo: { fontSize: 18, fontWeight: '900', letterSpacing: 4 },
  footerTag: { ...Typography.caption, marginTop: 3 },
});
