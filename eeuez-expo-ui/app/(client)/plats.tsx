// ═══════════════════════════════════════════════════════════
//  Recherche — plats & restaurants (grille + filtres)
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Search, UtensilsCrossed, Store, Star, ChevronRight, Bike } from 'lucide-react-native';
import { Brand, Radius, glow } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { formatKm, formatPrice } from '../../data/menuData';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, DishTile, Loader, CenterMessage, displayFont, bodyFont } from '../../components/ui';
import { DishCardGrid } from '../../components/cards';

type Mode = 'plats' | 'restos';

export default function PlatsScreen() {
  const { colors, plats, restaurants, categories, dataLoading } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('plats');
  const [active, setActive] = useState('Tout');
  const [query, setQuery] = useState('');

  const filters = useMemo(() => ['Tout', ...categories.map(c => c.name)], [categories]);

  const platList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plats.filter(d => {
      const okCat = active === 'Tout' || d.category === active;
      const okQuery = !q || d.name.toLowerCase().includes(q) || d.restoName.toLowerCase().includes(q);
      return okCat && okQuery;
    });
  }, [plats, active, query]);

  const restoList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter(r =>
      r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q),
    );
  }, [restaurants, query]);

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[displayFont(26, '800'), { color: colors.text }]}>Rechercher</Text>

          {/* Bascule Plats / Restaurants — contrôle segmenté */}
          <View style={[styles.segment, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            {([['plats', 'Plats', UtensilsCrossed], ['restos', 'Restaurants', Store]] as const).map(([key, label, Icon]) => {
              const on = mode === key;
              return (
                <PressableScale key={key} onPress={() => setMode(key)} style={{ flex: 1 }} scaleTo={0.97}>
                  {on ? (
                    <LinearGradient
                      colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={[styles.segItem, glow(Brand.accent, 12)]}
                    >
                      <Icon size={17} color="#fff" strokeWidth={2.5} />
                      <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>{label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.segItem}>
                      <Icon size={17} color={colors.muted} strokeWidth={2.3} />
                      <Text style={[bodyFont(14, '700'), { color: colors.muted }]}>{label}</Text>
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </View>

          <View style={[styles.searchPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={16} color={Brand.accentLight} strokeWidth={2.4} />
            <TextInput
              value={query} onChangeText={setQuery}
              placeholder={mode === 'plats' ? 'Rechercher un plat…' : 'Rechercher un restaurant…'}
              placeholderTextColor={colors.faint}
              style={[styles.input, { color: colors.text }]}
            />
          </View>

          {/* Catégories (uniquement pour les plats) */}
          {mode === 'plats' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 9 }}>
              {filters.map(f => {
                const on = f === active;
                return (
                  <PressableScale key={f} onPress={() => setActive(f)}>
                    <View style={[
                      styles.chip,
                      on ? { backgroundColor: Brand.accent }
                         : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                    ]}>
                      <Text style={[bodyFont(13, '700'), { color: on ? '#fff' : colors.muted }]}>{f}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          )}

          {/* Résultats */}
          {dataLoading && !plats.length ? (
            <Loader colors={colors} />
          ) : mode === 'plats' ? (
            platList.length === 0 ? (
              <CenterMessage Icon={UtensilsCrossed} colors={colors} title="Aucun plat" subtitle="Essayez une autre catégorie ou recherche." />
            ) : (
              <View style={styles.grid}>
                {platList.map(d => (
                  <View key={d.id} style={styles.cell}><DishCardGrid dish={d} /></View>
                ))}
              </View>
            )
          ) : restoList.length === 0 ? (
            <CenterMessage Icon={Store} colors={colors} title="Aucun restaurant" subtitle="Essayez un autre nom." />
          ) : (
            <View style={{ marginTop: 18, gap: 12 }}>
              {restoList.map(r => (
                <PressableScale key={r.id} onPress={() => router.push(`/resto/${r.id}`)}>
                  <View style={[styles.restoRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {r.image ? (
                      <Image source={{ uri: r.image }} style={styles.restoImg} />
                    ) : (
                      <DishTile Icon={r.icon} grad={r.grad} size={58} iconSize={26} radius={16} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[displayFont(15.5, '700'), { color: colors.text }]}>{r.name}</Text>
                      <Text numberOfLines={1} style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 2 }]}>{r.cuisine}</Text>
                      <View style={[styles.row, { gap: 10, marginTop: 5 }]}>
                        <View style={[styles.row, { gap: 3 }]}>
                          <Star size={11} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
                          <Text style={[bodyFont(11.5, '700'), { color: colors.muted }]}>{r.rating}</Text>
                        </View>
                        <View style={[styles.row, { gap: 3 }]}>
                          <Bike size={12} color={Brand.accentLight} strokeWidth={2.3} />
                          <Text style={[bodyFont(11.5, '600'), { color: colors.muted }]}>
                            {r.fraisLivraison > 0 ? formatPrice(r.fraisLivraison) : 'offerte'}
                          </Text>
                        </View>
                        {r.distanceKm != null && (
                          <Text style={[bodyFont(11.5, '600'), { color: colors.faint }]}>{formatKm(r.distanceKm)}</Text>
                        )}
                      </View>
                    </View>
                    <ChevronRight size={20} color={colors.faint} strokeWidth={2.3} />
                  </View>
                </PressableScale>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center' },
  segment: { flexDirection: 'row', gap: 6, padding: 5, borderRadius: Radius.pill, borderWidth: 1, marginTop: 18 },
  segItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.pill },
  searchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    paddingHorizontal: 16, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 11 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 14 },
  cell: { width: '47%', flexGrow: 1 },
  restoRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: 20, borderWidth: 1 },
  restoImg: { width: 58, height: 58, borderRadius: 16 },
});
