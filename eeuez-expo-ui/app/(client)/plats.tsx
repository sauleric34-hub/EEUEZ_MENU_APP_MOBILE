// ═══════════════════════════════════════════════════════════
//  Recherche — plats & restaurants (grille + filtres)
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Search, UtensilsCrossed, Store, Star, ChevronRight, Bike, SlidersHorizontal, Check } from 'lucide-react-native';
import { Brand, Radius, glow } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { formatKm, formatPrice, distanceKm } from '../../data/menuData';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, DishTile, CascadeReveal, CenterMessage, displayFont, bodyFont } from '../../components/ui';
import { SkeletonDishGrid, SkeletonList } from '../../components/Skeleton';
import { DishCardGrid } from '../../components/cards';
import { animateListChange } from '../../lib/layoutAnimation';
import {
  DishFilterModal, DEFAULT_FILTERS, countActiveFilters, type DishFilters,
} from '../../components/DishFilterModal';

type Mode = 'plats' | 'restos';

const SEARCH_DEBOUNCE_MS = 350;

/** Badge de filtres actifs : « pop » (scale bref) à chaque incrément, pas
 *  sur une simple mise à jour ou une baisse du compteur. */
function FilterBadge({ count, borderColor }: { count: number; borderColor: string }) {
  const pop = useRef(new Animated.Value(1)).current;
  const precedent = useRef(count);
  useEffect(() => {
    if (count > precedent.current) {
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 16 }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
      ]).start();
    }
    precedent.current = count;
  }, [count, pop]);
  return (
    <Animated.View style={[styles.badge, { borderColor, transform: [{ scale: pop }] }]}>
      <Text style={[bodyFont(10, '900'), { color: '#fff' }]}>{count}</Text>
    </Animated.View>
  );
}

