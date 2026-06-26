import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text } from 'react-native';
import { Home, ShoppingBag, ChefHat, Heart, User, Map } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAppContext } from '../../context/AppContext';
import { Radius } from '../../constants/theme';

function CustomTabBar({ state, descriptors, navigation, colors }: any) {
  const insets = useSafeAreaInsets();
  const { cart } = useAppContext();

  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (cart.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [cart.length]);

  const ALLOWED_ROUTES = ['index', 'panier', 'explore', 'favorites', 'profile'];
  const visibleRoutes = state.routes.filter((route: any) => ALLOWED_ROUTES.includes(route.name));

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

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const Icon = route.name === 'index' ? Home :
                     route.name === 'panier' ? ShoppingBag :
                     route.name === 'explore' ? ChefHat :
                     route.name === 'favorites' ? Heart :
                     User;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={s.tabItem}
          >
            <Animated.View style={route.name === 'panier' && cart.length > 0 ? { transform: [{ scale: scaleAnim }] } : {}}>
              <Icon
                size={26}
                color={isFocused ? colors.primary : colors.text.muted}
                strokeWidth={isFocused ? 2.5 : 2}
              />
              {route.name === 'panier' && cart.length > 0 && (
                <View style={[s.badge, { backgroundColor: colors.danger }]}>
                  <Text style={s.badgeText}>{cart.length}</Text>
                </View>
              )}
            </Animated.View>
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
      <Tabs.Screen name="panier" options={{ title: 'Panier' }} />
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
