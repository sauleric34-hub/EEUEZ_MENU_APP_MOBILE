// ═══════════════════════════════════════════════════════════
//  Livreur · Profil — identité + compte Mobile Money + déconnexion
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LogOut, Smartphone } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, displayFont, bodyFont } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fetchLivreurProfile, updateLivreurProfile } from '../../services/livreur';

type Operateur = '' | 'mtn_money' | 'orange_money';

export default function LivreurProfilScreen() {
  const { colors, user, signOut } = useApp();
  const toast = useToast();
  const router = useRouter();

  const [prenom, setPrenom] = useState(user?.first_name ?? '');
  const [nom, setNom] = useState(user?.last_name ?? '');
  const [tel, setTel] = useState(user?.telephone ?? '');
  const [numero, setNumero] = useState(user?.paiement_numero ?? '');
  const [operateur, setOperateur] = useState<Operateur>((user?.paiement_operateur as Operateur) ?? '');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await fetchLivreurProfile();
      setPrenom(p.first_name ?? ''); setNom(p.last_name ?? ''); setTel(p.telephone ?? '');
      setNumero(p.paiement_numero ?? ''); setOperateur((p.paiement_operateur as Operateur) ?? '');
    } catch { /* garde l'état */ }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = useCallback(async () => {
    if (numero && !operateur) { toast.error('Choisissez l\'opérateur du numéro Mobile Money.'); return; }
    setSaving(true);
    try {
      await updateLivreurProfile({
        first_name: prenom, last_name: nom, telephone: tel,
        paiement_numero: numero.trim(), paiement_operateur: operateur,
      });
      toast.success('Profil enregistré.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }, [prenom, nom, tel, numero, operateur, toast]);

  const deconnexion = useCallback(async () => {
    await signOut();
    router.replace('/');
  }, [signOut, router]);

  const field = (label: string, value: string, setter: (v: string) => void, keyboard?: 'phone-pad') => (
    <View style={{ marginBottom: 12 }}>
      <Text style={[bodyFont(12, '700'), { color: colors.faint, marginBottom: 6 }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={value} onChangeText={setter} keyboardType={keyboard}
        placeholderTextColor={colors.faint}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />
    </View>
  );

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[displayFont(24, '800'), { color: colors.text }]}>Profil</Text>
          <Text style={[bodyFont(12.5, '500'), { color: colors.muted, marginTop: 2, marginBottom: 18 }]}>{user?.email}</Text>

          {field('Prénom', prenom, setPrenom)}
          {field('Nom', nom, setNom)}
          {field('Téléphone', tel, setTel, 'phone-pad')}

          <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.row}><Smartphone size={16} color={Brand.accentLight} strokeWidth={2.3} />
              <Text style={[bodyFont(13.5, '700'), { color: colors.text }]}>Compte Mobile Money</Text>
            </View>
            <Text style={[bodyFont(11.5, '500'), { color: colors.muted, marginTop: 4, marginBottom: 12 }]}>
              Cible des versements automatiques de vos gains.
            </Text>
            {field('Numéro', numero, setNumero, 'phone-pad')}
            <Text style={[bodyFont(12, '700'), { color: colors.faint, marginBottom: 6 }]}>OPÉRATEUR</Text>
            <View style={styles.row}>
              {(['mtn_money', 'orange_money'] as const).map(op => {
                const on = operateur === op;
                return (
                  <PressableScale key={op} onPress={() => setOperateur(op)} style={{ flex: 1 }}>
                    <View style={[styles.opBtn, {
                      borderColor: on ? Brand.accent : colors.border,
                      backgroundColor: on ? Brand.accent + '1f' : 'transparent',
                    }]}>
                      <Text style={[bodyFont(12.5, '700'), { color: on ? Brand.accentLight : colors.muted }]}>
                        {op === 'mtn_money' ? 'MTN Money' : 'Orange Money'}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <PressableScale onPress={save} disabled={saving} style={{ marginTop: 18 }}>
            <View style={[styles.primary, { backgroundColor: Brand.accent }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Enregistrer</Text>}
            </View>
          </PressableScale>

          <PressableScale onPress={deconnexion} style={{ marginTop: 12 }}>
            <View style={[styles.logout, { borderColor: Brand.danger + '55' }]}>
              <LogOut size={16} color={Brand.danger} />
              <Text style={[bodyFont(13.5, '800'), { color: Brand.danger }]}>Se déconnecter</Text>
            </View>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  section: { marginTop: 8, padding: 16, borderRadius: 18, borderWidth: 1 },
  opBtn: { paddingVertical: 12, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center' },
  primary: { paddingVertical: 15, borderRadius: Radius.pill, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  logout: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 14, borderRadius: Radius.pill, borderWidth: 1 },
});
