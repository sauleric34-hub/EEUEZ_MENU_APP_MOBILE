// ═══════════════════════════════════════════════════════════
//  KDS — Kitchen Display System
//  Affiché sur tablette/écran en cuisine pour suivre les
//  commandes en temps réel. Auto-refresh toutes les 30 s.
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChefHat, CheckCircle2, CircleDot, Flame,
  RefreshCw, AlarmClock, UtensilsCrossed,
} from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { displayFont, bodyFont } from '../../components/ui';
import { ScreenBg } from '../../components/ScreenBg';
import { fetchCommandesResto } from '../../services/restoMenu';
import type { CommandeDTO } from '../../services/dto';

const REFRESH_INTERVAL = 30_000;

const STATUTS_CUISINE = ['en_attente', 'confirmee', 'en_preparation'];
const STATUT_LABELS: Record<string, string> = {
  en_attente:    'En attente',
  confirmee:     'Confirmée',
  en_preparation:'En préparation',
};
const STATUT_COLORS: Record<string, string> = {
  en_attente:    '#f59e0b',
  confirmee:     '#3b82f6',
  en_preparation:'#22c55e',
};

function dureeDepuis(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return '< 1 min';
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)} h ${diff % 60} min`;
}

function timerColor(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 10) return '#22c55e';
  if (diff < 20) return '#f59e0b';
  return '#ef4444';
}

function KdsCard({ commande, onPret }: { commande: CommandeDTO; onPret: (id: number) => void }) {
  const { colors } = useApp();
  const pulse = useRef(new Animated.Value(1)).current;
  const isUrgent = Math.floor((Date.now() - new Date(commande.created_at).getTime()) / 60000) >= 20;

  useEffect(() => {
    if (!isUrgent) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.025, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isUrgent]);

  const statut = commande.statut;
  const statusColor = STATUT_COLORS[statut] ?? Brand.accentLight;
  const tColor = timerColor(commande.created_at);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: isUrgent ? '#ef4444' : colors.border }]}>
        <View style={s.cardHeader}>
          <View style={s.orderNumWrap}>
            <Text style={[displayFont(13, '800'), { color: colors.muted }]}>#</Text>
            <Text style={[displayFont(22, '800'), { color: colors.text }]}>{commande.id}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
            <CircleDot size={10} color={statusColor} strokeWidth={3} />
            <Text style={[bodyFont(11, '800'), { color: statusColor }]}>
              {STATUT_LABELS[statut] ?? statut}
            </Text>
          </View>
        </View>

        <View style={s.timerRow}>
          <AlarmClock size={14} color={tColor} strokeWidth={2.4} />
          <Text style={[bodyFont(13, '700'), { color: tColor }]}>
            {dureeDepuis(commande.created_at)}
          </Text>
          {isUrgent && (
            <View style={s.urgentBadge}>
              <Flame size={11} color="#fff" strokeWidth={2.5} />
              <Text style={[bodyFont(10, '800'), { color: '#fff' }]}>URGENT</Text>
            </View>
          )}
        </View>

        {commande.emporter && (
          <View style={[s.emporterBadge, { borderColor: Brand.accent + '55', backgroundColor: Brand.accent + '10' }]}>
            <UtensilsCrossed size={12} color={Brand.accentLight} strokeWidth={2.4} />
            <Text style={[bodyFont(11, '700'), { color: Brand.accentLight }]}>À emporter</Text>
          </View>
        )}

        <View style={s.lignes}>
          {commande.lignes.map(l => (
            <View key={l.id} style={s.ligne}>
              <View style={s.qtyBubble}>
                <Text style={[displayFont(14, '800'), { color: '#fff' }]}>{l.quantite}</Text>
              </View>
              <Text style={[bodyFont(14, '700'), { color: colors.text, flex: 1 }]} numberOfLines={2}>
                {l.plat_details?.nom ?? `Plat #${l.plat}`}
              </Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => onPret(commande.id)} style={({ pressed }) => [s.pretBtn, pressed && { opacity: 0.75 }]}>
          <LinearGradient colors={[Brand.green, Brand.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pretBtnInner}>
            <CheckCircle2 size={18} color="#fff" strokeWidth={2.5} />
            <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>Prêt !</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function CuisineScreen() {
  const { colors } = useApp();
  const [commandes, setCommandes] = useState<CommandeDTO[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const charger = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const all = await fetchCommandesResto();
      const today = new Date().toISOString().slice(0, 10);
      const enCuisine = all
        .filter(c => STATUTS_CUISINE.includes(c.statut) && c.created_at.startsWith(today))
        .sort((a, b) => {
          const pA = STATUTS_CUISINE.indexOf(a.statut);
          const pB = STATUTS_CUISINE.indexOf(b.statut);
          if (pA !== pB) return pA - pB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      setCommandes(enCuisine);
      setLastUpdate(new Date());
    } catch { /* silencieux */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    const t = setInterval(() => charger(true), REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, [charger]);

  const onPret = (id: number) => setCommandes(prev => prev.filter(c => c.id !== id));

  const heure = lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} style={s.headerIcon}>
            <ChefHat size={22} color="#fff" strokeWidth={2} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[displayFont(20, '800'), { color: colors.text }]}>Cuisine</Text>
            <Text style={[bodyFont(12, '600'), { color: colors.muted }]}>
              {commandes.length} commande{commandes.length !== 1 ? 's' : ''} en cours
            </Text>
          </View>
          <View style={s.updateWrap}>
            <RefreshCw size={13} color={colors.faint} strokeWidth={2} />
            <Text style={[bodyFont(11, '600'), { color: colors.faint }]}>MAJ {heure}</Text>
          </View>
        </View>

        <View style={[s.legend, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {Object.entries(STATUT_LABELS).map(([key, label]) => (
            <View key={key} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: STATUT_COLORS[key] }]} />
              <Text style={[bodyFont(11, '600'), { color: colors.muted }]}>{label}</Text>
            </View>
          ))}
        </View>

        {commandes.length === 0 && !loading ? (
          <View style={s.empty}>
            <ChefHat size={64} color={colors.faint} strokeWidth={1.2} />
            <Text style={[displayFont(18, '700'), { color: colors.muted, marginTop: 16 }]}>
              Aucune commande en cuisine
            </Text>
            <Text style={[bodyFont(13, '500'), { color: colors.faint, marginTop: 6, textAlign: 'center' }]}>
              Les nouvelles commandes apparaîtront ici automatiquement.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); charger(); }}
                tintColor={Brand.accent}
              />
            }
          >
            {commandes.map(c => <KdsCard key={c.id} commande={c} onPret={onPret} />)}
          </ScrollView>
        )}
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
  updateWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legend: {
    flexDirection: 'row', gap: 16, paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  list:  { padding: 16, gap: 14 },
  card: {
    borderRadius: Radius.xl, borderWidth: 1.5,
    padding: 16, gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1,
  },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ef4444', borderRadius: Radius.pill,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  emporterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1,
  },
  lignes: { gap: 8, marginTop: 4 },
  ligne:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBubble: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center',
  },
  pretBtn:      { marginTop: 6 },
  pretBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: Radius.pill,
  },
});
