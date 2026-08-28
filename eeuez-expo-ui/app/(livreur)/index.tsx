// ═══════════════════════════════════════════════════════════
//  Livreur · Missions — pool des courses en livraison libre
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { PackageSearch, MapPin, Store, Banknote } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, CenterMessage, displayFont, bodyFont } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fetchPool, acceptMission } from '../../services/livreur';
import type { MissionPoolDTO } from '../../services/dto';

export default function MissionsScreen() {
  const { colors, user } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [pool, setPool] = useState<MissionPoolDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setPool(await fetchPool());
    } catch {
      /* silencieux — l'écran reste sur les dernières missions connues */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const accepter = useCallback(async (m: MissionPoolDTO) => {
    setAccepting(m.id);
    try {
      await acceptMission(m.id);
      toast.success('Mission acceptée. Bonne route !');
      router.push(`/mission/${m.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de prendre cette mission.');
      load();
    } finally {
      setAccepting(null);
    }
  }, [toast, router, load]);

  const sansCompte = !user?.paiement_numero;

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={[displayFont(24, '800'), { color: colors.text }]}>Missions</Text>
          <Text style={[bodyFont(12.5, '500'), { color: colors.muted, marginTop: 2 }]}>
            Courses libres à prendre — premier arrivé, premier servi.
          </Text>
        </View>

        {sansCompte && (
          <PressableScale onPress={() => router.push('/(livreur)/profil')}>
            <View style={[styles.warn, { borderColor: Brand.yellow + '66', backgroundColor: Brand.yellow + '18' }]}>
              <Text style={[bodyFont(12.5, '700'), { color: Brand.yellow }]}>
                Ajoutez votre numéro Mobile Money dans Profil pour être payé automatiquement.
              </Text>
            </View>
          </PressableScale>
        )}

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={Brand.accent} /></View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.accent} colors={[Brand.accent]} />}
          >
            {pool.length === 0 ? (
              <CenterMessage
                Icon={PackageSearch} colors={colors}
                title="Aucune mission pour l'instant"
                subtitle="Les nouvelles courses libérées par les restaurants apparaîtront ici."
              />
            ) : pool.map(m => (
              <View key={m.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.row}>
                  <Store size={16} color={Brand.green} strokeWidth={2.2} />
                  <Text style={[bodyFont(14.5, '700'), { color: colors.text, flex: 1 }]} numberOfLines={1}>
                    {m.restaurant?.nom ?? 'Restaurant'}
                  </Text>
                </View>
                <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 2 }]} numberOfLines={1}>
                  {m.restaurant?.adresse}
                </Text>
                <View style={[styles.row, { marginTop: 8 }]}>
                  <MapPin size={15} color={Brand.accent} strokeWidth={2.2} />
                  <Text style={[bodyFont(13, '600'), { color: colors.text }]}>Vers {m.zone_livraison || '—'}</Text>
                </View>

                <View style={[styles.row, { marginTop: 12, justifyContent: 'space-between' }]}>
                  <View style={styles.row}>
                    <Banknote size={16} color={Brand.green} strokeWidth={2.2} />
                    <Text style={[displayFont(16, '800'), { color: Brand.green }]}>
                      +{Math.round(Number(m.part_livreur))} F
                    </Text>
                    <Text style={[bodyFont(11.5, '500'), { color: colors.faint }]}>
                      · {m.nb_articles} article{m.nb_articles > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <PressableScale onPress={() => accepter(m)} disabled={accepting === m.id} style={{ marginTop: 14 }}>
                  <View style={[styles.cta, { backgroundColor: Brand.accent }]}>
                    {accepting === m.id
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={[bodyFont(14.5, '800'), { color: '#fff' }]}>Accepter la mission</Text>}
                  </View>
                </PressableScale>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  warn: { marginHorizontal: 20, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  card: { padding: 16, borderRadius: 20, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cta: { paddingVertical: 14, borderRadius: Radius.pill, alignItems: 'center' },
});
