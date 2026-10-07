// ═══════════════════════════════════════════════════════════
//  Layout Restaurant — espace gérant / cuisine
//  3 onglets : Tableau de bord · Cuisine (KDS) · Commandes
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, ChefHat, ClipboardList, type LucideIcon } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { PressableScale, bodyFont } from '../../components/ui';

interface NavDef { route: string; label: string; Icon: LucideIcon; }
const NAV: NavDef[] = [
  { route: 'index',    label: 'Dashboard', Icon: LayoutDashboard },
  { route: 'cuisine',  label: 'Cuisine',   Icon: ChefHat },
  { route: 'commandes',label: 'Commandes', Icon: ClipboardList },
];

function BottomNav({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useApp();
  const current = state.routes[state.index]?.name ?? 'index';

  return (
    <View style={[styles.bar, {
      backgroundColor: colors.nav, borderTopColor: colors.navBorder,
      paddingBottom: Math.max(insets.bottom, 12),
      height: 66 + Math.max(insets.bottom, 12),
    }]}>
      {NAV.map(({ route, label, Icon }) => {
        const active = route === current;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route, canPreventDefault: true });
          if (!event.defaultPrevented) navigation.navigate(route);
        };
        return (
          <View key={route} style={styles.item}>
            <PressableScale onPress={onPress} scaleTo={0.88} style={{ alignItems: 'center', gap: 3 }}>
              <View style={[styles.pill, active && { backgroundColor: Brand.accent + '22' }]}>
                <Icon size={21} color={active ? Brand.accentLight : colors.faint} strokeWidth={active ? 2.5 : 2} />
              </View>
              <Text style={[bodyFont(10, active ? '800' : '600'), { color: active ? Brand.accentLight : colors.faint, textAlign: 'center' }]}>
                {label}
              </Text>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

export default function RestaurantLayout() {
  const { user, authReady } = useApp();

  if (authReady && !user) return <Redirect href="/" />;
  // Seuls les comptes restaurant y ont accès
  if (authReady && user && user.role !== 'restaurant') return <Redirect href="/(client)" />;

  return (
    <Tabs tabBar={props => <BottomNav {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="cuisine" />
      <Tabs.Screen name="commandes" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingTop: 9, borderTopWidth: 1,
  },
  item: { flex: 1, alignItems: 'center' },
  pill: {
    width: 46, height: 32, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
});
