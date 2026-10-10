// ═══════════════════════════════════════════════════════════
//  Modifier mon profil — photo, identité, contact, localisation,
//  allergies et raccourci sécurité. Jauge de complétude, validation
//  en direct, barre d'enregistrement qui n'apparaît qu'en cas de
//  modification, et garde-fou contre la perte de modifications.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Reanimated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  ChevronLeft, ChevronRight, User, Phone, Mail, Lock, TriangleAlert, Check, Camera, Image as ImageIcon,
  Trash2, KeyRound, MapPin, type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { absMedia } from '../data/menuData';
import { ScreenBg } from '../components/ScreenBg';
import { PressableScale, displayFont, bodyFont } from '../components/ui';
import { CountryField, CityField } from '../components/GeoFields';
import { ErrorNotice } from '../components/ErrorNotice';
import { countryName } from '../lib/geo';
import { describeError, type ErrorInfo } from '../services/errors';

const ALLERGY_CHOICES = ['Arachides', 'Gluten', 'Lactose', 'Fruits de mer', 'Œufs', 'Soja', 'Poisson', 'Piment'];
const TEL_REGEX = /^[0-9+\s-]{8,15}$/;

export default function EditProfileScreen() {
  const { colors, user, updateUser } = useApp();
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  // ─── Valeurs initiales (pour détecter les modifications) ──────
  const initial = useMemo(() => {
    const all = (user?.allergies ?? '').split(',').map(s => s.trim()).filter(Boolean);
    return {
      firstName: user?.first_name ?? '',
      lastName: user?.last_name ?? '',
      phone: user?.telephone ?? '',
      countryCode: user?.pays_code || null,
      city: user?.ville || null,
      allergies: all.filter(a => ALLERGY_CHOICES.includes(a)),
      other: all.filter(a => !ALLERGY_CHOICES.includes(a)).join(', '),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone);
  const [countryCode, setCountryCode] = useState<string | null>(initial.countryCode);
  const [city, setCity] = useState<string | null>(initial.city);
  const [allergies, setAllergies] = useState<string[]>(initial.allergies);
  const [otherAllergy, setOtherAllergy] = useState(initial.other);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarRetire, setAvatarRetire] = useState(false);
  const [touched, setTouched] = useState<{ prenom?: boolean; tel?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);

  const avatarServeur = absMedia(user?.avatar ?? null);
  const currentAvatar = avatarUri ?? (avatarRetire ? undefined : avatarServeur);

  // ─── Validation en direct ─────────────────────────────────────
  const prenomErreur = touched.prenom && !firstName.trim() ? 'Le prénom est requis.' : null;
  const telErreur = touched.tel && phone.trim() && !TEL_REGEX.test(phone.trim()) ? 'Numéro invalide (ex : 699 00 00 00).' : null;

  const sameList = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));
  const dirty =
    firstName !== initial.firstName || lastName !== initial.lastName || phone !== initial.phone ||
    countryCode !== initial.countryCode || city !== initial.city ||
    !sameList(allergies, initial.allergies) || otherAllergy !== initial.other ||
    !!avatarUri || avatarRetire;

  // Jauge de complétude : ce qui aide les restaurants et livreurs
  const completude = useMemo(() => {
    const items = [!!currentAvatar, !!firstName.trim() && !!lastName.trim(), TEL_REGEX.test(phone.trim()), !!city];
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  }, [currentAvatar, firstName, lastName, phone, city]);
  const jauge = useSharedValue(completude);
  useEffect(() => { jauge.value = withTiming(completude, { duration: 500 }); }, [completude, jauge]);
  const jaugeStyle = useAnimatedStyle(() => ({ width: `${jauge.value}%` }));

  // ─── Garde-fou : quitter avec des modifications non enregistrées ──
  const enregistre = useRef(false);
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (!dirty || busy || enregistre.current) return;
      e.preventDefault();
      Alert.alert('Modifications non enregistrées', 'Voulez-vous vraiment quitter sans enregistrer ?', [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation, dirty, busy]);

  // ─── Photo ────────────────────────────────────────────────────
  const choisirPhoto = async (source: 'galerie' | 'camera') => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      toast.error(source === 'camera' ? 'Autorisez l\'accès à la caméra dans les réglages.' : 'Autorisez l\'accès à vos photos dans les réglages.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!res.canceled && res.assets[0]) { setAvatarUri(res.assets[0].uri); setAvatarRetire(false); }
  };
  const retirerPhoto = () => { setAvatarUri(null); setAvatarRetire(true); };

  const toggleAllergy = (a: string) =>
    setAllergies(list => (list.includes(a) ? list.filter(x => x !== a) : [...list, a]));

  const chooseCountry = (code: string) => {
    if (code !== countryCode) setCity(null); // la ville dépend du pays
    setCountryCode(code);
  };

  // ─── Enregistrement ───────────────────────────────────────────
  const save = async () => {
    setTouched({ prenom: true, tel: true });
    if (!firstName.trim() || (phone.trim() && !TEL_REGEX.test(phone.trim()))) return;
    setBusy(true); setError(null);
    const allAllergies = [...allergies, ...(otherAllergy.trim() ? [otherAllergy.trim()] : [])].join(', ');
    try {
      await updateUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        telephone: phone.trim(),
        allergies: allAllergies,
        pays: countryCode ? countryName(countryCode) : '',
        pays_code: countryCode ?? '',
        ville: city ?? '',
        ...(avatarUri ? { avatarUri } : {}),
        ...(avatarRetire && !avatarUri ? { supprimerAvatar: true } : {}),
      });
      toast.success('Profil mis à jour ✓');
      // Les modifications sont enregistrées : on quitte sans le garde-fou
      enregistre.current = true;
      router.back();
    } catch (e) {
      setError(describeError(e, 'La mise à jour a échoué.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <PressableScale onPress={() => router.back()}>
                <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ChevronLeft size={20} color={colors.text} />
                </View>
              </PressableScale>
              <Text style={[displayFont(23, '800'), { color: colors.text }]}>Mes informations</Text>
            </View>

            {/* ─── Photo ─── */}
            <View style={{ alignItems: 'center', marginTop: 22 }}>
              <PressableScale onPress={() => choisirPhoto('galerie')} scaleTo={0.94}>
                <LinearGradient colors={[Brand.yellow, Brand.accent, Brand.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
                  {currentAvatar ? (
                    <ExpoImage source={{ uri: currentAvatar }} style={[styles.avatarImg, { borderColor: colors.page }]} />
                  ) : (
                    <View style={[styles.avatarImg, styles.avatarEmpty, { backgroundColor: colors.surface2, borderColor: colors.page }]}>
                      <Text style={[displayFont(34, '800'), { color: colors.muted }]}>
                        {(firstName.trim()[0] ?? '?').toUpperCase()}{(lastName.trim()[0] ?? '').toUpperCase()}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </PressableScale>
              <View style={styles.photoActions}>
                <PhotoBtn Icon={ImageIcon} label="Galerie" onPress={() => choisirPhoto('galerie')} />
                <PhotoBtn Icon={Camera} label="Caméra" onPress={() => choisirPhoto('camera')} />
                {!!currentAvatar && <PhotoBtn Icon={Trash2} label="Retirer" danger onPress={retirerPhoto} />}
              </View>
            </View>

            {/* ─── Complétude ─── */}
            <View style={[styles.completude, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.row}>
                <Text style={[bodyFont(13, '800'), { color: colors.text, flex: 1 }]}>
                  {completude === 100 ? 'Profil complet 🎉' : 'Complétez votre profil'}
                </Text>
                <Text style={[bodyFont(13, '900'), { color: completude === 100 ? Brand.green : Brand.accentLight }]}>{completude}%</Text>
              </View>
              <View style={[styles.jauge, { backgroundColor: colors.border }]}>
                <Reanimated.View style={[styles.jaugeFill, { backgroundColor: completude === 100 ? Brand.green : Brand.accent }, jaugeStyle]} />
              </View>
              {completude < 100 && (
                <Text style={[bodyFont(11.5, '500'), { color: colors.muted, marginTop: 7 }]}>
                  Un profil complet aide les restaurants et les livreurs à vous servir plus vite.
                </Text>
              )}
            </View>

            {/* ─── Identité ─── */}
            <Section titre="Identité">
              <Champ label="Prénom *" Icon={User} value={firstName} onChangeText={setFirstName}
                onBlur={() => setTouched(t => ({ ...t, prenom: true }))} erreur={prenomErreur}
                placeholder="Votre prénom" autoCapitalize="words" textContentType="givenName" />
              <Champ label="Nom" Icon={User} value={lastName} onChangeText={setLastName}
                placeholder="Votre nom" autoCapitalize="words" textContentType="familyName" />
            </Section>

            {/* ─── Contact ─── */}
            <Section titre="Contact">
              <Champ label="E-mail" Icon={Mail} value={user?.email ?? ''} editable={false} verrou
                aide="Pour changer d'adresse e-mail, contactez le support." />
              <Champ label="Téléphone" Icon={Phone} value={phone} onChangeText={setPhone}
                onBlur={() => setTouched(t => ({ ...t, tel: true }))} erreur={telErreur}
                placeholder="699 00 00 00" keyboardType="phone-pad" textContentType="telephoneNumber"
                aide={!telErreur ? 'Utilisé par le livreur pour vous joindre.' : undefined} />
            </Section>

            {/* ─── Localisation ─── */}
            <Section titre="Localisation" Icon={MapPin}>
              <View style={{ gap: 10 }}>
                <CountryField code={countryCode} onChange={chooseCountry} colors={colors} />
                {countryCode && <CityField countryCode={countryCode} city={city} onChange={setCity} colors={colors} />}
              </View>
            </Section>

            {/* ─── Allergies ─── */}
            <Section titre="Allergies alimentaires" Icon={TriangleAlert} iconColor={Brand.yellow}>
              <Text style={[bodyFont(12.5, '500'), { color: colors.muted, marginBottom: 10 }]}>
                Transmises au restaurant avec chacune de vos commandes.
              </Text>
              <View style={styles.allergyChips}>
                {ALLERGY_CHOICES.map(a => {
                  const on = allergies.includes(a);
                  return (
                    <PressableScale key={a} onPress={() => toggleAllergy(a)} scaleTo={0.93}>
                      <View style={[
                        styles.chip,
                        on ? { backgroundColor: Brand.yellow, borderColor: Brand.yellow }
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
            </Section>

            {/* ─── Sécurité ─── */}
            <Section titre="Sécurité" Icon={KeyRound} iconColor={Brand.green}>
              <PressableScale onPress={() => router.push('/change-password')} scaleTo={0.98}>
                <View style={[styles.lien, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.lienIcon, { backgroundColor: Brand.green + '22' }]}>
                    <Lock size={17} color="#4fc78a" strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[bodyFont(14, '700'), { color: colors.text }]}>Changer mon mot de passe</Text>
                    <Text style={[bodyFont(11.5, '500'), { color: colors.muted, marginTop: 1 }]}>Confirmation par code e-mail</Text>
                  </View>
                  <ChevronRight size={18} color={colors.faint} />
                </View>
              </PressableScale>
            </Section>

            {error && <ErrorNotice key={error.message} error={error} onRetry={save} style={{ marginTop: 18 }} />}
          </ScrollView>

          {/* ─── Barre d'enregistrement (seulement s'il y a des modifications) ─── */}
          {dirty && (
            <Reanimated.View
              entering={FadeInDown.duration(260)} exiting={FadeOutDown.duration(200)}
              style={[styles.saveBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.page, borderTopColor: colors.border }]}
            >
              <Text style={[bodyFont(12, '700'), { color: colors.muted, flex: 1 }]}>Modifications{'\n'}non enregistrées</Text>
              <PressableScale onPress={busy ? undefined : save}>
                <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mainBtn, glow(Brand.accent, 16)]}>
                  {busy ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Check size={18} color="#fff" strokeWidth={2.8} />
                      <Text style={[bodyFont(15, '800'), { color: '#fff' }]}>Enregistrer</Text>
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
            </Reanimated.View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBg>
  );
}

function Section({ titre, Icon, iconColor, children }: {
  titre: string; Icon?: LucideIcon; iconColor?: string; children: React.ReactNode;
}) {
  const { colors } = useApp();
  return (
    <View style={{ marginTop: 26 }}>
      <View style={[styles.row, { gap: 7, marginBottom: 12 }]}>
        {Icon && <Icon size={14} color={iconColor ?? colors.faint} strokeWidth={2.5} />}
        <Text style={[bodyFont(12, '800'), { color: colors.faint, letterSpacing: 1 }]}>{titre.toUpperCase()}</Text>
      </View>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

function Champ({ label, Icon, erreur, aide, verrou, ...inputProps }: {
  label: string; Icon: LucideIcon; erreur?: string | null; aide?: string; verrou?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  const { colors } = useApp();
  const [focus, setFocus] = useState(false);
  const bord = erreur ? Brand.danger : focus ? Brand.accent : colors.border;
  return (
    <View>
      <Text style={[bodyFont(12, '700'), { color: colors.muted, marginBottom: 6, marginLeft: 4 }]}>{label}</Text>
      <View style={[styles.field, { backgroundColor: verrou ? colors.surface2 : colors.surface, borderColor: bord }]}>
        <Icon size={17} color={erreur ? Brand.danger : Brand.accentLight} strokeWidth={2.2} />
        <TextInput
          placeholderTextColor={colors.faint}
          style={[styles.fieldInput, { color: verrou ? colors.muted : colors.text }]}
          {...inputProps}
          onFocus={e => { setFocus(true); inputProps.onFocus?.(e); }}
          onBlur={e => { setFocus(false); inputProps.onBlur?.(e); }}
        />
        {verrou && <Lock size={15} color={colors.faint} strokeWidth={2.3} />}
      </View>
      {!!(erreur || aide) && (
        <Text style={[bodyFont(11.5, '600'), { color: erreur ? '#ff6b70' : colors.faint, marginTop: 5, marginLeft: 4 }]}>{erreur || aide}</Text>
      )}
    </View>
  );
}

function PhotoBtn({ Icon, label, onPress, danger }: { Icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useApp();
  const c = danger ? '#ff6b70' : colors.text;
  return (
    <PressableScale onPress={onPress} scaleTo={0.93}>
      <View style={[styles.photoBtn, { backgroundColor: danger ? Brand.danger + '14' : colors.surface, borderColor: danger ? Brand.danger + '33' : colors.border }]}>
        <Icon size={14} color={c} strokeWidth={2.4} />
        <Text style={[bodyFont(12, '700'), { color: c }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 8, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { padding: 4, borderRadius: 999 },
  avatarImg: { width: 104, height: 104, borderRadius: 52, borderWidth: 3 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  photoActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1,
  },
  completude: { marginTop: 22, padding: 15, borderRadius: 18, borderWidth: 1 },
  jauge: { height: 7, borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  jaugeFill: { height: '100%', borderRadius: 4 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: 1.5,
  },
  fieldInput: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 13 },
  allergyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1,
  },
  otherInput: { marginTop: 12, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, fontWeight: '500' },
  lien: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 18, borderWidth: 1 },
  lienIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 22, paddingTop: 12, borderTopWidth: 1,
  },
  mainBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: Radius.pill },
});
