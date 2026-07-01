import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, glow } from '../../constants/theme';
import { Home, ShoppingCart, Utensils, Heart, User } from 'lucide-react-native';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  const ALLOWED_ROUTES = ['index', 'cart', 'explore', 'favorites', 'profile'];
  const visibleRoutes = state.routes.filter((route: any) => ALLOWED_ROUTES.includes(route.name));

  return (
    <View style={[
      s.tabBar,
      {
        paddingBottom: Math.max(insets.bottom, 20),
        height: 70 + Math.max(insets.bottom, 20)
      }
    ]}>
      {visibleRoutes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);

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

        let IconComp = Home;
        if (route.name === 'cart') IconComp = ShoppingCart;
        else if (route.name === 'explore') IconComp = Utensils;
        else if (route.name === 'favorites') IconComp = Heart;
        else if (route.name === 'profile') IconComp = User;
        else if (route.name === 'index') IconComp = Home;
        else return null;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={s.tabItem}
          >
            <View style={[
              s.iconContainer,
              isFocused && { backgroundColor: Colors.client.primary, ...glow(Colors.client.glow, 8) }
            ]}>
              <IconComp size={24} color={isFocused ? Colors.bg.app : Colors.text.primary} opacity={isFocused ? 1 : 0.6} />
            </View>
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
      <Tabs.Screen name="index" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="cart" options={{ title: 'Panier' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favoris' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      <Tabs.Screen name="map" options={{ href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 80,
    paddingBottom: 25,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    backgroundColor: Colors.bg.surface,
    borderTopColor: Colors.border.default,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
