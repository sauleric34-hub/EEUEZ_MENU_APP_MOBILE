import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Radius, Spacing, glow } from '../constants/theme';
import { ShoppingBag, Store, Bike } from 'lucide-react-native';

const ROLES = [
  {
    key: 'client',
    label: 'Client',
    sub: 'Parcourir, commander\nsuivre votre livraison',
    icon: ShoppingBag,
    color: Colors.client.primary,
    glow: Colors.client.glow,
    bg: Colors.client.bg,
    route: '/(client)',
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    sub: 'Gérer le menu, les commandes\net les livraisons',
    icon: Store,
    color: Colors.restaurant.primary,
    glow: Colors.restaurant.glow,
    bg: Colors.restaurant.bg,
    route: '/(restaurant)',
  },
  {
    key: 'livreur',
    label: 'Livreur',
    sub: 'Accepter des missions\net suivre vos gains',
    icon: Bike,
    color: Colors.livreur.primary,
    glow: Colors.livreur.glow,
    bg: Colors.livreur.bg,
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
    // Animation d'entrée orchestrée
    Animated.sequence([
      // 1. Logo apparaît
      Animated.spring(logoAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      // 2. Sous-titre
      Animated.timing(subtitleAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      // 3. Cartes en cascade
      Animated.stagger(120, cardAnims.map(a =>
        Animated.spring(a, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true })
      )),
    ]).start();

    // Orbe animé en boucle
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

      {/* Orbes décoratifs en arrière-plan */}
      <Animated.View style={[styles.orb1, { transform: [{ translateY: orbTranslate }, { scale: orbScale }] }]} />
      <Animated.View style={[styles.orb2, { transform: [{ translateY: Animated.multiply(orbTranslate, new Animated.Value(-1)) }] }]} />

      <SafeAreaView style={styles.safeArea}>

        {/* Logo + Tagline */}
        <Animated.View style={[styles.logoSection, {
          opacity: logoAnim,
          transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }]
        }]}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Menu</Text>
            <View style={styles.logoBadge}><Text style={styles.logoBadgeText}>MENU</Text></View>
          </View>
          <Animated.Text style={[styles.tagline, { opacity: subtitleAnim }]}>
            Commandez, gérez, livrez.{'\n'}Le tout en un seul endroit.
          </Animated.Text>
        </Animated.View>

        {/* Sélection du Rôle */}
        <View style={styles.rolesSection}>
          <Text style={styles.rolesTitle}>Qui êtes-vous ?</Text>

          {ROLES.map((role, i) => (
            <Animated.View
              key={role.key}
              style={{
                opacity: cardAnims[i],
                transform: [
                  { translateX: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) },
                  { scale: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                ]
              }}
            >
              <TouchableOpacity
                style={[styles.roleCard, { borderColor: role.color + '33' }, glow(role.glow, 16)]}
                onPress={() => router.push(role.route as any)}
                activeOpacity={0.85}
              >
                {/* Fond accent subtil */}
                <View style={[styles.roleCardAccent, { backgroundColor: role.bg }]} />

                <View style={[styles.roleIconBg, { backgroundColor: role.bg, ...glow(role.color, 10) }]}>
                  <role.icon size={28} color={role.color} />
                </View>

                <View style={styles.roleText}>
                  <Text style={[styles.roleLabel, { color: role.color }]}>{role.label}</Text>
                  <Text style={styles.roleSub}>{role.sub}</Text>
                </View>

                <Text style={[styles.roleArrow, { color: role.color }]}>›</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Cameroun — Version 1.0 Bêta
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.app },
  safeArea: { flex: 1, paddingHorizontal: Spacing.md },
  // Orbes décoratifs
  orb1: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: Colors.client.glow, top: -80, right: -80,
  },
  orb2: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.restaurant.glow, bottom: 40, left: -80,
  },
  // Logo
  logoSection: { paddingTop: Spacing.xl, paddingBottom: Spacing.lg, alignItems: 'center' },
  logoContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  logoText: {
    fontSize: 48, fontWeight: '900', letterSpacing: -1, color: Colors.text.primary,
  },
  logoBadge: {
    backgroundColor: Colors.client.primary, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, marginBottom: 8,
  },
  logoBadgeText: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: '#FFF' },
  tagline: {
    ...Typography.body, color: Colors.text.secondary, textAlign: 'center',
    marginTop: Spacing.md, lineHeight: 24,
  },
  // Sélection Rôle
  rolesSection: { flex: 1, justifyContent: 'center', gap: Spacing.md },
  rolesTitle: { ...Typography.h3, color: Colors.text.secondary, textAlign: 'center', marginBottom: 8 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.surface,
    borderRadius: Radius.xl, borderWidth: 1,
    padding: Spacing.md, gap: Spacing.md,
    overflow: 'hidden', position: 'relative',
  },
  roleCardAccent: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%', borderRadius: 2 },
  roleIconBg: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  roleEmoji: { fontSize: 26 },
  roleText: { flex: 1, gap: 4 },
  roleLabel: { ...Typography.h3, fontSize: 17 },
  roleSub: { ...Typography.small, color: Colors.text.muted, lineHeight: 18 },
  roleArrow: { fontSize: 28, fontWeight: '300', marginRight: 4 },
  // Footer
  footer: { ...Typography.caption, textAlign: 'center', paddingBottom: Spacing.lg },
});
