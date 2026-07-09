// ═══════════════════════════════════════════════════════════
//  Profil client
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Sun, Moon, Settings, ChefHat, Bike, Check, Clock, Package, X, LogOut, TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { formatPrice, gradForId, iconForResto } from '../../data/menuData';
import type { CommandeDTO } from '../../services/dto';
import { ScreenBg } from '../../components/ScreenBg';
import {
  IconButton, DishTile, PressableScale, StatusPill, SectionTitle, displayFont, bodyFont,
} from '../../components/ui';

const STATUT: Record<string, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  en_attente:     { label: 'En attente',     color: Brand.yellow,      bg: Brand.yellow + '18', Icon: Clock },
  acceptee:       { label: 'Acceptée',       color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Check },
  en_preparation: { label: 'En préparation', color: Brand.yellow,      bg: Brand.yellow + '18', Icon: ChefHat },
  prete:          { label: 'Prête',          color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Package },
  en_livraison:   { label: 'En livraison',   color: Brand.accentLight, bg: Brand.accent + '1f', Icon: Bike },
  livree:         { label: 'Livrée',         color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Check },
  refusee:        { label: 'Refusée',        color: '#ff6b70',         bg: Brand.danger + '1f', Icon: X },
  annulee:        { label: 'Annulée',        color: '#ff6b70',         bg: Brand.danger + '1f', Icon: X },
};

function OrderRow({ order }: { order: CommandeDTO }) {
  const { colors, restoById } = useApp();
  const router = useRouter();
  const resto = order.restaurant ? restoById(order.restaurant) : undefined;
  const name = order.restaurant_details?.nom || resto?.name || 'Commande';
  const Icon = resto?.icon ?? iconForResto(name, order.restaurant ?? 0);
  const grad = resto?.grad ?? gradForId(order.restaurant ?? 0);
  const st = STATUT[order.statut] ?? STATUT.en_attente;
  const date = new Date(order.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const canTrack = !['livree', 'refusee', 'annulee'].includes(order.statut);

  return (
    <View style={[styles.order, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <DishTile Icon={Icon} grad={grad} size={56} iconSize={24} radius={15} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[displayFont(14, '700'), { color: colors.text }]}>{name}</Text>
        <Text style={[bodyFont(11, '500'), { color: colors.muted, marginTop: 2 }]}>{date} · {formatPrice(Number(order.montant_total))}</Text>
        <StatusPill Icon={st.Icon} label={st.label} color={st.color} bg={st.bg} style={{ marginTop: 7 }} />
      </View>
      {canTrack && (
        <PressableScale onPress={() => router.push('/tracking')}>
          <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trackBtn}>
            <Text style={[bodyFont(12.5, '800'), { color: '#fff' }]}>Suivre</Text>
          </LinearGradient>
        </PressableScale>
      )}
    </View>
  );
}

export default function ProfilScreen() {
  const { colors, mode, toggleTheme, user, favList, orders, signOut } = useApp();
  const router = useRouter();
  const favCount = favList.length;

  const displayName = user
    ? (`${user.first_name} ${user.last_name}`.trim() || user.username || user.email)
    : 'Invité';
  const email = user?.email ?? '';

  const logout = async () => { await signOut(); router.replace('/'); };

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Text style={[displayFont(24, '800'), { color: colors.text }]}>Profil</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <IconButton Icon={mode === 'dark' ? Sun : Moon} onPress={toggleTheme} colors={colors} />
              <IconButton Icon={Settings} onPress={() => router.push('/settings')} colors={colors} />
            </View>
          </View>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <LinearGradient colors={[Brand.yellow, Brand.accent, Brand.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
              <LinearGradient colors={[Brand.green, Brand.greenDark]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.avatar, { borderColor: colors.page }]}>
                <ChefHat size={40} color="#fff" strokeWidth={1.9} />
              </LinearGradient>
            </LinearGradient>
            <Text style={[displayFont(21, '800'), { color: colors.text, marginTop: 12 }]}>{displayName}</Text>
            {!!email && <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 3 }]}>{email}</Text>}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { v: String(orders.length), l: 'Commandes', c: Brand.yellow },
              { v: String(favCount), l: 'Favoris', c: '#ff6b70' },
              { v: String(orders.length * 10), l: 'Points', c: Brand.accentLight },
            ].map(s => (
              <View key={s.l} style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[displayFont(20, '800'), { color: s.c }]}>{s.v}</Text>
                <Text style={[bodyFont(11, '600'), { color: colors.muted, marginTop: 2 }]}>{s.l}</Text>
              </View>
            ))}
          </View>

          {/* Favoris */}
          <SectionTitle title="Mes favoris" colors={colors} action="Tout voir" onAction={() => router.push('/favoris')} />
          {favCount > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
              {favList.map(d => (
                <PressableScale key={d.id} onPress={() => router.push(`/dish/${d.id}`)}>
                  <View style={[styles.favMini, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <DishTile Icon={d.icon} grad={d.grad} image={d.image} iconSize={30} radius={0} style={{ height: 76 }} />
                    <Text numberOfLines={1} style={[displayFont(12.5, '700'), { color: colors.text, padding: 10 }]}>{d.name}</Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[bodyFont(13, '500'), { color: colors.muted, textAlign: 'center' }]}>Aucun favori pour l'instant.</Text>
            </View>
          )}

          {/* Commandes */}
          <Text style={[displayFont(18, '700'), { color: colors.text, marginTop: 24 }]}>Mes commandes</Text>
          {orders.length > 0 ? (
            <View style={{ gap: 12, marginTop: 12 }}>
              {orders.map(o => <OrderRow key={o.id} order={o} />)}
            </View>
          ) : (
            <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[bodyFont(13, '500'), { color: colors.muted, textAlign: 'center' }]}>Aucune commande pour l'instant.</Text>
            </View>
          )}

          {/* Allergies (renseignées à l'inscription) */}
          {!!user?.allergies && (
            <View style={[styles.allergy, { backgroundColor: Brand.yellow + '0f', borderColor: Brand.yellow + '33' }]}>
              <TriangleAlert size={22} color={Brand.yellow} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={[bodyFont(12, '800'), { color: Brand.yellow, letterSpacing: 0.6 }]}>ALLERGIES ENREGISTRÉES</Text>
                <Text style={[bodyFont(13.5, '500'), { color: colors.text, marginTop: 4 }]}>
                  {user.allergies.split(',').map(a => a.trim()).filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          )}

          {/* Déconnexion */}
          <PressableScale onPress={logout} style={{ marginTop: 20 }}>
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarWrap: { alignItems: 'center', marginTop: 14 },
  avatarRing: { padding: 4, borderRadius: 999 },
  avatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  stat: { flex: 1, paddingVertical: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  favMini: { width: 120, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  note: { padding: 18, borderRadius: 18, borderWidth: 1, marginTop: 12 },
  order: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: 20, borderWidth: 1 },
  trackBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill },
  allergy: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15, borderRadius: 20, borderWidth: 1, marginTop: 20 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: Radius.pill, borderWidth: 1 },
});
