// ═══════════════════════════════════════════════════════════
//  Livreur · Gains — solde, versement automatique, historique
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Wallet, TrendingUp, Package } from 'lucide-react-native';
import { Brand } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, displayFont, bodyFont } from '../../components/ui';
import { fetchLivreurProfile } from '../../services/livreur';
import type { UserDTO } from '../../services/dto';

export default function GainsScreen() {
  const { colors, user } = useApp();
  const router = useRouter();
  const [profil, setProfil] = useState<UserDTO | null>(user);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await fetchLivreurProfile();
      setProfil(p);
    } catch { /* garde l'état */ }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  const solde = profil?.solde_livreur ?? 0;
  const total = Number(profil?.gain_total ?? 0);
  const nb = profil?.nombre_livraisons ?? 0;
  const sansCompte = !profil?.paiement_numero;

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.accent} colors={[Brand.accent]} />}
        >
          <Text style={[displayFont(24, '800'), { color: colors.text }]}>Gains</Text>

          <View style={[styles.hero, { backgroundColor: Brand.green + '18', borderColor: Brand.green + '44' }]}>
            <View style={styles.row}><Wallet size={18} color={Brand.green} strokeWidth={2.3} />
              <Text style={[bodyFont(13, '700'), { color: Brand.green }]}>Solde à verser</Text>
            </View>
            <Text style={[displayFont(34, '800'), { color: colors.text, marginTop: 6 }]}>{Math.round(solde)} F</Text>
            <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 4 }]}>
              Versé automatiquement sur votre compte Mobile Money dès qu'il atteint le seuil.
            </Text>
          </View>

          {sansCompte && (
            <PressableScale onPress={() => router.push('/(livreur)/profil')}>
              <View style={[styles.warn, { borderColor: Brand.yellow + '66', backgroundColor: Brand.yellow + '18' }]}>
                <Text style={[bodyFont(12.5, '700'), { color: Brand.yellow }]}>
                  Aucun compte Mobile Money enregistré — vos gains s'accumulent mais ne peuvent pas être versés. Renseignez-le dans Profil.
                </Text>
              </View>
            </PressableScale>
          )}

          <View style={styles.statRow}>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TrendingUp size={16} color={Brand.accentLight} />
              <Text style={[displayFont(18, '800'), { color: colors.text, marginTop: 6 }]}>{Math.round(total)} F</Text>
              <Text style={[bodyFont(11.5, '500'), { color: colors.faint }]}>Gagné au total</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Package size={16} color={Brand.accentLight} />
              <Text style={[displayFont(18, '800'), { color: colors.text, marginTop: 6 }]}>{nb}</Text>
              <Text style={[bodyFont(11.5, '500'), { color: colors.faint }]}>Livraisons</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hero: { padding: 20, borderRadius: 22, borderWidth: 1 },
  warn: { padding: 12, borderRadius: 14, borderWidth: 1 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, padding: 16, borderRadius: 18, borderWidth: 1 },
});
