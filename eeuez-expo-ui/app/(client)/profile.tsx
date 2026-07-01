import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Animated, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow } from '../../constants/theme';
import { PressableScale } from '../../components/Animations';
import { MOCK_CLIENT } from '../../data/mockData';
import {
  User, MapPinned, CreditCard, Package, Star, Bell, Globe,
  MessageCircle, FileText, DoorOpen, ChevronRight, Edit3,
  ShoppingBag, DollarSign,
} from 'lucide-react-native';

const STATS = [
  { label: 'Commandes', value: '42', icon: <Package size={22} color={Colors.client.primary} /> },
  { label: 'Avis donnés', value: '18', icon: <Star size={22} color={Colors.livreur.primary} /> },
  { label: 'FCFA dépensés', value: '184 500', icon: <DollarSign size={22} color={Colors.restaurant.primary} /> },
];

const MENU_ICON_MAP: Record<string, React.ReactNode> = {
  adresses:      <MapPinned   size={22} color={Colors.text.secondary} />,
  paiements:     <CreditCard  size={22} color={Colors.text.secondary} />,
  commandes:     <Package     size={22} color={Colors.text.secondary} />,
  avis:          <Star        size={22} color={Colors.text.secondary} />,
  notifications: <Bell        size={22} color={Colors.text.secondary} />,
  langue:        <Globe       size={22} color={Colors.text.secondary} />,
  aide:          <MessageCircle size={22} color={Colors.text.secondary} />,
  cgu:           <FileText    size={22} color={Colors.text.secondary} />,
  deconnexion:   <DoorOpen   size={22} color={Colors.danger} />,
};

const MENU_ITEMS = [
  { key: 'adresses',      label: 'Mes adresses',        section: 'Mon compte' },
  { key: 'paiements',     label: 'Méthodes de paiement' },
  { key: 'commandes',     label: 'Historique commandes', section: 'Activité' },
  { key: 'avis',          label: 'Mes avis' },
  { key: 'notifications', label: 'Notifications',        section: 'Préférences' },
  { key: 'langue',        label: 'Langue' },
  { key: 'aide',          label: 'Aide & Support',       section: 'Support' },
  { key: 'cgu',           label: 'CGU & Confidentialité' },
  { key: 'deconnexion',   label: 'Se déconnecter',       danger: true },
];

export default function ProfileScreen() {
  const router = useRouter();
  const fadeIn   = useRef(new Animated.Value(0)).current;
  const slideIn  = useRef(new Animated.Value(-30)).current;
  const statsAnim = useRef([0, 0, 0].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(slideIn, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      ]),
      Animated.stagger(100, statsAnim.map(a =>
        Animated.spring(a, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true })
      )),
    ]).start();
  }, []);

  let lastSection = '';

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>

          {/* Avatar + infos */}
          <Animated.View style={[s.hero, { opacity: fadeIn, transform: [{ translateY: slideIn }] }]}>
            <View style={s.avatar}>
              <User size={40} color={Colors.client.primary} />
            </View>
            <Text style={s.userName}>{MOCK_CLIENT.prenom} {MOCK_CLIENT.nom}</Text>
            <Text style={s.userEmail}>{MOCK_CLIENT.email}</Text>
            <Text style={s.userPhone}>{MOCK_CLIENT.telephone}</Text>
            <PressableScale onPress={() => {}}>
              <View style={[s.editBtn, { borderColor: Colors.client.primary, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <Edit3 size={14} color={Colors.client.primary} />
                <Text style={[s.editBtnText, { color: Colors.client.primary }]}>Modifier le profil</Text>
              </View>
            </PressableScale>
          </Animated.View>

          {/* Stats */}
          <View style={s.statsRow}>
            {STATS.map((stat, i) => (
              <Animated.View key={stat.label} style={[s.statCard, {
                opacity: statsAnim[i],
                transform: [{ scale: statsAnim[i].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }]
              }]}>
                {stat.icon}
                <Text style={s.statVal}>{stat.value}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Menu */}
          {MENU_ITEMS.map(item => {
            const showSection = item.section && item.section !== lastSection;
            if (showSection) lastSection = item.section!;
            const iconNode = MENU_ICON_MAP[item.key];
            return (
              <React.Fragment key={item.key}>
                {showSection && <Text style={s.sectionTitle}>{item.section}</Text>}
                <PressableScale onPress={() => item.key === 'deconnexion' ? router.push('/') : null}>
                  <View style={[s.menuItem, (item as any).danger && { borderColor: Colors.danger + '33' }]}>
                    {iconNode}
                    <Text style={[s.menuLabel, (item as any).danger && { color: Colors.danger }]}>{item.label}</Text>
                    <ChevronRight size={18} color={Colors.text.muted} />
                  </View>
                </PressableScale>
              </React.Fragment>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg.app },
  hero:        { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: 8 },
  avatar:      { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.client.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.client.primary },
  userName:    { ...Typography.h2 },
  userEmail:   { ...Typography.small, color: Colors.text.secondary },
  userPhone:   { ...Typography.small },
  editBtn:     { marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  editBtnText: { fontWeight: '700', fontSize: 14 },
  statsRow:    { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: Spacing.md, marginBottom: Spacing.lg, gap: 10 },
  statCard:    { flex: 1, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border.default },
  statVal:     { ...Typography.h3, fontSize: 17 },
  statLabel:   { ...Typography.caption, textAlign: 'center' },
  sectionTitle:{ ...Typography.label, paddingHorizontal: Spacing.md, marginTop: Spacing.lg, marginBottom: 8, color: Colors.text.muted },
  menuItem:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, marginBottom: 8, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border.default, gap: 14 },
  menuLabel:   { flex: 1, ...Typography.bodyBold, fontSize: 15 },
  menuArrow:   { fontSize: 22, color: Colors.text.muted },
});
