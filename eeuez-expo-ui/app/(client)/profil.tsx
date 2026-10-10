// ═══════════════════════════════════════════════════════════
//  Profil client
//  En-tête immersif (couverture + avatar) qui se replie en barre
//  compacte au défilement, carte de fidélité, actions rapides,
//  commandes (en cours mises en avant + 3 dernières), favoris,
//  publications en grille, allergies et déconnexion confirmée.
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import Reanimated, {
  Extrapolation, interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
} from 'react-native-reanimated';
import {
  Sun, Moon, Settings, ChefHat, LogOut, TriangleAlert, CalendarCheck, Trash2, Pencil,
  Receipt, Heart, Images, UserPen, UtensilsCrossed, Plus, type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius, cardShadow } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { formatPrice, absMedia } from '../../data/menuData';
import { fetchMesPublications, supprimerPublication } from '../../services/publications';
import { fetchFideliteApercu, type FideliteApercuDTO } from '../../services/menu';
import type { PublicationDTO } from '../../services/dto';
import {
  DishTile, PressableScale, SectionTitle, FadeSlideIn, KenteStripe, displayFont, bodyFont,
} from '../../components/ui';
import { FideliteCard } from '../../components/FideliteCard';
import { LiveOrderCard, OrderHistoryCard, estEnCours } from '../../components/orders';
import { animateListChange } from '../../lib/layoutAnimation';
import { alertError } from '../../services/errors';
import { useDeconnexion } from '../../hooks/useDeconnexion';

const COVER_H = 150;
const AVATAR = 96;
const HISTORIQUE_MAX = 3;

