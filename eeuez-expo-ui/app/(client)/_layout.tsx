// ═══════════════════════════════════════════════════════════
//  Layout client — barre de navigation personnalisée (6 onglets)
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  House, UtensilsCrossed, Navigation, ShoppingCart, MessageCircle, User,
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
  { route: 'panier',   label: 'Panier',   Icon: ShoppingCart },
  { route: 'messages', label: 'Messages', Icon: MessageCircle },
  { route: 'profil',   label: 'Profil',   Icon: User },
];
// L'onglet Accueil reste actif sur les sous-écrans plat/resto
const HOME_GROUP = new Set(['index', 'dish', 'resto', 'publication']);
const PILL_WIDTH = 46;
const PILL_HEIGHT = 32;

/** Pastille panier : apparaît en rebond (spring) plutôt qu'instantanément —
 *  ne rejoue qu'au vrai passage 0 → positif, puisque le parent démonte ce
 *  composant quand le panier revient à 0 (donc il remonte, donc rejoue). */
function CartBadge({ count, borderColor }: { count: number; borderColor: string }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.2, useNativeDriver: true, speed: 50, bounciness: 18 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[styles.badge, { borderColor, transform: [{ scale }] }]}>
      <Text style={styles.badgeTxt}>{count}</Text>
    </Animated.View>
  );
}

interface NavItemProps {
  route: string; label: string; Icon: LucideIcon; active: boolean;
  onPress: () => void; cartCount: number;
}
/** Un onglet. L'icône fait un petit rebond au moment précis où il DEVIENT
 *  actif (pas à chaque rendu) — cohérent avec le pop utilisé ailleurs dans
 *  l'app (bouton Ajouter, Suivre…). */
function NavItem({ route, label, Icon, active, onPress, cartCount }: NavItemProps) {
  const { colors } = useApp();
  const bounce = useRef(new Animated.Value(1)).current;
  const etaitActif = useRef(active);
  useEffect(() => {
    if (active && !etaitActif.current) {
      Animated.sequence([
        Animated.spring(bounce, { toValue: 1.22, useNativeDriver: true, speed: 50, bounciness: 10 }),
        Animated.spring(bounce, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
      ]).start();
    }
    etaitActif.current = active;
  }, [active, bounce]);

  const showBadge = route === 'panier' && cartCount > 0;

  return (
    <PressableScale onPress={onPress} style={styles.item} scaleTo={0.88}>
      <View style={styles.pill}>
        <Animated.View style={{ transform: [{ scale: bounce }] }}>
          <Icon size={21} color={active ? Brand.accentLight : colors.faint} strokeWidth={active ? 2.5 : 2} />
        </Animated.View>
        {showBadge && <CartBadge count={cartCount} borderColor={colors.nav} />}
      </View>
      <Text style={[bodyFont(10, active ? '800' : '600'), { color: active ? Brand.accentLight : colors.faint }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

function BottomNav({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, cartCount } = useApp();
  const current = state.routes[state.index]?.name ?? 'index';
  const activeIndex = Math.max(0, NAV.findIndex(
    n => n.route === current || (n.route === 'index' && HOME_GROUP.has(current)),
  ));

  // Pastille active : glisse d'un onglet à l'autre au lieu d'apparaître/
  // disparaître. `useWindowDimensions()` mesure la fenêtre entière, pas la
  // barre elle-même — les deux ne coïncident pas toujours (marges du
  // navigateur, colonne centrée sur web…), ce qui décalait la pastille.
  // On mesure donc la largeur réellement rendue de la barre via onLayout.
  const [barWidth, setBarWidth] = useState(0);
  const onBarLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);
  const itemWidth = barWidth / NAV.length;
  const pillX = useRef(new Animated.Value(activeIndex * itemWidth + (itemWidth - PILL_WIDTH) / 2)).current;
  useEffect(() => {
    if (barWidth === 0) return;
    Animated.timing(pillX, {
      toValue: activeIndex * itemWidth + (itemWidth - PILL_WIDTH) / 2,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, itemWidth, barWidth]);

  return (
    <View
      onLayout={onBarLayout}
      style={[
        styles.bar,
        {
          backgroundColor: colors.nav,
          borderTopColor: colors.navBorder,
          paddingBottom: Math.max(insets.bottom, 12),
          height: 66 + Math.max(insets.bottom, 12),
        },
      ]}
    >
      {barWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.slidingPill, { transform: [{ translateX: pillX }] }]}
        />
      )}
      {NAV.map(({ route, label, Icon }) => {
        const active = route === current || (route === 'index' && HOME_GROUP.has(current));
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route, canPreventDefault: true });
          if (!event.defaultPrevented) navigation.navigate(route);
        };
        return (
          <NavItem
            key={route} route={route} label={label} Icon={Icon}
            active={active} onPress={onPress} cartCount={cartCount}
          />
        );
      })}
    </View>
  );
}

export default function ClientLayout() {
  const { user, authReady } = useApp();

  // Garde d'authentification. C'est LUI qui rend la déconnexion fiable :
  // dès que l'utilisateur disparaît, tout écran client renvoie vers l'accueil
  // de connexion. Sans ce garde, la navigation manuelle depuis le profil
  // pouvait être annulée par l'écran d'accueil, qui relisait un utilisateur
  // pas encore effacé et renvoyait aussitôt dans l'app.
  if (authReady && !user) return <Redirect href="/" />;

  return (
    <Tabs tabBar={props => <BottomNav {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="plats" />
      <Tabs.Screen name="carte" />
      <Tabs.Screen name="panier" />
      <Tabs.Screen name="messages" />
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
  slidingPill: {
    position: 'absolute', top: 9, left: 0, width: PILL_WIDTH, height: PILL_HEIGHT,
    borderRadius: Radius.pill, backgroundColor: Brand.accent + '22',
  },
  item: { alignItems: 'center', gap: 3, flex: 1 },
  pill: {
    width: PILL_WIDTH, height: PILL_HEIGHT, borderRadius: Radius.pill,
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
