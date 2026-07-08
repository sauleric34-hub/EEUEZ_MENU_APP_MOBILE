// ═══════════════════════════════════════════════════════════
//  Inscription — 2 étapes
//  1. Identité (prénom, nom, email, téléphone)
//  2. Sécurité & santé (mot de passe ×2, allergies)
// ═══════════════════════════════════════════════════════════

import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Animated, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, User, Mail, Phone, Lock, TriangleAlert, ArrowRight, Check, Camera,
  type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { ScreenBg } from '../components/ScreenBg';
import { LogoMark } from '../components/Logo';
import { PressableScale, displayFont, bodyFont } from '../components/ui';

const ALLERGY_CHOICES = ['Arachides', 'Gluten', 'Lactose', 'Fruits de mer', 'Œufs', 'Soja'];

function Field({ Icon, colors, ...inputProps }: {
  Icon: LucideIcon; colors: any;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon size={17} color={Brand.accentLight} strokeWidth={2.2} />
      <TextInput
        placeholderTextColor={colors.faint}
        style={[styles.fieldInput, { color: colors.text }]}
        {...inputProps}
      />
    </View>
  );
}

export default function RegisterScreen() {
  const { colors, register, updateUser } = useApp();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [otherAllergy, setOtherAllergy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slide = useRef(new Animated.Value(0)).current;

  const goToStep = (next: 1 | 2) => {
    setError(null);
    Animated.timing(slide, { toValue: next === 2 ? 1 : 0, duration: 260, useNativeDriver: true }).start();
    setStep(next);
  };

  const validateStep1 = (): string | null => {
    if (!firstName.trim()) return 'Veuillez saisir votre prénom.';
    if (!lastName.trim()) return 'Veuillez saisir votre nom.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Adresse email invalide.';
    if (!/^[0-9+\s-]{8,15}$/.test(phone.trim())) return 'Numéro de téléphone invalide (ex : 699 00 00 00).';
    return null;
  };
  const validateStep2 = (): string | null => {
    if (password.length < 6) return 'Le mot de passe doit faire au moins 6 caractères.';
    if (password !== confirm) return 'Les deux mots de passe ne correspondent pas.';
    return null;
  };

  const next = () => {
    const invalid = validateStep1();
    if (invalid) { setError(invalid); return; }
    goToStep(2);
  };

  const toggleAllergy = (a: string) =>
    setAllergies(list => (list.includes(a) ? list.filter(x => x !== a) : [...list, a]));

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) setAvatarUri(res.assets[0].uri);
  };

  const submit = async () => {
    const invalid = validateStep2();
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    setError(null);
    const allAllergies = [...allergies, ...(otherAllergy.trim() ? [otherAllergy.trim()] : [])].join(', ');
    try {
      await register({
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        telephone: phone.trim(),
        allergies: allAllergies,
      });
      // Photo de profil (facultative) — envoyée une fois le compte créé & authentifié
      if (avatarUri) {
        try { await updateUser({ avatarUri }); } catch { /* non bloquant */ }
      }
      router.replace('/(client)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l\'inscription');
    } finally {
      setBusy(false);
    }
  };

  const stepTitles = ['Vos informations', 'Sécurité & santé'];

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <PressableScale onPress={() => (step === 2 ? goToStep(1) : router.back())}>
                <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ChevronLeft size={20} color={colors.text} />
                </View>
              </PressableScale>
              <LogoMark size={40} radius={12} />
            </View>

            <Text style={[displayFont(26, '800'), { color: colors.text, marginTop: 22 }]}>Créer un compte</Text>
            <Text style={[bodyFont(13.5, '500'), { color: colors.muted, marginTop: 6 }]}>
              Étape {step} sur 2 — {stepTitles[step - 1]}
            </Text>

            {/* Barre de progression */}
            <View style={[styles.progressTrack, { backgroundColor: colors.surface2 }]}>
              <Animated.View style={[styles.progressFill, {
                transform: [{ scaleX: slide.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
              }]}>
                <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>

            {step === 1 ? (
              <View style={{ marginTop: 24, gap: 12 }}>
                {/* Photo de profil (facultative) */}
                <View style={{ alignItems: 'center', marginBottom: 6 }}>
                  <PressableScale onPress={pickAvatar} scaleTo={0.94}>
                    <View style={[styles.avatarRing, { borderColor: Brand.accent + '55' }]}>
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                      ) : (
                        <View style={[styles.avatarImg, styles.avatarEmpty, { backgroundColor: colors.surface }]}>
                          <User size={34} color={colors.faint} strokeWidth={1.8} />
                        </View>
                      )}
                      <View style={[styles.avatarBadge, glow(Brand.accent, 10)]}>
                        <Camera size={15} color="#fff" strokeWidth={2.4} />
                      </View>
                    </View>
                  </PressableScale>
                  <Text style={[bodyFont(12, '600'), { color: colors.muted, marginTop: 8 }]}>
                    {avatarUri ? 'Modifier la photo' : 'Ajouter une photo (facultatif)'}
                  </Text>
                </View>
                <Field Icon={User} colors={colors} value={firstName} onChangeText={setFirstName} placeholder="Prénom" />
                <Field Icon={User} colors={colors} value={lastName} onChangeText={setLastName} placeholder="Nom" />
                <Field Icon={Mail} colors={colors} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
                <Field Icon={Phone} colors={colors} value={phone} onChangeText={setPhone} placeholder="Téléphone (ex : 699 00 00 00)" keyboardType="phone-pad" />
              </View>
            ) : (
              <View style={{ marginTop: 24, gap: 12 }}>
                <Field Icon={Lock} colors={colors} value={password} onChangeText={setPassword} placeholder="Mot de passe (min. 6 caractères)" secureTextEntry />
                <Field Icon={Lock} colors={colors} value={confirm} onChangeText={setConfirm} placeholder="Confirmer le mot de passe" secureTextEntry />

                <View style={[styles.allergyBox, { backgroundColor: Brand.yellow + '0d', borderColor: Brand.yellow + '30' }]}>
                  <View style={styles.allergyHead}>
                    <TriangleAlert size={16} color={Brand.yellow} strokeWidth={2.3} />
                    <Text style={[bodyFont(13, '800'), { color: Brand.yellow }]}>Allergies alimentaires</Text>
                  </View>
                  <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 4 }]}>
                    Les restaurants en tiendront compte dans vos commandes.
                  </Text>
                  <View style={styles.allergyChips}>
                    {ALLERGY_CHOICES.map(a => {
                      const on = allergies.includes(a);
                      return (
                        <PressableScale key={a} onPress={() => toggleAllergy(a)} scaleTo={0.93}>
                          <View style={[
                            styles.chip,
                            on
                              ? { backgroundColor: Brand.yellow, borderColor: Brand.yellow }
                              : { backgroundColor: colors.surface, borderColor: colors.border },
                          ]}>
                            {on && <Check size={13} color="#1c1710" strokeWidth={3} />}
                            <Text style={[bodyFont(12.5, '700'), { color: on ? '#1c1710' : colors.muted }]}>{a}</Text>
                          </View>
                        </PressableScale>
                      );
                    })}
                  </View>
                  <TextInput
                    value={otherAllergy} onChangeText={setOtherAllergy}
                    placeholder="Autre allergie… (facultatif)" placeholderTextColor={colors.faint}
                    style={[styles.otherInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  />
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errRow}>
                <TriangleAlert size={15} color={Brand.danger} strokeWidth={2.3} />
                <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', flex: 1 }]}>{error}</Text>
              </View>
            )}

            {/* Bouton principal */}
            <PressableScale onPress={busy ? undefined : (step === 1 ? next : submit)} style={{ marginTop: 22 }}>
              <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mainBtn, glow(Brand.accent, 20)]}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={[bodyFont(15.5, '800'), { color: '#fff' }]}>
                      {step === 1 ? 'Continuer' : 'Créer mon compte'}
                    </Text>
                    {step === 1 ? <ArrowRight size={19} color="#fff" strokeWidth={2.6} /> : <Check size={19} color="#fff" strokeWidth={2.8} />}
                  </>
                )}
              </LinearGradient>
            </PressableScale>

            <PressableScale onPress={() => router.back()}>
              <Text style={[bodyFont(13, '700'), { color: Brand.accentLight, textAlign: 'center', marginTop: 18 }]}>
                Déjà inscrit ? Se connecter
              </Text>
            </PressableScale>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 30, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 6, borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', transformOrigin: 'left', borderRadius: 3, overflow: 'hidden' },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: 1,
  },
  fieldInput: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 14 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 84, height: 84, borderRadius: 42 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16,
    backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#080c09',
  },
  allergyBox: { borderRadius: 20, borderWidth: 1, padding: 15, marginTop: 4 },
  allergyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allergyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1,
  },
  otherInput: {
    marginTop: 12, borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 13.5, fontWeight: '600',
  },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 4 },
  mainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: Radius.pill,
  },
});
