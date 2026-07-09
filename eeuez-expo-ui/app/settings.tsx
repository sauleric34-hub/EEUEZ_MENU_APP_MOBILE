// ═══════════════════════════════════════════════════════════
//  Paramètres — préférences réelles (thème, notifications…)
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, ChevronRight, Moon, Bell, Tag, User, Mail, Phone,
  TriangleAlert, ShieldCheck, CircleHelp, Info, LogOut, Pencil, MapPin, type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { ScreenBg } from '../components/ScreenBg';
import { PressableScale, displayFont, bodyFont } from '../components/ui';

const APP_VERSION = '1.0.0';
const SUPPORT_EMAIL = 'support@menu.cm';

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={[bodyFont(12, '800'), { color: colors.faint, letterSpacing: 1, marginBottom: 10 }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({ Icon, iconColor, label, value, onPress, right, colors, last }: {
  Icon: LucideIcon; iconColor?: string; label: string; value?: string;
  onPress?: () => void; right?: React.ReactNode; colors: any; last?: boolean;
}) {
  const body = (
    <View style={[styles.rowItem, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: (iconColor ?? Brand.accent) + '1c' }]}>
        <Icon size={17} color={iconColor ?? Brand.accentLight} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[bodyFont(14, '700'), { color: colors.text }]}>{label}</Text>
        {value != null && <Text numberOfLines={1} style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 2 }]}>{value}</Text>}
      </View>
      {right ?? (onPress && <ChevronRight size={18} color={colors.faint} />)}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress} scaleTo={0.98}>{body}</PressableScale> : body;
}

export default function SettingsScreen() {
  const {
    colors, mode, toggleTheme, user, signOut,
    notifsEnabled, setNotifsEnabled, promoEnabled, setPromoEnabled,
  } = useApp();
  const router = useRouter();

  const switchColors = {
    trackColor: { false: colors.surface2, true: Brand.accent + '88' },
    thumbColor: Brand.accent,
  };

  const logout = async () => { await signOut(); router.replace('/'); };

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <PressableScale onPress={() => router.back()}>
              <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ChevronLeft size={20} color={colors.text} />
              </View>
            </PressableScale>
            <Text style={[displayFont(24, '800'), { color: colors.text }]}>Paramètres</Text>
          </View>

          <Section title="Compte" colors={colors}>
            <Row Icon={User} label="Nom" value={user ? `${user.first_name} ${user.last_name}`.trim() || user.username : '—'} colors={colors} />
            <Row Icon={Mail} label="Email" value={user?.email || '—'} colors={colors} />
            <Row Icon={Phone} label="Téléphone" value={user?.telephone || 'Non renseigné'} colors={colors} />
            <Row Icon={TriangleAlert} iconColor={Brand.yellow} label="Allergies" value={user?.allergies || 'Aucune enregistrée'} colors={colors} />
            <Row Icon={Pencil} label="Modifier mes informations" colors={colors} onPress={() => router.push('/edit-profile')} />
            <Row Icon={MapPin} label="Mes lieux de livraison" colors={colors} onPress={() => router.push('/location-picker')} last />
          </Section>

          <Section title="Préférences" colors={colors}>
            <Row
              Icon={Moon} label="Mode sombre" colors={colors}
              right={<Switch value={mode === 'dark'} onValueChange={toggleTheme} {...switchColors} />}
            />
            <Row
              Icon={Bell} label="Notifications de commande" colors={colors}
              right={<Switch value={notifsEnabled} onValueChange={setNotifsEnabled} {...switchColors} />}
            />
            <Row
              Icon={Tag} label="Offres et promotions" colors={colors} last
              right={<Switch value={promoEnabled} onValueChange={setPromoEnabled} {...switchColors} />}
            />
          </Section>

          <Section title="Assistance" colors={colors}>
            <Row
              Icon={CircleHelp} iconColor={Brand.green} label="Aide & support"
              value={SUPPORT_EMAIL} colors={colors}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
            />
            <Row Icon={ShieldCheck} iconColor={Brand.green} label="Confidentialité" value="Vos données restent au Cameroun" colors={colors} />
            <Row Icon={Info} iconColor={Brand.green} label="Version de l'application" value={APP_VERSION} colors={colors} last />
          </Section>

          <PressableScale onPress={logout} style={{ marginTop: 28 }}>
            <View style={[styles.logout, { backgroundColor: Brand.danger + '14', borderColor: Brand.danger + '33' }]}>
              <LogOut size={18} color="#ff6b70" strokeWidth={2.3} />
              <Text style={[bodyFont(14.5, '800'), { color: '#ff6b70' }]}>Se déconnecter</Text>
            </View>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  section: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: Radius.pill, borderWidth: 1,
  },
});
