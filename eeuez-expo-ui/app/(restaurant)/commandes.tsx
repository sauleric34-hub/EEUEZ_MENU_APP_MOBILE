// ═══════════════════════════════════════════════════════════
//  Commandes Restaurant — historique du jour et filtrable
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ClipboardList, Clock, CheckCircle2, XCircle,
  ChefHat, Bike, PackageCheck, UtensilsCrossed,
} from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { displayFont, bodyFont, PressableScale } from '../../components/ui';
import { ScreenBg } from '../../components/ScreenBg';
import { fetchCommandesResto } from '../../services/restoMenu';
import type { CommandeDTO } from '../../services/dto';

// ─── Filtres ─────────────────────────────────────────────────
const FILTRES = [
  { key: 'tous',          label: 'Toutes' },
  { key: 'en_attente',    label: 'En attente' },
  { key: 'en_preparation',label: 'En préparation' },
  { key: 'en_livraison',  label: 'En livraison' },
  { key: 'livree',        label: 'Livrées' },
  { key: 'annulee',       label: 'Annulées' },
] as const;

type Filtre = (typeof FILTRES)[number]['key'];

// ─── Couleur / icône selon statut ────────────────────────────
function statutMeta(statut: string): { color: string; Icon: any; label: string } {
  switch (statut) {
    case 'en_attente':     return { color: '#f59e0b', Icon: Clock,        label: 'En attente' };
    case 'confirmee':      return { color: '#3b82f6', Icon: CheckCircle2, label: 'Confirmée' };
    case 'en_preparation': return { color: '#a855f7', Icon: ChefHat,      label: 'En préparation' };
    case 'en_livraison':   return { color: '#06b6d4', Icon: Bike,         label: 'En livraison' };
    case 'livree':         return { color: '#22c55e', Icon: PackageCheck,  label: 'Livrée' };
    case 'recuperee':      return { color: '#22c55e', Icon: PackageCheck,  label: 'Récupérée' };
    case 'annulee':        return { color: '#ef4444', Icon: XCircle,       label: 'Annulée' };
    case 'refusee':        return { color: '#ef4444', Icon: XCircle,       label: 'Refusée' };
    default:               return { color: '#6b7280', Icon: ClipboardList, label: statut };
  }
}

// ─── Carte commande ───────────────────────────────────────────
function CommandeCard({ commande }: { commande: CommandeDTO }) {
  const { colors } = useApp();
  const { color, Icon, label } = statutMeta(commande.statut);
  const heure = new Date(commande.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* En-tête */}
      <View style={s.cardTop}>
        <View style={s.idRow}>
          <Text style={[bodyFont(12, '600'), { color: colors.faint }]}>#</Text>
          <Text style={[displayFont(18, '800'), { color: colors.text }]}>{commande.id}</Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: color + '18', borderColor: color + '44' }]}>
          <Icon size={12} color={color} strokeWidth={2.5} />
          <Text style={[bodyFont(11, '800'), { color }]}>{label}</Text>
        </View>
      </View>

      {/* Lignes */}
      <View style={s.lignes}>
        {commande.lignes.map(l => (
          <View key={l.id} style={s.ligne}>
            <View style={[s.qtyBubble, { backgroundColor: Brand.accent + '22' }]}>
              <Text style={[bodyFont(12, '800'), { color: Brand.accentLight }]}>{l.quantite}×</Text>
            </View>
            <Text style={[bodyFont(13, '600'), { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {l.plat_details?.nom ?? `Plat #${l.plat}`}
            </Text>
            <Text style={[bodyFont(12, '700'), { color: colors.muted }]}>
              {parseFloat(l.prix_unitaire).toLocaleString('fr-FR')} F
            </Text>
          </View>
        ))}
      </View>

      {/* Pied */}
      <View style={[s.cardFoot, { borderTopColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Clock size={12} color={colors.faint} strokeWidth={2} />
          <Text style={[bodyFont(11, '600'), { color: colors.faint }]}>{heure}</Text>
          {commande.emporter && (
            <>
              <Text style={[bodyFont(11, '600'), { color: colors.faint }]}>·</Text>
              <UtensilsCrossed size={12} color={Brand.accentLight} strokeWidth={2.2} />
              <Text style={[bodyFont(11, '700'), { color: Brand.accentLight }]}>À emporter</Text>
            </>
          )}
        </View>
        <Text style={[displayFont(15, '800'), { color: Brand.accentLight }]}>
          {parseFloat(commande.montant_total).toLocaleString('fr-FR')} F
        </Text>
      </View>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────
export default function CommandesScreen() {
  const { colors } = useApp();
  const [commandes, setCommandes] = useState<CommandeDTO[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>('tous');

  const charger = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      setCommandes(await fetchCommandesResto());
    } catch { /* silencieux */ } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Filtrage
  const today = new Date().toISOString().slice(0, 10);
  const visibles = commandes
    .filter(c => c.created_at.startsWith(today))
    .filter(c => filtre === 'tous' || c.statut === filtre)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} style={s.headerIcon}>
            <ClipboardList size={22} color="#fff" strokeWidth={2} />
          </LinearGradient>
          <View>
            <Text style={[displayFont(20, '800'), { color: colors.text }]}>Commandes</Text>
            <Text style={[bodyFont(12, '600'), { color: colors.muted }]}>
              {visibles.length} résultat{visibles.length !== 1 ? 's' : ''} aujourd'hui
            </Text>
          </View>
        </View>

        {/* Filtres */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[s.filtresBar, { borderBottomColor: colors.border }]}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 10 }}
        >
          {FILTRES.map(f => {
            const active = filtre === f.key;
            return (
              <PressableScale key={f.key} onPress={() => setFiltre(f.key)}>
                {active ? (
                  <LinearGradient
                    colors={[Brand.accentTop, Brand.accentBot]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.filtrePill}
                  >
                    <Text style={[bodyFont(12, '800'), { color: '#fff' }]}>{f.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[s.filtrePill, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                    <Text style={[bodyFont(12, '700'), { color: colors.muted }]}>{f.label}</Text>
                  </View>
                )}
              </PressableScale>
            );
          })}
        </ScrollView>

        {visibles.length === 0 ? (
          <View style={s.empty}>
            <ClipboardList size={56} color={colors.faint} strokeWidth={1.2} />
            <Text style={[displayFont(17, '700'), { color: colors.muted, marginTop: 14 }]}>
              Aucune commande
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => charger(true)} tintColor={Brand.accent} />
            }
          >
            {visibles.map(c => <CommandeCard key={c.id} commande={c} />)}
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
  filtresBar: { borderBottomWidth: 1 },
  filtrePill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:  { padding: 16, gap: 12 },
  card:  { borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  cardTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, paddingBottom: 8,
  },
  idRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1,
  },
  lignes: { paddingHorizontal: 14, gap: 8 },
  ligne:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBubble: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 10, borderTopWidth: 1,
  },
});
