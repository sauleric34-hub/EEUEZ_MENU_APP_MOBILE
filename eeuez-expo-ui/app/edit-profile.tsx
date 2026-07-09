// ═══════════════════════════════════════════════════════════
//  Modifier mon profil — nom, téléphone, allergies, photo
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, User, Phone, TriangleAlert, Check, Camera, type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { absMedia } from '../data/menuData';
import { ScreenBg } from '../components/ScreenBg';
import { PressableScale, displayFont, bodyFont } from '../components/ui';

const ALLERGY_CHOICES = ['Arachides', 'Gluten', 'Lactose', 'Fruits de mer', 'Œufs', 'Soja'];

function Field({ Icon, colors, ...inputProps }: {
  Icon: LucideIcon; colors: any;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon size={17} color={Brand.accentLight} strokeWidth={2.2} />
      <TextInput placeholderTextColor={colors.faint} style={[styles.fieldInput, { color: colors.text }]} {...inputProps} />
    </View>
  );
}

export default function EditProfileScreen() {
  const { colors, user, updateUser } = useApp();
  const router = useRouter();

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.telephone ?? '');
  const initialAllergies = (user?.allergies ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const [allergies, setAllergies] = useState<string[]>(initialAllergies.filter(a => ALLERGY_CHOICES.includes(a)));
  const [otherAllergy, setOtherAllergy] = useState(initialAllergies.filter(a => !ALLERGY_CHOICES.includes(a)).join(', '));
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAvatar = avatarUri ?? absMedia(user?.avatar ?? null);

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

  const save = async () => {
    if (!firstName.trim()) { setError('Veuillez saisir votre prénom.'); return; }
    if (phone.trim() && !/^[0-9+\s-]{8,15}$/.test(phone.trim())) { setError('Numéro de téléphone invalide.'); return; }
    setBusy(true); setError(null);
    const allAllergies = [...allergies, ...(otherAllergy.trim() ? [otherAllergy.trim()] : [])].join(', ');
    try {
      await updateUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        telephone: phone.trim(),
        allergies: allAllergies,
        ...(avatarUri ? { avatarUri } : {}),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La mise à jour a échoué.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <PressableScale onPress={() => router.back()}>
                <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ChevronLeft size={20} color={colors.text} />
                </View>
              </PressableScale>
              <Text style={[displayFont(23, '800'), { color: colors.text }]}>Mon profil</Text>
            </View>

            {/* Avatar */}
            <View style={{ alignItems: 'center', marginTop: 22, marginBottom: 8 }}>
              <PressableScale onPress={pickAvatar} scaleTo={0.94}>
                <View style={[styles.avatarRing, { borderColor: Brand.accent + '55' }]}>
                  {currentAvatar ? (
                    <Image source={{ uri: currentAvatar }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarImg, styles.avatarEmpty, { backgroundColor: colors.surface }]}>
                      <User size={40} color={colors.faint} strokeWidth={1.8} />
                    </View>
                  )}
                  <View style={[styles.avatarBadge, glow(Brand.accent, 10)]}>
                    <Camera size={16} color="#fff" strokeWidth={2.4} />
                  </View>
                </View>
              </PressableScale>
              <Text style={[bodyFont(12, '600'), { color: colors.muted, marginTop: 8 }]}>Changer la photo</Text>
            </View>

            <View style={{ marginTop: 12, gap: 12 }}>
              <Field Icon={User} colors={colors} value={firstName} onChangeText={setFirstName} placeholder="Prénom" />
              <Field Icon={User} colors={colors} value={lastName} onChangeText={setLastName} placeholder="Nom" />
              <Field Icon={Phone} colors={colors} value={phone} onChangeText={setPhone} placeholder="Téléphone" keyboardType="phone-pad" />

              <View style={[styles.allergyBox, { backgroundColor: Brand.yellow + '0d', borderColor: Brand.yellow + '30' }]}>
                <View style={styles.allergyHead}>
                  <TriangleAlert size={16} color={Brand.yellow} strokeWidth={2.3} />
                  <Text style={[bodyFont(13, '800'), { color: Brand.yellow }]}>Allergies alimentaires</Text>
                </View>
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
              </View>
            </View>

            {error && (
              <View style={styles.errRow}>
                <TriangleAlert size={15} color={Brand.danger} strokeWidth={2.3} />
                <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', flex: 1 }]}>{error}</Text>
              </View>
            )}

            <PressableScale onPress={busy ? undefined : save} style={{ marginTop: 22 }}>
              <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mainBtn, glow(Brand.accent, 20)]}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Check size={19} color="#fff" strokeWidth={2.8} />
                    <Text style={[bodyFont(15.5, '800'), { color: '#fff' }]}>Enregistrer</Text>
                  </>
                )}
              </LinearGradient>
            </PressableScale>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 30, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 2, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 92, height: 92, borderRadius: 46 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17,
    backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#080c09',
  },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: 1,
  },
  fieldInput: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 14 },
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
