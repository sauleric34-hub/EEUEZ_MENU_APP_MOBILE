// ═══════════════════════════════════════════════════════════
//  Accueil (Home)
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, SlidersHorizontal, Bell, Sun, Moon, Star, TriangleAlert } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { formatKm } from '../../data/menuData';
import { ScreenBg } from '../../components/ScreenBg';
import { LogoMark } from '../../components/Logo';
import {
  PressableScale, IconButton, DishTile, SectionTitle, Loader, CenterMessage,
  AccentButton, displayFont, bodyFont,
} from '../../components/ui';
import { DishCardWide } from '../../components/cards';

export default function HomeScreen() {
  const {
    colors, mode, toggleTheme, user,
    categories, restaurants, popular, dataLoading, dataError, reloadCatalogue,
    recommended, recoRestos, positionUsed, reloadRecommendations,
  } = useApp();
  const router = useRouter();
  const goPlats = () => router.push('/(client)/plats');
  const firstName = user?.first_name || 'Gourmand';

  // Suggestions personnalisées (proximité + retours) ; repli : populaires
  const forYou = recommended.length ? recommended : popular;
  const restoList = recoRestos.length ? recoRestos : restaurants;
  const refreshAll = async () => { await reloadCatalogue(); await reloadRecommendations(); };

  if (dataLoading && !restaurants.length) {
    return <ScreenBg><SafeAreaView style={{ flex: 1 }}><Loader colors={colors} /></SafeAreaView></ScreenBg>;
  }
  if (dataError && !restaurants.length) {
    return (
      <ScreenBg><SafeAreaView style={{ flex: 1 }}>
        <CenterMessage
          Icon={TriangleAlert} colors={colors}
          title="Connexion impossible" subtitle={dataError}
          action={<AccentButton label="Réessayer" onPress={reloadCatalogue} style={{ marginTop: 20, minWidth: 180 }} />}
        />
      </SafeAreaView></ScreenBg>
    );
  }

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={dataLoading} onRefresh={refreshAll} tintColor={Brand.accent} />}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.greetRow}>
              <LogoMark size={48} radius={15} />
              <View>
                <Text style={[bodyFont(12.5, '600'), { color: colors.muted }]}>Bonjour</Text>
                <Text style={[displayFont(18, '700'), { color: colors.text }]}>{firstName}</Text>
              </View>
            </View>
            <View style={styles.headerBtns}>
              <IconButton Icon={mode === 'dark' ? Sun : Moon} onPress={toggleTheme} colors={colors} />
              <IconButton Icon={Bell} onPress={() => router.push('/notifications')} colors={colors} color={Brand.accentLight} dot />
            </View>
          </View>

          {/* Recherche */}
          <View style={styles.searchRow}>
            <PressableScale onPress={goPlats} style={{ flex: 1 }}>
              <View style={[styles.searchPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Search size={16} color={Brand.accentLight} strokeWidth={2.4} />
                <Text style={[bodyFont(14, '500'), { color: colors.faint }]}>Rechercher un plat…</Text>
              </View>
            </PressableScale>
            <PressableScale onPress={goPlats}>
              <DishTile Icon={SlidersHorizontal} grad={[Brand.accentTop, Brand.accentBot]} size={52} iconSize={20} radius={Radius.pill} />
            </PressableScale>
          </View>

          {/* Catégories */}
          {categories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 22 }} contentContainerStyle={{ gap: 10 }}>
              {categories.map(cat => (
                <PressableScale key={cat.id} onPress={goPlats}>
                  <View style={[styles.cat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <cat.icon size={24} color={Brand.accentLight} strokeWidth={2} />
                    <Text numberOfLines={1} style={[bodyFont(11, '700'), { color: colors.muted }]}>{cat.name}</Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          )}

          {/* Pour vous — suggestions personnalisées */}
          {forYou.length > 0 && (
            <>
              <SectionTitle
                title={positionUsed ? 'Près de vous' : 'Pour vous'}
                colors={colors} action="Tout voir" onAction={goPlats}
              />
              {positionUsed && (
                <Text style={[bodyFont(11.5, '600'), { color: colors.faint, marginTop: -8, marginBottom: 10 }]}>
                  Les meilleurs plats au plus près, pour réduire vos frais de livraison
                </Text>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 4, paddingHorizontal: 2 }}>
                {forYou.slice(0, 10).map(d => <DishCardWide key={d.id} dish={d} />)}
              </ScrollView>
            </>
          )}

          {/* Restaurants (triés par proximité si position connue) */}
          <SectionTitle title="Restaurants" colors={colors} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2, paddingHorizontal: 2 }}>
            {restoList.map(r => (
              <PressableScale key={r.id} onPress={() => router.push(`/resto/${r.id}`)}>
                <View style={[styles.restoMini, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <DishTile Icon={r.icon} grad={r.grad} image={r.image} iconSize={34} radius={16} style={{ height: 80 }} />
                  <Text numberOfLines={1} style={[displayFont(14.5, '700'), { color: colors.text, marginTop: 10 }]}>{r.name}</Text>
                  <View style={[styles.row, { gap: 4, marginTop: 3 }]}>
                    <Star size={11} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
                    <Text numberOfLines={1} style={[bodyFont(11.5, '600'), { color: colors.muted }]}>
                      {r.rating} · {r.distanceKm != null ? formatKm(r.distanceKm) : r.cuisine}
                    </Text>
                  </View>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtns: { flexDirection: 'row', gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  searchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 15, borderRadius: Radius.pill, borderWidth: 1,
  },
  cat: { width: 78, alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 20, borderWidth: 1 },
  restoMini: { width: 150, padding: 14, borderRadius: 22, borderWidth: 1 },
});
