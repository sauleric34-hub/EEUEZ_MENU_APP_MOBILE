import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, ShoppingBag, ChefHat, Heart, User, Map } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Radius } from '../../constants/theme';

function CustomTabBar({ state, descriptors, navigation, colors }: any) {
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((route: any) => route.name !== 'map');

  return (
    <View style={[
      s.tabBar,
      {
        backgroundColor: colors.bg.surface,
        borderTopColor: colors.border.subtle,
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

        let Icon = Home;
        if (route.name === 'cart') Icon = ShoppingBag;
        if (route.name === 'explore') Icon = ChefHat;
        if (route.name === 'favorites') Icon = Heart;
        if (route.name === 'profile') Icon = User;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={s.tabItem}
          >
            <Icon
              size={26}
              color={isFocused ? colors.primary : colors.text.muted}
              strokeWidth={isFocused ? 2.5 : 2}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ClientLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} colors={colors} />}
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  tabItem: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
