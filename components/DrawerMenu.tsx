import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, glowSubtle } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.80;
const CLOSE_DURATION = 230;
const OPEN_DURATION = 290;

export interface DrawerItem {
  key: string;
  label: string;
  icon: any;        // Remplacer string par any pour supporter les composants Lucide
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
  headerIcon: any;   // Remplacer headerEmoji par headerIcon
  accentColor: string;
  accentBg: string;
}

export default function DrawerMenu({
  isOpen, onClose, items, activeKey, onNavigate,
  headerTitle, headerSubtitle, headerIcon: HeaderIcon, accentColor, accentBg
}: DrawerProps) {
  const { theme, toggleTheme, colors } = useTheme();
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
    const result: any[] = [];
    let currentSection = '';
    items.forEach((item, idx) => {
      if (item.section && item.section !== currentSection) {
        currentSection = item.section;
        if (idx > 0) result.push(<View key={`div-${idx}`} style={[styles.divider, { backgroundColor: colors.border.subtle }]} />);
        result.push(<Text key={`sec-${idx}`} style={[styles.sectionLabel, { color: colors.text.muted }]}>{item.section}</Text>);
      }
      const isActive = item.key === activeKey;
      const Icon = item.icon;
      result.push(
        <TouchableOpacity
          key={item.key}
          style={[styles.item, isActive && { backgroundColor: accentBg }]}
          onPress={() => handleNavigate(item.key)}
          activeOpacity={0.7}
        >
          <View style={styles.itemIconContainer}>
            <Icon size={20} color={isActive ? accentColor : item.danger ? colors.danger : colors.text.secondary} />
          </View>
          <Text style={[
            styles.itemLabel,
            { color: colors.text.primary },
            isActive && { color: accentColor, fontWeight: '700' },
            item.danger && { color: colors.danger },
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
      <Animated.View style={[styles.drawer, { transform: [{ translateX }], backgroundColor: colors.bg.app, borderRightColor: colors.border.default }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg.app} />
        <SafeAreaView style={{ flex: 1 }}>

          {/* En-tête */}
          <View style={[styles.drawerHeader, { borderBottomColor: accentColor + '25' }]}>
            <View style={[styles.avatarCircle, { backgroundColor: accentBg, borderColor: colors.border.default }]}>
              <HeaderIcon size={24} color={accentColor} />
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={[styles.headerName, { color: colors.text.primary }]} numberOfLines={1}>{headerTitle}</Text>
              <Text style={[styles.headerRole, { color: accentColor }]}>{headerSubtitle}</Text>
            </View>
            {/* Bouton fermeture */}
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.bg.surface }]} activeOpacity={0.7}>
              <Text style={[styles.closeBtnText, { color: colors.text.primary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Sélecteur de Thème */}
          <View style={styles.themeToggleSection}>
            <Text style={[styles.sectionLabel, { paddingTop: 0 }]}>Apparence</Text>
            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}
              onPress={toggleTheme}
              activeOpacity={0.8}
            >
              <View style={styles.row}>
                {theme === 'dark' ? <Moon size={18} color={colors.primary} /> : <Sun size={18} color={colors.primary} />}
                <Text style={[styles.themeBtnText, { color: colors.text.primary }]}>
                  {theme === 'dark' ? 'Mode Luxe Sombre' : 'Mode Luxe Clair'}
                </Text>
              </View>
              <View style={[styles.toggleSwitch, { backgroundColor: colors.bg.elevated }]}>
                <View style={[styles.toggleDot, {
                  backgroundColor: colors.primary,
                  alignSelf: theme === 'dark' ? 'flex-end' : 'flex-start'
                }]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Items */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {renderItems()}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border.subtle }]}>
            <Text style={[styles.footerLogo, { color: accentColor }]}>EEUEZ</Text>
            <Text style={[styles.footerTag, { color: colors.text.muted }]}>Menu · v1.0 Bêta</Text>
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
    borderRightWidth: 1,
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 30,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
  },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerName: { ...Typography.h3, fontSize: 17 },
  headerRole: { ...Typography.caption, marginTop: 2, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700' },
  sectionLabel: {
    ...Typography.caption,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    letterSpacing: 1.5, fontWeight: '800',
  },
  divider: { height: 1, marginHorizontal: 20, marginVertical: 6, opacity: 0.5 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    marginHorizontal: 12, borderRadius: Radius.lg, marginBottom: 4,
    position: 'relative',
  },
  itemIconContainer: { width: 28, alignItems: 'center' },
  itemLabel: { ...Typography.body, marginLeft: 12, flex: 1 },
  // Thème Toggle
  themeToggleSection: { paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  themeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, borderRadius: Radius.lg, borderWidth: 1,
  },
  themeBtnText: { ...Typography.bodyBold, fontSize: 14, marginLeft: 10 },
  toggleSwitch: { width: 40, height: 22, borderRadius: 11, padding: 2, justifyContent: 'center' },
  toggleDot: { width: 18, height: 18, borderRadius: 9 },
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  activeBar: { position: 'absolute', left: 0, top: '25%', width: 3, height: '50%', borderRadius: 2 },
  footer: {
    paddingHorizontal: 20, paddingVertical: 24,
    borderTopWidth: 1,
    alignItems: 'center', gap: 4,
  },
  footerLogo: { fontSize: 20, fontWeight: '900', letterSpacing: 4 },
  footerTag: { ...Typography.caption, fontSize: 10, letterSpacing: 1 },
});