export default function PlatsScreen() {
  const { colors, plats, restaurants, categories, dataLoading, restoById, userLoc } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('plats');
  // Saisie immédiate (champ) vs valeur débouncée (utilisée pour filtrer) :
  // évite de recalculer la grille à chaque frappe.
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [dishFilters, setDishFilters] = useState<DishFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (rawQuery === query) return;
    setSearching(true);
    const t = setTimeout(() => {
      animateListChange();
      setQuery(rawQuery);
      setSearching(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [rawQuery, query]);

  const activeFilterCount = countActiveFilters(dishFilters);
  const categoryNames = useMemo(() => categories.map(c => c.name), [categories]);
  const selectedCats = dishFilters.categories;

  const changeMode = (next: Mode) => { animateListChange(); setMode(next); };

  /** Barre de catégories : multi-sélection, partagée avec la modal de filtres. */
  const toggleCategory = (name: string) => {
    animateListChange();
    setDishFilters(f => ({
      ...f,
      categories: f.categories.includes(name)
        ? f.categories.filter(c => c !== name)
        : [...f.categories, name],
    }));
  };

  const applyFilters = (next: DishFilters) => {
    animateListChange();
    setDishFilters(next);
  };

  /** Distance du plat = distance de son restaurant (position GPS connue). */
  const distFor = React.useCallback((restoId: number): number | null => {
    const r = restoById(restoId);
    if (!userLoc || !r || r.latitude == null || r.longitude == null) return r?.distanceKm ?? null;
    return distanceKm(userLoc.lat, userLoc.lon, r.latitude, r.longitude);
  }, [restoById, userLoc]);

  const platList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const f = dishFilters;

    const list = plats.filter(d => {
      const okCat = f.categories.length === 0 || (!!d.category && f.categories.includes(d.category));
      const okQuery = !q || d.name.toLowerCase().includes(q) || d.restoName.toLowerCase().includes(q);
      const okPrice = f.maxPrice == null || d.price <= f.maxPrice;
      const okNote = f.minNote === 0 || d.noteValue >= f.minNote;
      const okPopular = !f.popularOnly || d.isPopular;
      const okDelivery = !f.freeDelivery || d.fraisLivraison === 0;
      const okOpen = !f.openOnly || (restoById(d.restoId)?.isOpen ?? true);
      return okCat && okQuery && okPrice && okNote && okPopular && okDelivery && okOpen;
    });

    // Tri (copie : on ne mute jamais la liste du contexte)
    const sorted = [...list];
    switch (f.sort) {
      case 'proches':
        sorted.sort((a, b) => {
          const da = distFor(a.restoId), db = distFor(b.restoId);
          if (da == null && db == null) return 0;
          if (da == null) return 1;          // sans position → à la fin
          if (db == null) return -1;
          return da - db;
        });
        break;
      case 'prix_asc':   sorted.sort((a, b) => a.price - b.price); break;
      case 'prix_desc':  sorted.sort((a, b) => b.price - a.price); break;
      case 'notes':      sorted.sort((a, b) => b.noteValue - a.noteValue); break;
      case 'likes':      sorted.sort((a, b) => b.likesCount - a.likesCount); break;
      case 'commandes':  sorted.sort((a, b) => b.ordersCount - a.ordersCount); break;
      // Nouveautés : les plus récents d'abord (id décroissant en repli si pas de date).
      case 'nouveautes': sorted.sort((a, b) => (b.createdAt - a.createdAt) || (b.id - a.id)); break;
      default: break;  // pertinence → ordre d'origine
    }
    return sorted;
  }, [plats, query, dishFilters, restoById, distFor]);

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
                <PressableScale key={key} onPress={() => changeMode(key)} style={{ flex: 1 }} scaleTo={0.97}>
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

          {/* Recherche + bouton rond de filtres (plats uniquement) */}
          <View style={styles.searchRow}>
            <View style={[styles.searchPill, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={16} color={Brand.accentLight} strokeWidth={2.4} />
              <TextInput
                value={rawQuery} onChangeText={setRawQuery}
                placeholder={mode === 'plats' ? 'Rechercher un plat…' : 'Rechercher un restaurant…'}
                placeholderTextColor={colors.faint}
                style={[styles.input, { color: colors.text }]}
              />
              {searching && <ActivityIndicator size="small" color={Brand.accent} />}
            </View>

            {mode === 'plats' && (
              <PressableScale onPress={() => setShowFilters(true)}>
                {activeFilterCount > 0 ? (
                  <LinearGradient
                    colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[styles.filterBtn, glow(Brand.accent, 14)]}
                  >
                    <SlidersHorizontal size={19} color="#fff" strokeWidth={2.5} />
                    <FilterBadge count={activeFilterCount} borderColor={colors.page} />
                  </LinearGradient>
                ) : (
                  <View style={[styles.filterBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                    <SlidersHorizontal size={19} color={colors.muted} strokeWidth={2.4} />
                  </View>
                )}
              </PressableScale>
            )}
          </View>

          {/* Catégories — multi-sélection (partagée avec la modal de filtres) */}
          {mode === 'plats' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 9 }}>
              <PressableScale onPress={() => { animateListChange(); setDishFilters(f => ({ ...f, categories: [] })); }}>
                <View style={[
                  styles.chip,
                  selectedCats.length === 0
                    ? { backgroundColor: Brand.accent }
                    : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                ]}>
                  <Text style={[bodyFont(13, '700'), { color: selectedCats.length === 0 ? '#fff' : colors.muted }]}>
                    Tout
                  </Text>
                </View>
              </PressableScale>

              {categoryNames.map(name => {
                const on = selectedCats.includes(name);
                return (
                  <PressableScale key={name} onPress={() => toggleCategory(name)}>
                    <View style={[
                      styles.chipRow,
                      on ? { backgroundColor: Brand.accent }
                         : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                    ]}>
                      {on && <Check size={13} color="#fff" strokeWidth={3} />}
                      <Text style={[bodyFont(13, '700'), { color: on ? '#fff' : colors.muted }]}>{name}</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          )}

          {/* Résultats */}
          {(dataLoading && !plats.length) || searching ? (
            mode === 'plats' ? <SkeletonDishGrid colors={colors} /> : <SkeletonList colors={colors} />
          ) : mode === 'plats' ? (
            platList.length === 0 ? (
              <CenterMessage Icon={UtensilsCrossed} colors={colors} title="Aucun plat" subtitle="Essayez une autre catégorie ou recherche." />
            ) : (
              <View style={styles.grid}>
                {platList.map((d, i) => (
                  <CascadeReveal key={d.id} index={i} style={styles.cell}><DishCardGrid dish={d} /></CascadeReveal>
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

      <DishFilterModal
        visible={showFilters}
        value={dishFilters}
        resultCount={platList.length}
        categories={categoryNames}
        onClose={() => setShowFilters(false)}
        onChange={applyFilters}
      />
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center' },
  segment: { flexDirection: 'row', gap: 6, padding: 5, borderRadius: Radius.pill, borderWidth: 1, marginTop: 18 },
  segItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.pill },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    paddingHorizontal: 16, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 11 },
  filterBtn: {
    width: 48, height: 48, borderRadius: 24, marginTop: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 19, height: 19, borderRadius: 10,
    backgroundColor: Brand.green, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill },
  chipRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 14 },
  cell: { width: '47%', flexGrow: 1 },
  restoRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: 20, borderWidth: 1 },
  restoImg: { width: 58, height: 58, borderRadius: 16 },
});
