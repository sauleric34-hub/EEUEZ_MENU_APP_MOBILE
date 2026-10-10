// ═══════════════════════════════════════════════════════════
//  Splash / Authentification (connexion & inscription réelles)
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ScanFace } from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { ScreenBg } from '../components/ScreenBg';
import { LogoMark } from '../components/Logo';
import { NgAfricaCredit } from '../components/NgAfricaCredit';
import { AccentButton, PressableScale, bodyFont } from '../components/ui';
import { ErrorNotice } from '../components/ErrorNotice';
import { describeError, type ErrorInfo } from '../services/errors';

import { DEMO } from '../constants/demo';

/** Écran d'accueil après connexion selon le rôle du compte. */
function homeFor(role?: string): '/(client)' | '/(livreur)' | '/(restaurant)' | null {
  if (role === 'livreur') return '/(livreur)';
  if (role === 'restaurant') return '/(restaurant)';
  if (role === 'client' || role === undefined) return '/(client)';
  return null; // admin : pas d'app mobile dédiée
}

const UNSUPPORTED: ErrorInfo = {
  kind: 'forbidden',
  title: 'Compte non pris en charge',
  message: 'Ce compte s\'utilise depuis l\'espace web, pas depuis l\'application mobile.',
};

export default function SplashScreen() {
  const { colors, user, authReady, signIn, signOut } = useApp();
  const router = useRouter();

  const [email, setEmail] = useState(DEMO.email);
  const [password, setPassword] = useState(DEMO.password);
  const [busy, setBusy] = useState(false);
  // Réservé aux échecs de connexion (serveur/réseau) — les problèmes de
  // saisie ont leur propre retour, en direct, champ par champ (cf. plus bas).
  const [error, setError] = useState<ErrorInfo | null>(null);
  // Remonte la carte d'erreur à chaque tentative pour rejouer son animation
  const [attempt, setAttempt] = useState(0);

  // ─── Validation en direct ──────────────────────────────────
  // Un champ n'affiche son erreur qu'une fois « touché » (quitté au moins
  // une fois), pour ne pas accueillir l'utilisateur avec du rouge sur un
  // formulaire vierge. Une tentative de connexion révèle tout d'un coup.
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.trim().length > 0;
  const emailError = touchedEmail && !emailValid ? 'Adresse email invalide.' : null;
  const passwordError = touchedPassword && !passwordValid ? 'Le mot de passe est requis.' : null;

  const float = useRef(new Animated.Value(0)).current;

  // ─── Shake horizontal des champs (échec de connexion) ──────
  const shake = useRef(new Animated.Value(0)).current;
  const triggerShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ]),
    ).start();
  }, [float]);

  // Session déjà active → on entre directement, selon le rôle.
  // Uniquement quand CET écran est affiché, et une seule fois par compte :
  // s'il reste monté sous les onglets (ex. après une inscription), chaque
  // rafraîchissement de l'utilisateur (ouverture du Profil…) renvoyait sinon
  // l'app sur l'Accueil.
  const focused = useIsFocused();
  const dejaRedirige = useRef<number | null>(null);
  const userId = user?.id ?? null;
  const role = user?.role;
  useEffect(() => {
    if (!authReady || userId == null) { dejaRedirige.current = null; return; }
    if (!focused || dejaRedirige.current === userId) return;
    dejaRedirige.current = userId;
    const dest = homeFor(role);
    if (dest) router.replace(dest);
    else { setError(UNSUPPORTED); signOut(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userId, role, focused]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  const submit = async () => {
    setAttempt(n => n + 1);
    setTouchedEmail(true);
    setTouchedPassword(true);
    if (!emailValid || !passwordValid) return; // déjà signalé champ par champ
    setBusy(true);
    setError(null);
    try {
      const u = await signIn(email.trim(), password);
      const dest = homeFor(u?.role);
      if (dest) router.replace(dest);
      else setError(UNSUPPORTED);
    } catch (e) {
      setError(describeError(e, 'La connexion a échoué. Réessayez.'));
      triggerShake();
    } finally {
      setBusy(false);
    }
  };

  const quickDemo = async () => {
    setEmail(DEMO.email); setPassword(DEMO.password);
    setBusy(true); setError(null);
    try {
      await signIn(DEMO.email, DEMO.password);
      router.replace('/(client)');
    } catch (e) {
      setError(describeError(e, 'La connexion a échoué. Réessayez.'));
      triggerShake();
    } finally { setBusy(false); }
  };


  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={{ transform: [{ translateY }], alignItems: 'center' }}>
            <View style={[styles.logoGlow, glow(Brand.accent, 30)]}>
              <LogoMark size={128} radius={34} />
            </View>
            <Text style={[bodyFont(13.5, '500'), styles.subtitle, { color: colors.muted, marginTop: 22 }]}>
              Les meilleurs plats africains, livrés chez vous.
            </Text>
          </Animated.View>

          <View style={styles.form}>
            <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
              <TextInput
                value={email} onChangeText={setEmail}
                onBlur={() => setTouchedEmail(true)}
                placeholder="Email" placeholderTextColor={colors.faint}
                autoCapitalize="none" keyboardType="email-address"
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                  emailError && styles.inputInvalid,
                ]}
              />
              {emailError && <Text style={styles.fieldError}>{emailError}</Text>}
              <TextInput
                value={password} onChangeText={setPassword}
                onBlur={() => setTouchedPassword(true)}
                placeholder="Mot de passe" placeholderTextColor={colors.faint} secureTextEntry
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                  passwordError && styles.inputInvalid,
                ]}
              />
              {passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
            </Animated.View>

            {error && <ErrorNotice key={`${error.kind}:${error.message}:${attempt}`} error={error} onRetry={submit} />}

            {busy ? (
              <View style={[styles.busyBtn, glow(Brand.accent, 18)]}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <AccentButton label="Connexion" onPress={submit} style={{ marginTop: 4 }} />
            )}

            <PressableScale onPress={() => { setError(null); router.push('/register'); }}>
              <Text style={[bodyFont(13, '700'), { color: Brand.accentLight, textAlign: 'center', marginTop: 16 }]}>
                Pas de compte ? Créer un compte
              </Text>
            </PressableScale>

            <PressableScale onPress={quickDemo}>
              <View style={[styles.faceBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ScanFace size={22} color={Brand.accent} strokeWidth={2} />
                <Text style={[bodyFont(12.5, '700'), { color: colors.muted }]}>
                  Visiter en invité
                </Text>
              </View>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
        <NgAfricaCredit style={styles.credit} />
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  logoGlow: { borderRadius: 34 },
  credit: { paddingBottom: 12 },
  subtitle: { textAlign: 'center', maxWidth: 260, marginTop: 10 },
  form: { marginTop: 32 },
  input: {
    borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: '600', marginBottom: 12,
  },
  inputInvalid: { borderColor: Brand.danger, marginBottom: 6 },
  fieldError: { color: '#ff6b70', fontSize: 12, fontWeight: '600', marginTop: -3, marginBottom: 10, paddingHorizontal: 4 },
  busyBtn: {
    marginTop: 4, paddingVertical: 16, borderRadius: Radius.pill,
    backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center',
  },
  faceBtn: {
    marginTop: 22, flexDirection: 'row', gap: 10, alignSelf: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.pill, borderWidth: 1,
    alignItems: 'center',
  },
});
