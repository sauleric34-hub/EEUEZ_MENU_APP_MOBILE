// ═══════════════════════════════════════════════════════════
//  Livreur · Courses — missions en cours
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bike, ChevronRight, Store, MapPin } from 'lucide-react-native';
import { Brand } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, CenterMessage, displayFont, bodyFont } from '../../components/ui';
import { fetchMesCourses } from '../../services/livreur';
import type { CourseDTO } from '../../services/dto';

const ETAPE: Record<string, string> = {
  assignee: 'À démarrer',
  en_collecte: 'En route vers le resto',
  en_livraison: 'En livraison',
  livree_sans_code: 'À valider par l\'équipe',
};

export default function CoursesScreen() {
  const { colors } = useApp();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setCourses(await fetchMesCourses()); } catch { /* garde l'état */ }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={[displayFont(24, '800'), { color: colors.text }]}>Courses</Text>
          <Text style={[bodyFont(12.5, '500'), { color: colors.muted, marginTop: 2 }]}>
            {courses.length} course{courses.length > 1 ? 's' : ''} en cours
          </Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={Brand.accent} /></View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.accent} colors={[Brand.accent]} />}
          >
            {courses.length === 0 ? (
              <CenterMessage
                Icon={Bike} colors={colors}
                title="Aucune course en cours"
                subtitle="Prenez une mission dans l'onglet Missions pour démarrer."
              />
            ) : courses.map(c => (
              <PressableScale key={c.id} onPress={() => router.push(`/mission/${c.id}`)}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.row}>
                      <Store size={15} color={Brand.green} strokeWidth={2.2} />
                      <Text style={[bodyFont(14, '700'), { color: colors.text }]} numberOfLines={1}>
                        {c.restaurant_details?.nom ?? 'Restaurant'}
                      </Text>
                    </View>
                    <View style={[styles.row, { marginTop: 4 }]}>
                      <MapPin size={14} color={Brand.accent} strokeWidth={2.2} />
                      <Text style={[bodyFont(12.5, '500'), { color: colors.muted }]} numberOfLines={1}>
                        {c.adresse_livraison || '—'}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: Brand.accent + '1f', marginTop: 8 }]}>
                      <Text style={[bodyFont(11, '800'), { color: Brand.accentLight }]}>
                        {ETAPE[c.livraison.statut] ?? c.livraison.statut}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.faint} />
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 20, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
