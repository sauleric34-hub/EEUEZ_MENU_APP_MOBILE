// ═══════════════════════════════════════════════════════════
//  Mes commandes — historique complet, filtré par onglet
//  (En cours / Terminées / Annulées), avec suivi et
//  « Commander à nouveau ».
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, PackageSearch } from 'lucide-react-native';
import { Brand, Radius } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { ScreenBg } from '../components/ScreenBg';
import { CascadeReveal, CenterMessage, PressableScale, bodyFont, displayFont } from '../components/ui';
import { LiveOrderCard, OrderHistoryCard, estAnnulee, estEnCours } from '../components/orders';
import { animateListChange } from '../lib/layoutAnimation';
import type { CommandeDTO } from '../services/dto';

type Onglet = 'en_cours' | 'terminees' | 'annulees';
const ONGLETS: { key: Onglet; label: string; filtre: (o: CommandeDTO) => boolean; vide: string }[] = [
  { key: 'en_cours', label: 'En cours', filtre: estEnCours, vide: 'Aucune commande en cours.' },
  { key: 'terminees', label: 'Terminées', filtre: o => !estEnCours(o) && !estAnnulee(o), vide: 'Aucune commande terminée.' },
  { key: 'annulees', label: 'Annulées', filtre: estAnnulee, vide: 'Aucune commande annulée.' },
];

export default function CommandesScreen() {
  const { colors, orders, reloadOrders } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [onglet, setOnglet] = useState<Onglet>(() => (orders.some(estEnCours) ? 'en_cours' : 'terminees'));
  const [refreshing, setRefreshing] = useState(false);

  const compteurs = useMemo(
    () => Object.fromEntries(ONGLETS.map(o => [o.key, orders.filter(o.filtre).length])) as Record<Onglet, number>,
    [orders],
  );
  const courant = ONGLETS.find(o => o.key === onglet)!;
  const liste = useMemo(() => orders.filter(courant.filtre), [orders, courant]);

  const onRefresh = async () => {
    setRefreshing(true);
    const ok = await reloadOrders();
    if (!ok) toast.error('Impossible de rafraîchir vos commandes. Vérifiez votre connexion.');
    setRefreshing(false);
  };

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()}>
            <View style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ChevronLeft size={20} color={colors.text} />
            </View>
          </PressableScale>
          <View>
            <Text style={[displayFont(22, '800'), { color: colors.text }]}>Mes commandes</Text>
            <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 1 }]}>
              {orders.length} commande{orders.length > 1 ? 's' : ''} au total
            </Text>
          </View>
        </View>

        {/* Onglets */}
        <View style={[styles.tabs, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
          {ONGLETS.map(o => {
            const actif = o.key === onglet;
            return (
              <PressableScale key={o.key} style={{ flex: 1 }} scaleTo={0.97} onPress={() => { animateListChange(); setOnglet(o.key); }}>
                <View style={[styles.tab, actif && { backgroundColor: colors.page }]}>
                  <Text style={[bodyFont(13, actif ? '800' : '700'), { color: actif ? colors.text : colors.muted }]}>{o.label}</Text>
                  {compteurs[o.key] > 0 && (
                    <View style={[styles.tabCount, { backgroundColor: actif ? Brand.accent : colors.border }]}>
                      <Text style={[bodyFont(10, '900'), { color: actif ? '#fff' : colors.muted }]}>{compteurs[o.key]}</Text>
                    </View>
                  )}
                </View>
              </PressableScale>
            );
          })}
        </View>

        <FlatList
          data={liste}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 12, flexGrow: 1 }}
          renderItem={({ item, index }) => (
            <CascadeReveal key={`${onglet}-${item.id}`} index={Math.min(index, 6)}>
              {estEnCours(item) ? <LiveOrderCard order={item} /> : <OrderHistoryCard order={item} />}
            </CascadeReveal>
          )}
          ListEmptyComponent={<CenterMessage Icon={PackageSearch} colors={colors} title="Rien ici" subtitle={courant.vide} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.accent} colors={[Brand.accent]} />}
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews
        />
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginTop: 18, padding: 4, borderRadius: Radius.pill, borderWidth: 1 },
  tab: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: Radius.pill,
  },
  tabCount: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
