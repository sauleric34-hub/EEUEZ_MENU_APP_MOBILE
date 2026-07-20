// ═══════════════════════════════════════════════════════════
//  Accueil (Home)
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, RefreshControl, ActivityIndicator,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
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
import { PublicationCard } from '../../components/PublicationCard';
import { fetchFeed } from '../../services/publications';
import type { PublicationDTO } from '../../services/dto';

/** Publications montrées juste après « Près de vous » ; le reste défile sous les restaurants. */
const PUBS_EN_TETE = 5;

/** Une ligne du fil : soit une publication, soit le bloc « Restaurants ». */
type LigneFil =
  | { type: 'pub'; pub: PublicationDTO }
  | { type: 'restos' };

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

  // ─── Fil de publications (défilement infini) ─────────────────
  // Le curseur fige le classement : sans lui, la page 2 serait recalculée
  // et on verrait des doublons.
  const [pubs, setPubs] = useState<PublicationDTO[]>([]);
  const [curseur, setCurseur] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [aSuivant, setASuivant] = useState(false);
  const [chargePlus, setChargePlus] = useState(false);

  const chargerFeed = useCallback(async (reset = false) => {
    try {
      const res = await fetchFeed(reset ? 1 : page, reset ? undefined : curseur);
      setPubs(prev => (reset ? res.resultats : [...prev, ...res.resultats]));
      setCurseur(res.curseur);
      setPage(reset ? 2 : page + 1);
      setASuivant(res.aSuivant);
    } catch {
      if (reset) setPubs([]);
      setASuivant(false);
    }
  }, [page, curseur]);

  useEffect(() => { chargerFeed(true); }, []);   // au montage uniquement

  const chargerSuite = useCallback(async () => {
    if (chargePlus || !aSuivant) return;
    setChargePlus(true);
    try { await chargerFeed(false); } finally { setChargePlus(false); }
  }, [chargePlus, aSuivant, chargerFeed]);

  const refreshAll = async () => {
    await reloadCatalogue();
    await reloadRecommendations();
    await chargerFeed(true);
  };

  // Le fil est une seule liste : 5 publications, le bloc « Restaurants »,
  // puis la suite. Tout étant item, la détection de visibilité couvre chaque
  // publication (impossible dans un ListHeaderComponent).
  const lignes = useMemo<LigneFil[]>(() => {
    const debut: LigneFil[] = pubs.slice(0, PUBS_EN_TETE).map(p => ({ type: 'pub', pub: p }));
    const suite: LigneFil[] = pubs.slice(PUBS_EN_TETE).map(p => ({ type: 'pub', pub: p }));
    return [...debut, { type: 'restos' }, ...suite];
  }, [pubs]);

  // ─── Lecture vidéo : seule la publication qui occupe l'écran est lue ──
  const [pubActive, setPubActive] = useState<number | null>(null);

  // Le seuil de 60 % garantit qu'une seule carte est « la » visible : une
  // carte pleine largeur dépasse la moitié de l'écran en hauteur.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const premiere = viewableItems.find(v => (v.item as LigneFil)?.type === 'pub');
      setPubActive(premiere ? (premiere.item as { pub: PublicationDTO }).pub.id : null);
    },
  ).current;

  // Quitter l'accueil met tout en pause (sinon le son continue en arrière-plan).
  // On NE remet PAS la publication active à null : la FlatList ne réémet pas
  // la visibilité au retour, la vidéo resterait donc en pause jusqu'au
  // prochain défilement. On coupe via un indicateur de focus distinct.
  const [ecranActif, setEcranActif] = useState(true);
  useFocusEffect(useCallback(() => {
    setEcranActif(true);
    return () => setEcranActif(false);
  }, []));

  // En-tête de la liste : tout le contenu au-dessus du fil.
  // Référence stable indispensable — sinon l'en-tête se remonte à chaque
  // rendu et perd son état (focus, position des carrousels).
  // NB : ce hook doit rester AVANT tout retour anticipé (règles des hooks).
  const EnTete = useCallback(() => (
        <>
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
                <Text style={[bodyFont(14, '500'), { color: colors.faint }]}>Rechercher un plat, un restaurant…</Text>
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

          {/* Le fil commence ici — les publications sont des items de la liste,
              pour que la détection de visibilité (lecture vidéo) les couvre. */}
          {pubs.length > 0 && <SectionTitle title="À la une" colors={colors} />}
        </>
  ), [colors, mode, firstName, categories, forYou, positionUsed, pubs.length]);

  /** Bloc « Restaurants » : intercalé dans le fil, après les 5 premières. */
  const SectionRestaurants = useCallback(() => (
    <>
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
      <SectionTitle title="Dans votre communauté" colors={colors} />
    </>
  ), [colors, restoList, router]);

  // Écrans de repli — placés après tous les hooks.
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
        <FlatList
          data={lignes}
          keyExtractor={l => (l.type === 'pub' ? `pub-${l.pub.id}` : 'restos')}
          renderItem={({ item }) =>
            item.type === 'restos'
              ? <SectionRestaurants />
              : <PublicationCard publication={item.pub} actif={ecranActif && item.pub.id === pubActive} />
          }
          ListHeaderComponent={EnTete}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={dataLoading} onRefresh={refreshAll} tintColor={Brand.accent} />}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={chargerSuite}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            chargePlus
              ? <ActivityIndicator color={Brand.accent} style={{ marginVertical: 20 }} />
              : null
          }
        />
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
