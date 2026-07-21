// ═══════════════════════════════════════════════════════════
//  Modal de filtres des plats
//  Tri (proximité, prix, notes, likes, commandes) + filtres
//  (prix max, note mini, populaires, livraison offerte, ouverts).
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X, SlidersHorizontal, Check, MapPin, Coins, Star, Heart, Flame, Sparkles, BadgePlus,
  type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { formatPrice } from '../data/menuData';
import { PressableScale, displayFont, bodyFont } from './ui';

export type SortKey =
  | 'pertinence' | 'proches' | 'prix_asc' | 'prix_desc'
  | 'notes' | 'likes' | 'commandes' | 'nouveautes';

export interface DishFilters {
  sort: SortKey;
  /** Catégories retenues (vide = toutes). */
  categories: string[];
  maxPrice: number | null;
  minNote: number;
  popularOnly: boolean;
  freeDelivery: boolean;
  openOnly: boolean;
}

export const DEFAULT_FILTERS: DishFilters = {
  sort: 'pertinence',
  categories: [],
  maxPrice: null,
  minNote: 0,
  popularOnly: false,
  freeDelivery: false,
  openOnly: false,
};

/** Nombre de critères actifs — sert à afficher la pastille sur le bouton. */
export function countActiveFilters(f: DishFilters): number {
  let n = 0;
  if (f.sort !== 'pertinence') n++;
  n += f.categories.length;
  if (f.maxPrice != null) n++;
  if (f.minNote > 0) n++;
  if (f.popularOnly) n++;
  if (f.freeDelivery) n++;
  if (f.openOnly) n++;
  return n;
}

const SORTS: { key: SortKey; label: string; Icon: LucideIcon }[] = [
  { key: 'pertinence', label: 'Pertinence',       Icon: Sparkles },
  { key: 'nouveautes', label: 'Nouveautés',       Icon: BadgePlus },
  { key: 'proches',    label: 'Plus proches',     Icon: MapPin },
  { key: 'commandes',  label: 'Plus commandés',   Icon: Flame },
  { key: 'likes',      label: 'Plus aimés',       Icon: Heart },
  { key: 'notes',      label: 'Mieux notés',      Icon: Star },
  { key: 'prix_asc',   label: 'Prix croissant',   Icon: Coins },
  { key: 'prix_desc',  label: 'Prix décroissant', Icon: Coins },
];

const PRICES: { label: string; value: number | null }[] = [
  { label: 'Tous', value: null },
  { label: '≤ 2 000', value: 2000 },
  { label: '≤ 3 500', value: 3500 },
  { label: '≤ 5 000', value: 5000 },
  { label: '≤ 10 000', value: 10000 },
];

const NOTES: { label: string; value: number }[] = [
  { label: 'Toutes', value: 0 },
  { label: '3★ +', value: 3 },
  { label: '4★ +', value: 4 },
  { label: '4,5★ +', value: 4.5 },
];

interface Props {
  visible: boolean;
  value: DishFilters;
  resultCount: number;
  /** Noms des catégories disponibles (multi-sélection). */
  categories: string[];
  onClose: () => void;
  onChange: (f: DishFilters) => void;
}

