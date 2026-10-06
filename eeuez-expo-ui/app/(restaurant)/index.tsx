// ═══════════════════════════════════════════════════════════
//  Dashboard Restaurant — tableau de bord du gérant
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LayoutDashboard, TrendingUp, ShoppingBag,
  CheckCircle2, Clock, XCircle, ChefHat,
} from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { displayFont, bodyFont } from '../../components/ui';
import { ScreenBg } from '../../components/ScreenBg';
import { fetchCommandesResto } from '../../services/restoMenu';
import type { CommandeDTO } from '../../services/dto';

function StatCard({ label, value, sub, color, Icon }: {
  label: string; value: string | number; sub?: string;
  color: string; Icon: any;
}) {
  const { colors } = useApp();
  return (
    <View style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[s.statIcon, { backgroundColor: color + '18' }]}>
        <Icon size={20} color={color} strokeWidth={2.2} />
      </View>
      <Text style={[displayFont(26, '800'), { color: colors.text, marginTop: 10 }]}>{value}</Text>
      <Text style={[bodyFont(12, '700'), { color: colors.muted }]}>{label}</Text>
      {sub && <Text style={[bodyFont(11, '600'), { color: colors.faint, marginTop: 2 }]}>{sub}</Text>}
    </View>
  );
}

export default function DashboardScreen() {
  const { colors } = useApp();
  const [commandes, setCommandes] = useState<CommandeDTO[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const charger = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      setCommandes(await fetchCommandesResto());
    } catch { /* silencieux */ } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Stats du jour
  const today = new Date().toISOString().slice(0, 10);
  const duJour = commandes.filter(c => c.created_at.startsWith(today));
  const enCours = duJour.filter(c => ['en_attente', 'confirmee', 'en_preparation'].includes(c.statut));
  const livrees  = duJour.filter(c => ['livree', 'recuperee'].includes(c.statut));
  const refusees = duJour.filter(c => ['refusee', 'annulee'].includes(c.statut));
  const caJour = duJour.reduce((a, c) => a + parseFloat(c.montant_total), 0);

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} style={s.headerIcon}>
            <LayoutDashboard size={22} color="#fff" strokeWidth={2} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[displayFont(20, '800'), { color: colors.text }]}>Dashboard</Text>
            <Text style={[bodyFont(12, '600'), { color: colors.muted }]}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => charger(true)} tintColor={Brand.accent} />
          }
        >
          {/* CA du jour */}
          <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.caCard}>
            <TrendingUp size={28} color="#fff" strokeWidth={2} />
            <Text style={[displayFont(32, '800'), { color: '#fff', marginTop: 8 }]}>
              {caJour.toLocaleString('fr-FR')} F
            </Text>
            <Text style={[bodyFont(14, '700'), { color: 'rgba(255,255,255,0.7)' }]}>
              Chiffre d'affaires du jour
            </Text>
            <Text style={[bodyFont(12, '600'), { color: 'rgba(255,255,255,0.55)', marginTop: 4 }]}>
              {duJour.length} commande{duJour.length !== 1 ? 's' : ''} reçue{duJour.length !== 1 ? 's' : ''}
            </Text>
          </LinearGradient>

          {/* Grille de stats */}
          <View style={s.statsGrid}>
            <StatCard label="En cuisine"  value={enCours.length}  color="#f59e0b" Icon={ChefHat}      sub="à préparer" />
            <StatCard label="Livrées"     value={livrees.length}  color="#22c55e" Icon={CheckCircle2} sub="aujourd'hui" />
            <StatCard label="Commandes"   value={duJour.length}   color={Brand.accentLight} Icon={ShoppingBag} />
            <StatCard label="Annulées"    value={refusees.length} color="#ef4444" Icon={XCircle} />
          </View>

          {/* Dernières commandes */}
          <Text style={[displayFont(18, '700'), { color: colors.text }]}>Dernières commandes</Text>
          {commandes.slice(0, 10).map(c => {
            const statutColor = c.statut === 'livree' || c.statut === 'recuperee'
              ? '#22c55e'
              : c.statut === 'annulee' || c.statut === 'refusee'
              ? '#ef4444'
              : '#f59e0b';
            return (
              <View key={c.id} style={[s.commandeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[s.commandeId, { backgroundColor: statutColor + '18' }]}>
                  <Text style={[displayFont(14, '800'), { color: statutColor }]}>#{c.id}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[bodyFont(13, '700'), { color: colors.text }]} numberOfLines={1}>
                    {c.lignes.map(l => `${l.quantite}× ${l.plat_details?.nom ?? 'Plat'}`).join(', ')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Clock size={11} color={colors.faint} strokeWidth={2.2} />
                    <Text style={[bodyFont(11, '600'), { color: colors.faint }]}>
                      {new Date(c.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <Text style={[displayFont(14, '800'), { color: Brand.accentLight }]}>
                  {parseFloat(c.montant_total).toLocaleString('fr-FR')} F
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerIcon: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { paddingHorizontal: 20, paddingVertical: 20, gap: 16 },
  caCard: {
    borderRadius: Radius.xl, padding: 24,
    alignItems: 'flex-start',
  },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  statCard: {
    width: '47%', flexGrow: 1, padding: 16,
    borderRadius: Radius.xl, borderWidth: 1,
  },
  statIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  commandeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: Radius.lg, borderWidth: 1,
  },
  commandeId: {
    width: 52, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});
