import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Radius, Spacing, glow } from '../constants/theme';
import { ShoppingBag, Store, Bike, ChevronRight } from 'lucide-react-native';

const ROLES = [
  {
    key: 'client',
    label: 'Client',
    sub: 'Parcourir, commander et suivre votre livraison',
    icon: ShoppingBag,
    color: Colors.client.primary,
    glowColor: Colors.client.glow,
    bg: Colors.client.bg,
    borderColor: Colors.client.primary,
    route: '/(client)',
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    sub: 'Gérer le menu, les commandes et les livraisons',
    icon: Store,
    color: Colors.restaurant.primary,
    glowColor: Colors.restaurant.glow,
    bg: Colors.restaurant.bg,
    borderColor: Colors.restaurant.primary,
    route: '/(restaurant)',
  },
  {
    key: 'livreur',
    label: 'Livreur',
    sub: 'Accepter des missions et suivre vos gains',
    icon: Bike,
    color: Colors.livreur.primary,
    glowColor: Colors.livreur.glow,
    bg: Colors.livreur.bg,
    borderColor: Colors.livreur.primary,
    route: '/(livreur)',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const logoAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(ROLES.map(() => new Animated.Value(0))).current;
  const orbAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logoAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.stagger(120, cardAnims.map(a =>
        Animated.spring(a, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true })
      )),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orbAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(orbAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const orbTranslate = orbAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const orbScale = orbAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />

      {/* Orbes décoratifs */}
      <Animated.View style={[styles.orb1, { transform: [{ translateY: orbTranslate }, { scale: orbScale }] }]} />
      <Animated.View style={[styles.orb2, { transform: [{ translateY: Animated.multiply(orbTranslate, new Animated.Value(-1)) }] }]} />

      <SafeAreaView style={styles.safeArea}>

        {/* Logo + Tagline */}
        <Animated.View style={[styles.logoSection, {
          opacity: logoAnim,
          transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }]
        }]}>
          <View style={styles.logoPill}>
            <View style={styles.logoIconDot} />
            <Text style={styles.logoText}>Menu</Text>
          </View>
          <Animated.Text style={[styles.tagline, { opacity: subtitleAnim }]}>
            Commandez, gérez, livrez.{'\n'}Le tout en un seul endroit.
          </Animated.Text>
        </Animated.View>

        {/* Titre */}
        <Text style={styles.rolesTitle}>Qui êtes-vous ?</Text>

        {/* Sélection du Rôle */}
        <View style={styles.rolesSection}>
          {ROLES.map((role, i) => (
            <Animated.View
              key={role.key}
              style={{
                opacity: cardAnims[i],
                transform: [
                  { translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                  { scale: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                ]
              }}
            >
              <TouchableOpacity
                style={[styles.roleCard, { borderColor: role.borderColor + '55' }]}
                onPress={() => router.push(role.route as any)}
                activeOpacity={0.82}
              >
                {/* Icône */}
                <View style={[styles.roleIconBg, { backgroundColor: role.bg }]}>
                  <role.icon size={26} color={role.color} strokeWidth={2} />
                </View>

                {/* Texte */}
                <View style={styles.roleText}>
                  <Text style={[styles.roleLabel, { color: role.color }]}>{role.label}</Text>
                  <Text style={styles.roleSub}>{role.sub}</Text>
                </View>

                {/* Flèche */}
                <View style={[styles.arrowCircle, { backgroundColor: role.bg }]}>
                  <ChevronRight size={18} color={role.color} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Version 1.0 Bêta · Cameroun
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.app },
  safeArea: { flex: 1, paddingHorizontal: Spacing.lg },

  // Orbes décoratifs
  orb1: {
    position: 'absolute', width: 320, height: 320, borderRadius: 160,
    backgroundColor: Colors.client.glow, top: -100, right: -100,
  },
  orb2: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: Colors.restaurant.glow, bottom: 60, left: -90,
  },

  // Logo
  logoSection: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  logoIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.client.primary,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
    color: Colors.text.primary,
  },
  tagline: {
    ...Typography.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Titre section rôles
  rolesTitle: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: Spacing.md,
    color: Colors.text.primary,
  },

  // Sélection Rôle
  rolesSection: { gap: Spacing.sm + 4 },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },

  roleIconBg: {
    width: 54,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  roleText: {
    flex: 1,
    gap: 3,
  },

  roleLabel: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  roleSub: {
    ...Typography.small,
    color: Colors.text.muted,
    lineHeight: 18,
  },

  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  // Footer
  footer: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    color: Colors.text.muted,
  },
});
