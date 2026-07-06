// ═══════════════════════════════════════════════════════════
//  Layout client — barre de navigation personnalisée (6 onglets)
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  House, UtensilsCrossed, Navigation, ShoppingCart, Heart, User,
  type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { PressableScale, bodyFont } from '../../components/ui';

interface NavDef { route: string; label: string; Icon: LucideIcon; }
const NAV: NavDef[] = [
  { route: 'index',   label: 'Accueil', Icon: House },
  { route: 'plats',   label: 'Plats',   Icon: UtensilsCrossed },
  { route: 'carte',   label: 'Carte',   Icon: Navigation },
  { route: 'panier',  label: 'Panier',  Icon: ShoppingCart },
  { route: 'favoris', label: 'Favoris', Icon: Heart },
  { route: 'profil',  label: 'Profil',  Icon: User },
];
// L'onglet Accueil reste actif sur les sous-écrans plat/resto
const HOME_GROUP = new Set(['index', 'dish', 'resto']);

function BottomNav({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, cartCount } = useApp();
  const current = state.routes[state.index]?.name ?? 'index';

  return (
    <View style={[
      styles.bar,
      {
        backgroundColor: colors.nav,
        borderTopColor: colors.navBorder,
        paddingBottom: Math.max(insets.bottom, 12),
        height: 66 + Math.max(insets.bottom, 12),
      },
    ]}>
      {NAV.map(({ route, label, Icon }) => {
        const active = current === route || (route === 'index' && HOME_GROUP.has(current));
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route, canPreventDefault: true });
          if (!event.defaultPrevented) navigation.navigate(route);
        };
        const showBadge = route === 'panier' && cartCount > 0;
        return (
          <PressableScale key={route} onPress={onPress} style={styles.item} scaleTo={0.88}>
            <View style={[styles.pill, active && { backgroundColor: Brand.accent + '22' }]}>
              <Icon size={21} color={active ? Brand.accentLight : colors.faint} strokeWidth={active ? 2.5 : 2} />
              {showBadge && (
                <View style={[styles.badge, { borderColor: colors.nav }]}>
                  <Text style={styles.badgeTxt}>{cartCount}</Text>
                </View>
              )}
            </View>
            <Text style={[bodyFont(10, active ? '800' : '600'), { color: active ? Brand.accentLight : colors.faint }]}>
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export default function ClientLayout() {
  return (
    <Tabs tabBar={props => <BottomNav {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="plats" />
      <Tabs.Screen name="carte" />
      <Tabs.Screen name="panier" />
      <Tabs.Screen name="favoris" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 9,
    borderTopWidth: 1,
  },
  item: { alignItems: 'center', gap: 3, flex: 1 },
  pill: {
    width: 46, height: 32, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -3, right: 4,
    minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8,
    backgroundColor: Brand.accent, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
});
