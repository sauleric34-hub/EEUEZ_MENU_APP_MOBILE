// ═══════════════════════════════════════════════════════════
//  Plats — grille de tous les plats + filtres par catégorie
// ═══════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, UtensilsCrossed } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, Loader, CenterMessage, displayFont, bodyFont } from '../../components/ui';
import { DishCardGrid } from '../../components/cards';

export default function PlatsScreen() {
  const { colors, plats, categories, dataLoading } = useApp();
  const [active, setActive] = useState('Tout');
  const [query, setQuery] = useState('');

  const filters = useMemo(() => ['Tout', ...categories.map(c => c.name)], [categories]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plats.filter(d => {
      const okCat = active === 'Tout' || d.category === active;
      const okQuery = !q || d.name.toLowerCase().includes(q);
      return okCat && okQuery;
    });
  }, [plats, active, query]);

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[displayFont(26, '800'), { color: colors.text }]}>Tous les plats</Text>

          <View style={[styles.searchPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={16} color={Brand.accentLight} strokeWidth={2.4} />
            <TextInput
              value={query} onChangeText={setQuery}
              placeholder="Rechercher un plat…" placeholderTextColor={colors.faint}
              style={[styles.input, { color: colors.text }]}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 9 }}>
            {filters.map(f => {
              const on = f === active;
              return (
                <PressableScale key={f} onPress={() => setActive(f)}>
                  <View style={[
                    styles.chip,
                    on
                      ? { backgroundColor: Brand.accent }
                      : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                  ]}>
                    <Text style={[bodyFont(13, '700'), { color: on ? '#fff' : colors.muted }]}>{f}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>

          {dataLoading && !plats.length ? (
            <Loader colors={colors} />
          ) : list.length === 0 ? (
            <CenterMessage Icon={UtensilsCrossed} colors={colors} title="Aucun plat" subtitle="Essayez une autre catégorie ou recherche." />
          ) : (
            <View style={styles.grid}>
              {list.map(d => (
                <View key={d.id} style={styles.cell}><DishCardGrid dish={d} /></View>
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
  searchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16,
    paddingHorizontal: 16, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 11 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 14 },
  cell: { width: '47%', flexGrow: 1 },
});
