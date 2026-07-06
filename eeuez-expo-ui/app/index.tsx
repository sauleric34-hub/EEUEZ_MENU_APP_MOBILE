// ═══════════════════════════════════════════════════════════
//  Splash / Authentification (connexion & inscription réelles)
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScanFace, TriangleAlert } from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { ScreenBg } from '../components/ScreenBg';
import { LogoMark } from '../components/Logo';
import { AccentButton, PressableScale, displayFont, bodyFont } from '../components/ui';

const DEMO = { email: 'client@menu.cm', password: 'client123' };

export default function SplashScreen() {
  const { colors, user, authReady, signIn, register } = useApp();
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(DEMO.email);
  const [password, setPassword] = useState(DEMO.password);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ]),
    ).start();
  }, [float]);

  // Session déjà active → on entre directement
  useEffect(() => {
    if (authReady && user) router.replace('/(client)');
  }, [authReady, user, router]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  const validate = (): string | null => {
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return 'Adresse email invalide.';
    if (password.length < 6) return 'Le mot de passe doit faire au moins 6 caractères.';
    if (mode === 'register' && !name.trim()) return 'Veuillez saisir votre nom.';
    return null;
  };

  const submit = async () => {
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await register({ email: email.trim(), password, first_name: name.trim() });
      }
      router.replace('/(client)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la connexion');
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
      setError(e instanceof Error ? e.message : 'Échec de la connexion');
    } finally { setBusy(false); }
  };

  const isLogin = mode === 'login';

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={{ transform: [{ translateY }], alignItems: 'center' }}>
            <View style={[styles.logoGlow, glow(Brand.accent, 30)]}>
              <LogoMark size={128} radius={34} />
            </View>
            <Text style={[displayFont(30, '800'), { color: colors.text, marginTop: 22 }]}>Menu</Text>
            <Text style={[bodyFont(13.5, '500'), styles.subtitle, { color: colors.muted }]}>
              Les meilleurs plats africains, livrés chez vous.
            </Text>
          </Animated.View>

          <View style={styles.form}>
            {!isLogin && (
              <TextInput
                value={name} onChangeText={setName}
                placeholder="Votre nom" placeholderTextColor={colors.faint}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              />
            )}
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder="Email" placeholderTextColor={colors.faint}
              autoCapitalize="none" keyboardType="email-address"
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            />
            <TextInput
              value={password} onChangeText={setPassword}
              placeholder="Mot de passe" placeholderTextColor={colors.faint} secureTextEntry
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            />

            {error && (
              <View style={styles.errRow}>
                <TriangleAlert size={15} color={Brand.danger} strokeWidth={2.3} />
                <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', flex: 1 }]}>{error}</Text>
              </View>
            )}

            {busy ? (
              <View style={[styles.busyBtn, glow(Brand.accent, 18)]}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <AccentButton label={isLogin ? 'Connexion' : 'Créer un compte'} onPress={submit} style={{ marginTop: 4 }} />
            )}

            <PressableScale onPress={() => { setError(null); setMode(isLogin ? 'register' : 'login'); }}>
              <Text style={[bodyFont(13, '700'), { color: Brand.accentLight, textAlign: 'center', marginTop: 16 }]}>
                {isLogin ? 'Pas de compte ? Créer un compte' : 'Déjà inscrit ? Se connecter'}
              </Text>
            </PressableScale>

            <PressableScale onPress={quickDemo}>
              <View style={[styles.faceBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ScanFace size={22} color={Brand.accent} strokeWidth={2} />
                <Text style={[bodyFont(12.5, '700'), { color: colors.muted }]}>Connexion démo</Text>
              </View>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  logoGlow: { borderRadius: 34 },
  subtitle: { textAlign: 'center', maxWidth: 260, marginTop: 10 },
  form: { marginTop: 32 },
  input: {
    borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontWeight: '600', marginBottom: 12,
  },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 4 },
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
