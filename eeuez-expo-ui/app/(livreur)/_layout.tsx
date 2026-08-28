// ═══════════════════════════════════════════════════════════
//  Layout livreur — 4 onglets (Missions / Courses / Gains / Profil)
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PackageSearch, Bike, Wallet, User, type LucideIcon } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { PressableScale, bodyFont } from '../../components/ui';

interface NavDef { route: string; label: string; Icon: LucideIcon; }
const NAV: NavDef[] = [
  { route: 'index',   label: 'Missions', Icon: PackageSearch },
  { route: 'courses', label: 'Courses',  Icon: Bike },
  { route: 'gains',   label: 'Gains',    Icon: Wallet },
  { route: 'profil',  label: 'Profil',   Icon: User },
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
          <PressableScale key={route} onPress={onPress} style={styles.item} scaleTo={0.88}>
            <View style={[styles.pill, active && { backgroundColor: Brand.accent + '22' }]}>
              <Icon size={21} color={active ? Brand.accentLight : colors.faint} strokeWidth={active ? 2.5 : 2} />
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

export default function LivreurLayout() {
  const { user, authReady } = useApp();

  if (authReady && !user) return <Redirect href="/" />;
  if (authReady && user && user.role !== 'livreur') return <Redirect href="/(client)" />;

  return (
    <Tabs tabBar={props => <BottomNav {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="gains" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around',
    paddingTop: 9, borderTopWidth: 1,
  },
  item: { alignItems: 'center', gap: 3, flex: 1 },
  pill: {
    width: 46, height: 32, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
});