export default function ProfilScreen() {
  const { colors, mode, toggleTheme, user, favList, orders, refreshUser, reloadOrders } = useApp();
  const deconnecter = useDeconnexion();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // ─── Données rechargées à chaque affichage (points, contributions) ──
  const [mesPubs, setMesPubs] = useState<PublicationDTO[]>([]);
  const [apercu, setApercu] = useState<FideliteApercuDTO | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const charger = useCallback(async () => {
    await Promise.allSettled([
      refreshUser(),
      fetchMesPublications().then(setMesPubs).catch(() => setMesPubs([])),
      fetchFideliteApercu(0).then(setApercu).catch(() => setApercu(null)),
    ]);
  }, [refreshUser]);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([charger(), reloadOrders()]);
    setRefreshing(false);
  };

  // ─── Dérivés (mémoïsés : la liste des commandes peut être longue) ──
  const enCours = useMemo(() => orders.filter(estEnCours), [orders]);
  const historique = useMemo(() => orders.filter(o => !estEnCours(o)).slice(0, HISTORIQUE_MAX), [orders]);
  const allergies = useMemo(
    () => (user?.allergies ?? '').split(',').map(a => a.trim()).filter(Boolean),
    [user?.allergies],
  );

  const displayName = user
    ? (`${user.first_name} ${user.last_name}`.trim() || user.username || user.email)
    : 'Invité';
  const avatarUri = absMedia(user?.avatar ?? null);
  const points = user?.points_solde ?? 0;
  const version = Constants.expoConfig?.version ?? '';

  // ─── En-tête qui se replie au défilement ──────────────────────
  const scrollRef = useAnimatedRef<Reanimated.ScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });
  const [pubsY, setPubsY] = useState(0);

  const coverStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform: [
        { translateY: y < 0 ? y : y * 0.5 },
        { scale: y < 0 ? 1 + -y / (COVER_H + insets.top) : 1 },
      ],
    };
  });
  const avatarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 130], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollY.value, [-60, 0, 130], [1.08, 1, 0.55], Extrapolation.CLAMP) }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [100, 150], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [100, 150], [-8, 0], Extrapolation.CLAMP) }],
  }));

  // ─── Actions ─────────────────────────────────────────────────
  const supprimerPub = (pub: PublicationDTO) => {
    Alert.alert('Supprimer', 'Cette publication ne sera plus visible nulle part. Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await supprimerPublication(pub.id);
            animateListChange();
            setMesPubs(prev => prev.filter(p => p.id !== pub.id));
          } catch (e) {
            alertError(e, 'La publication n\'a pas pu être supprimée.');
          }
        },
      },
    ]);
  };

  const logout = () => {
    Alert.alert('Se déconnecter ?', 'Vous devrez vous reconnecter pour commander.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: deconnecter },
    ]);
  };

  const allerAuxPublications = () => {
    if (!mesPubs.length) { toast.show('Partagez vos plats préférés depuis le fil de l\'accueil.'); return; }
    scrollRef.current?.scrollTo({ y: Math.max(0, pubsY - 80), animated: true });
  };

  const actions: { label: string; Icon: LucideIcon; color: string; count?: number; onPress: () => void }[] = [
    { label: 'Commandes', Icon: Receipt, color: Brand.yellow, count: orders.length, onPress: () => router.push('/commandes') },
    { label: 'Réservations', Icon: CalendarCheck, color: '#4fc78a', onPress: () => router.push('/reservations') },
    { label: 'Favoris', Icon: Heart, color: '#ff6b70', count: favList.length, onPress: () => router.push('/favoris') },
    { label: 'Publications', Icon: Images, color: '#7aa7ff', count: mesPubs.length, onPress: allerAuxPublications },
    { label: 'Mon profil', Icon: UserPen, color: Brand.accentLight, onPress: () => router.push('/edit-profile') },
    { label: 'Paramètres', Icon: Settings, color: '#a7b0a9', onPress: () => router.push('/settings') },
  ];
  const tuileW = (width - 40 - 20) / 3;
  const pubW = (width - 40 - 16) / 3;

  return (
    <View style={[styles.root, { backgroundColor: colors.page }]}>
      <Reanimated.ScrollView
        ref={scrollRef}
        onScroll={onScroll} scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" progressViewOffset={insets.top} />}
      >
        {/* ─── Couverture ─── */}
        <View style={{ height: COVER_H + insets.top }}>
          <Reanimated.View style={[StyleSheet.absoluteFill, coverStyle]}>
            <LinearGradient
              colors={[Brand.accentTop, Brand.accentBot, Brand.greenDark]} locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
            />
            <View style={[styles.cercle, { width: 220, height: 220, right: -70, top: -60 }]} />
            <View style={[styles.cercle, { width: 140, height: 140, left: -40, bottom: -50 }]} />
            <KenteStripe height={5} style={styles.kente} />
          </Reanimated.View>
        </View>

        <View style={styles.content}>
          {/* ─── Avatar + identité ─── */}
          <View style={styles.identite}>
            <Reanimated.View style={avatarStyle}>
              <PressableScale onPress={() => router.push('/edit-profile')} scaleTo={0.94}>
                <LinearGradient colors={[Brand.yellow, Brand.accent, Brand.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
                  {avatarUri ? (
                    <ExpoImage source={{ uri: avatarUri }} style={[styles.avatar, { borderColor: colors.page }]} cachePolicy="memory-disk" />
                  ) : (
                    <LinearGradient colors={[Brand.green, Brand.greenDark]} style={[styles.avatar, { borderColor: colors.page }]}>
                      <ChefHat size={40} color="#fff" strokeWidth={1.9} />
                    </LinearGradient>
                  )}
                </LinearGradient>
                <View style={[styles.pencil, { borderColor: colors.page }]}>
                  <Pencil size={13} color="#fff" strokeWidth={2.6} />
                </View>
              </PressableScale>
            </Reanimated.View>
            <Text style={[displayFont(22, '800'), { color: colors.text, marginTop: 12 }]}>{displayName}</Text>
            {!!user?.email && <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 3 }]}>{user.email}</Text>}
          </View>

          {/* ─── Carte de fidélité ─── */}
          <FadeSlideIn index={0}>
            <FideliteCard points={points} niveau={user?.niveau ?? 'bronze'} apercu={apercu} />
          </FadeSlideIn>

          {/* ─── Actions rapides ─── */}
          <FadeSlideIn index={1}>
            <View style={styles.actions}>
              {actions.map(a => (
                <PressableScale key={a.label} onPress={a.onPress} scaleTo={0.93} style={{ width: tuileW }}>
                  <View style={[styles.tuile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.tuileIcon, { backgroundColor: a.color + '22' }]}>
                      <a.Icon size={20} color={a.color} strokeWidth={2.3} />
                    </View>
                    <Text numberOfLines={1} style={[bodyFont(12, '700'), { color: colors.text, marginTop: 9 }]}>{a.label}</Text>
                    {!!a.count && (
                      <View style={[styles.count, { backgroundColor: a.color }]}>
                        <Text style={[bodyFont(10, '900'), { color: '#fff' }]}>{a.count > 99 ? '99+' : a.count}</Text>
                      </View>
                    )}
                  </View>
                </PressableScale>
              ))}
            </View>
          </FadeSlideIn>

          {/* ─── Commandes ─── */}
          <FadeSlideIn index={2}>
            <SectionTitle
              title="Mes commandes" colors={colors}
              action={orders.length > HISTORIQUE_MAX || enCours.length ? 'Tout voir' : undefined}
              onAction={() => router.push('/commandes')}
            />
            {orders.length === 0 ? (
              <View style={[styles.vide, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.videIcon, { backgroundColor: Brand.accent + '1c' }]}>
                  <UtensilsCrossed size={24} color={Brand.accentLight} strokeWidth={2.2} />
                </View>
                <Text style={[displayFont(15, '700'), { color: colors.text, marginTop: 10 }]}>Pas encore de commande</Text>
                <Text style={[bodyFont(12.5, '500'), { color: colors.muted, marginTop: 3, textAlign: 'center' }]}>
                  Vos commandes et leur suivi apparaîtront ici.
                </Text>
                <PressableScale onPress={() => router.push('/(client)/plats')} style={{ marginTop: 14 }}>
                  <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} style={styles.cta}>
                    <Text style={[bodyFont(13, '800'), { color: '#fff' }]}>Découvrir les plats</Text>
                  </LinearGradient>
                </PressableScale>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {enCours.map(o => <LiveOrderCard key={o.id} order={o} />)}
                {historique.length > 0 && enCours.length > 0 && (
                  <Text style={[bodyFont(12, '800'), { color: colors.faint, letterSpacing: 0.6, marginTop: 4 }]}>RÉCENTES</Text>
                )}
                {historique.map(o => <OrderHistoryCard key={o.id} order={o} />)}
              </View>
            )}
          </FadeSlideIn>

          {/* ─── Favoris ─── */}
          <FadeSlideIn index={3}>
            <SectionTitle
              title="Mes favoris" colors={colors}
              action={favList.length ? 'Tout voir' : undefined} onAction={() => router.push('/favoris')}
            />
            {favList.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 6 }}>
                {favList.map(d => (
                  <PressableScale key={d.id} onPress={() => router.push(`/dish/${d.id}`)} scaleTo={0.95}>
                    <View style={[styles.fav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <DishTile Icon={d.icon} grad={d.grad} image={d.image} iconSize={30} radius={0} style={{ height: 92 }}>
                        <View style={styles.favHeart}><Heart size={12} color="#fff" fill={Brand.accent} strokeWidth={0} /></View>
                      </DishTile>
                      <View style={{ padding: 10 }}>
                        <Text numberOfLines={1} style={[displayFont(13, '700'), { color: colors.text }]}>{d.name}</Text>
                        <Text style={[displayFont(12.5, '800'), { color: Brand.accentLight, marginTop: 2 }]}>{formatPrice(d.price)}</Text>
                      </View>
                    </View>
                  </PressableScale>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Heart size={16} color={colors.faint} strokeWidth={2.2} />
                <Text style={[bodyFont(13, '500'), { color: colors.muted, flex: 1 }]}>Touchez ♡ sur un plat pour le retrouver ici.</Text>
              </View>
            )}
          </FadeSlideIn>

          {/* ─── Publications (grille) ─── */}
          {mesPubs.length > 0 && (
            <View onLayout={e => setPubsY(e.nativeEvent.layout.y)}>
              <SectionTitle title="Mes publications" colors={colors} />
              <View style={styles.pubGrid}>
                {mesPubs.map(p => {
                  const media = p.medias?.[0];
                  const enAttente = p.statut === 'en_attente';
                  const refusee = p.statut === 'refusee';
                  return (
                    <PressableScale
                      key={p.id} scaleTo={0.95}
                      onPress={() => (enAttente || refusee ? undefined : router.push(`/publication/${p.id}`))}
                    >
                      <View style={[styles.pub, { width: pubW, height: pubW * 1.25, backgroundColor: colors.surface2 }]}>
                        {media && <ExpoImage source={{ uri: media.url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />}
                        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']} style={styles.pubScrim} />
                        <View style={[styles.pubBadge, { backgroundColor: enAttente ? Brand.yellow : refusee ? Brand.danger : Brand.green }]}>
                          <Text style={[bodyFont(9.5, '800'), { color: enAttente ? '#1a1200' : '#fff' }]}>
                            {enAttente ? 'En attente' : refusee ? 'Refusée' : 'Publiée'}
                          </Text>
                        </View>
                        <PressableScale onPress={() => supprimerPub(p)} style={styles.pubTrash}>
                          <View style={styles.pubTrashInner}><Trash2 size={12} color="#fff" strokeWidth={2.4} /></View>
                        </PressableScale>
                        <Text numberOfLines={1} style={[bodyFont(10.5, '700'), styles.pubResto]}>{p.restaurant_nom}</Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          )}

          {/* ─── Allergies ─── */}
          <PressableScale onPress={() => router.push('/edit-profile')} scaleTo={0.98} style={{ marginTop: 24 }}>
            <View style={[styles.allergy, { backgroundColor: Brand.yellow + '10', borderColor: Brand.yellow + '38' }]}>
              <View style={[styles.row, { gap: 8 }]}>
                <TriangleAlert size={17} color={Brand.yellow} strokeWidth={2.3} />
                <Text style={[bodyFont(12, '800'), { color: Brand.yellow, letterSpacing: 0.6, flex: 1 }]}>MES ALLERGIES</Text>
                <Text style={[bodyFont(12, '800'), { color: Brand.accentLight }]}>{allergies.length ? 'Modifier' : 'Ajouter'}</Text>
              </View>
              {allergies.length ? (
                <View style={styles.chips}>
                  {allergies.map(a => (
                    <View key={a} style={[styles.chip, { backgroundColor: Brand.yellow + '22' }]}>
                      <Text style={[bodyFont(12, '700'), { color: colors.text }]}>{a}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.row, { gap: 6, marginTop: 8 }]}>
                  <Plus size={13} color={colors.muted} strokeWidth={2.5} />
                  <Text style={[bodyFont(12.5, '500'), { color: colors.muted, flex: 1 }]}>Signalez-les pour que les restaurants en tiennent compte.</Text>
                </View>
              )}
            </View>
          </PressableScale>

          {/* ─── Déconnexion ─── */}
          <PressableScale onPress={logout} style={{ marginTop: 16 }}>
            <View style={[styles.logout, { backgroundColor: Brand.danger + '12', borderColor: Brand.danger + '33' }]}>
              <LogOut size={18} color="#ff6b70" strokeWidth={2.3} />
              <Text style={[bodyFont(14.5, '800'), { color: '#ff6b70' }]}>Se déconnecter</Text>
            </View>
          </PressableScale>

          {!!version && (
            <Text style={[bodyFont(11, '600'), { color: colors.faint, textAlign: 'center', marginTop: 18 }]}>MENU · version {version}</Text>
          )}
        </View>
      </Reanimated.ScrollView>

      {/* ─── Barre compacte (apparaît une fois l'avatar dépassé) ─── */}
      <Reanimated.View
        pointerEvents="none"
        style={[styles.bar, { paddingTop: insets.top, height: insets.top + 56, backgroundColor: colors.page, borderBottomColor: colors.border }, barStyle]}
      >
        {avatarUri
          ? <ExpoImage source={{ uri: avatarUri }} style={styles.barAvatar} />
          : <LinearGradient colors={[Brand.green, Brand.greenDark]} style={styles.barAvatar}><ChefHat size={16} color="#fff" /></LinearGradient>}
        <Text numberOfLines={1} style={[displayFont(16, '800'), { color: colors.text, flexShrink: 1 }]}>{displayName}</Text>
      </Reanimated.View>

      {/* ─── Boutons flottants ─── */}
      <View style={[styles.topBtns, { top: insets.top + 8 }]}>
        <RoundBtn Icon={mode === 'dark' ? Sun : Moon} onPress={toggleTheme} />
        <RoundBtn Icon={Settings} onPress={() => router.push('/settings')} />
      </View>
    </View>
  );
}

function RoundBtn({ Icon, onPress }: { Icon: LucideIcon; onPress: () => void }) {
  const { colors } = useApp();
  return (
    <PressableScale onPress={onPress} scaleTo={0.9}>
      <View style={[styles.roundBtn, cardShadow(colors.shadow)]}>
        <Icon size={19} color="#fff" strokeWidth={2.3} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: 20 },
  cercle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  kente: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  identite: { alignItems: 'center', marginTop: -(AVATAR / 2 + 6) },
  avatarRing: { padding: 4, borderRadius: 999 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  pencil: {
    position: 'absolute', right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15, borderWidth: 3,
    backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  tuile: { paddingVertical: 14, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  tuileIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute', top: 8, right: 8, minWidth: 20, height: 20, paddingHorizontal: 5,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  vide: { alignItems: 'center', padding: 20, borderRadius: 22, borderWidth: 1 },
  videIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cta: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: Radius.pill },
  fav: { width: 132, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  favHeart: {
    position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(11,16,13,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 18, borderWidth: 1 },
  pubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pub: { borderRadius: 16, overflow: 'hidden' },
  pubScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  pubBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 7 },
  pubTrash: { position: 'absolute', top: 5, right: 5 },
  pubTrashInner: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  pubResto: { position: 'absolute', left: 7, right: 7, bottom: 6, color: '#fff' },
  allergy: { padding: 15, borderRadius: 20, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  chip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radius.pill },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: Radius.pill, borderWidth: 1 },
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingRight: 110,
  },
  barAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  topBtns: { position: 'absolute', right: 16, flexDirection: 'row', gap: 10 },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(11,16,13,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
});
