import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import {
  Home, House,
  ShoppingCart, ShoppingBag,
  Utensils, UtensilsCrossed,
  Heart,
  User, UserCircle,
} from 'lucide-react-native';

// Paires outline / filled pour chaque onglet
const TAB_ICONS: Record<string, { outline: any; filled: any; label: string }> = {
  index:     { outline: Home,         filled: House,           label: 'Accueil' },
  cart:      { outline: ShoppingCart, filled: ShoppingBag,     label: 'Panier'  },
  explore:   { outline: Utensils,     filled: UtensilsCrossed, label: 'Explorer'},
  favorites: { outline: Heart,        filled: Heart,           label: 'Favoris' },
  profile:   { outline: User,         filled: UserCircle,      label: 'Profil'  },
};

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  const ALLOWED_ROUTES = ['index', 'cart', 'explore', 'favorites', 'profile'];
  const visibleRoutes = state.routes.filter((route: any) => ALLOWED_ROUTES.includes(route.name));

  return (
    <View style={[
      s.tabBar,
      { paddingBottom: Math.max(insets.bottom, 12), height: 62 + Math.max(insets.bottom, 12) }
    ]}>
      {visibleRoutes.map((route: any) => {
        const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);
        const tabCfg = TAB_ICONS[route.name];
        if (!tabCfg) return null;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPreventDefault) {
            navigation.navigate(route.name);
          }
        };

        const IconComp   = isFocused ? tabCfg.filled   : tabCfg.outline;
        const iconColor  = isFocused ? Colors.client.primary : Colors.text.muted;
        const labelColor = isFocused ? Colors.client.primary : Colors.text.muted;
        // Pour les icônes qui supportent le remplissage (Heart, etc.)
        const fillColor  = isFocused && route.name === 'favorites'
          ? Colors.client.primary
          : 'transparent';

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={s.tabItem}
            activeOpacity={0.7}
          >
            <IconComp
              size={24}
              color={iconColor}
              fill={fillColor}
              strokeWidth={isFocused ? 2.2 : 1.8}
            />
            <Text style={[s.tabLabel, { color: labelColor, fontWeight: isFocused ? '700' : '400' }]}>
              {tabCfg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ClientLayout() {
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"     options={{ title: 'Accueil' }} />
      <Tabs.Screen name="cart"      options={{ title: 'Panier' }} />
      <Tabs.Screen name="explore"   options={{ title: 'Explorer' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favoris' }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profil' }} />
      <Tabs.Screen name="map"       options={{ href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 10,
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    backgroundColor: Colors.bg.surface,
    borderTopColor: Colors.border.default,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