export function DishFilterModal({ visible, value, resultCount, categories, onClose, onChange }: Props) {
  const { colors } = useApp();
  const [draft, setDraft] = useState<DishFilters>(value);

  // Repart de l'état courant à chaque ouverture.
  useEffect(() => { if (visible) setDraft(value); }, [visible]);

  const set = <K extends keyof DishFilters>(k: K, v: DishFilters[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  /** Ajoute/retire une catégorie de la sélection. */
  const toggleCategory = (name: string) =>
    setDraft(d => ({
      ...d,
      categories: d.categories.includes(name)
        ? d.categories.filter(c => c !== name)
        : [...d.categories, name],
    }));

  const apply = () => { onChange(draft); onClose(); };
  const reset = () => setDraft(DEFAULT_FILTERS);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Conteneur plein écran : la feuille est ancrée en bas via le parent.
          Plus fiable que « position:absolute + maxHeight% », qui peut faire
          collapser un enfant flex:1 sur certains Android — et masquer le
          bouton d'action. */}
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.page, borderColor: colors.border }]}>
          <SafeAreaView edges={['bottom']} style={{ flexShrink: 1 }}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={[styles.headIcon, { backgroundColor: Brand.accent + '1f' }]}>
              <SlidersHorizontal size={18} color={Brand.accentLight} strokeWidth={2.4} />
            </View>
            <Text style={[displayFont(19, '800'), { color: colors.text, flex: 1 }]}>Filtrer les plats</Text>
            <PressableScale onPress={onClose}>
              <View style={[styles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <X size={18} color={colors.text} />
              </View>
            </PressableScale>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 14 }}
          >
            {/* ── Tri ─────────────────────────────── */}
            <Section title="Trier par" colors={colors} />
            <View style={styles.wrap}>
              {SORTS.map(s => {
                const on = draft.sort === s.key;
                return (
                  <PressableScale key={s.key} onPress={() => set('sort', s.key)}>
                    <View style={[
                      styles.chip,
                      on ? { backgroundColor: Brand.accent, borderColor: Brand.accent }
                         : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}>
                      <s.Icon size={14} color={on ? '#fff' : colors.muted} strokeWidth={2.4} />
                      <Text style={[bodyFont(13, '700'), { color: on ? '#fff' : colors.muted }]}>{s.label}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            {/* ── Catégories (multi-sélection) ────── */}
            {categories.length > 0 && (
              <>
                <Section
                  title={draft.categories.length
                    ? `Catégories · ${draft.categories.length} sélectionnée${draft.categories.length > 1 ? 's' : ''}`
                    : 'Catégories'}
                  colors={colors}
                />
                <View style={styles.wrap}>
                  <PressableScale onPress={() => set('categories', [])}>
                    <View style={[
                      styles.chip,
                      draft.categories.length === 0
                        ? { backgroundColor: Brand.accent, borderColor: Brand.accent }
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}>
                      <Text style={[bodyFont(13, '700'), { color: draft.categories.length === 0 ? '#fff' : colors.muted }]}>
                        Toutes
                      </Text>
                    </View>
                  </PressableScale>
                  {categories.map(c => {
                    const on = draft.categories.includes(c);
                    return (
                      <PressableScale key={c} onPress={() => toggleCategory(c)}>
                        <View style={[
                          styles.chip,
                          on ? { backgroundColor: Brand.accent, borderColor: Brand.accent }
                             : { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}>
                          {on && <Check size={13} color="#fff" strokeWidth={3} />}
                          <Text style={[bodyFont(13, '700'), { color: on ? '#fff' : colors.muted }]}>{c}</Text>
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── Prix ────────────────────────────── */}
            <Section title="Prix maximum" colors={colors} />
            <View style={styles.wrap}>
              {PRICES.map(p => {
                const on = draft.maxPrice === p.value;
                return (
                  <PressableScale key={p.label} onPress={() => set('maxPrice', p.value)}>
                    <View style={[
                      styles.chip,
                      on ? { backgroundColor: Brand.accent, borderColor: Brand.accent }
                         : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}>
                      <Text style={[bodyFont(13, '700'), { color: on ? '#fff' : colors.muted }]}>{p.label}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            {/* ── Note ────────────────────────────── */}
            <Section title="Note minimum" colors={colors} />
            <View style={styles.wrap}>
              {NOTES.map(n => {
                const on = draft.minNote === n.value;
                return (
                  <PressableScale key={n.label} onPress={() => set('minNote', n.value)}>
                    <View style={[
                      styles.chip,
                      on ? { backgroundColor: Brand.yellow, borderColor: Brand.yellow }
                         : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}>
                      <Text style={[bodyFont(13, '700'), { color: on ? '#1a1200' : colors.muted }]}>{n.label}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            {/* ── Options ─────────────────────────── */}
            <Section title="Options" colors={colors} />
            <View style={{ gap: 10, paddingHorizontal: 20 }}>
              <Toggle label="Plats populaires uniquement" Icon={Flame} colors={colors}
                on={draft.popularOnly} onPress={() => set('popularOnly', !draft.popularOnly)} />
              <Toggle label="Livraison offerte" Icon={Coins} colors={colors}
                on={draft.freeDelivery} onPress={() => set('freeDelivery', !draft.freeDelivery)} />
              <Toggle label="Restaurants ouverts" Icon={MapPin} colors={colors}
                on={draft.openOnly} onPress={() => set('openOnly', !draft.openOnly)} />
            </View>
          </ScrollView>

          {/* ── Actions ───────────────────────────── */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <PressableScale onPress={reset} style={{ flex: 1 }}>
              <View style={[styles.resetBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[bodyFont(14, '800'), { color: colors.muted }]}>Réinitialiser</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={apply} style={{ flex: 1.6 }}>
              <LinearGradient
                colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.applyBtn, glow(Brand.accent, 18)]}
              >
                <Check size={18} color="#fff" strokeWidth={2.7} />
                <Text style={[bodyFont(14.5, '800'), { color: '#fff' }]}>
                  Voir {resultCount} plat{resultCount > 1 ? 's' : ''}
                </Text>
              </LinearGradient>
            </PressableScale>
          </View>
        </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, colors }: { title: string; colors: any }) {
  return (
    <Text style={[bodyFont(11.5, '800'), styles.section, { color: colors.faint }]}>
      {title.toUpperCase()}
    </Text>
  );
}

function Toggle({ label, Icon, colors, on, onPress }: {
  label: string; Icon: LucideIcon; colors: any; on: boolean; onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98}>
      <View style={[
        styles.toggle,
        { backgroundColor: colors.surface, borderColor: on ? Brand.accent : colors.border },
      ]}>
        <Icon size={17} color={on ? Brand.accentLight : colors.muted} strokeWidth={2.3} />
        <Text style={[bodyFont(13.5, '700'), { color: on ? colors.text : colors.muted, flex: 1 }]}>{label}</Text>
        <View style={[
          styles.box,
          on ? { backgroundColor: Brand.accent, borderColor: Brand.accent }
             : { borderColor: colors.border },
        ]}>
          {on && <Check size={13} color="#fff" strokeWidth={3.2} />}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Plein écran, feuille ancrée en bas.
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    // maxHeight borne la feuille ; le ScrollView (flexShrink) absorbe le reste,
    // ce qui garde le bouton d'action toujours visible en bas.
    maxHeight: '88%',
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0,
  },
  grabber: {
    width: 42, height: 4.5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center', marginTop: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  headIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  section: { paddingHorizontal: 20, marginTop: 20, marginBottom: 10, letterSpacing: 0.6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1,
  },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1,
  },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  resetBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: Radius.pill, borderWidth: 1 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: Radius.pill },
});
