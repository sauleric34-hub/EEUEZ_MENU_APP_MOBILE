// ═══════════════════════════════════════════════════════════
//  Profil d'un restaurant
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Image, Alert, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Star, Check, Plus, MessageCircle, BellRing, Bike, Clock, Images, CalendarCheck, Camera, Navigation } from 'lucide-react-native';
import { Brand, Radius, cardShadow, glow } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { mapResto, mapPlat, formatPrice, type Resto, type Dish } from '../../data/menuData';
import { LocalisationResto } from '../../components/LocalisationResto';
import { fetchRestaurant, openConversation } from '../../services/menu';
import { KenteStripe, PressableScale, Loader, displayFont, bodyFont } from '../../components/ui';
import { DishCardGrid } from '../../components/cards';
import { ReservationModal } from '../../components/ReservationModal';
import { PublicationComposer } from '../../components/PublicationComposer';

function Stat({ value, label, color, colors }: { value: string; label: string; color: string; colors: any }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[displayFont(16, '800'), { color }]}>{value}</Text>
      <Text style={[bodyFont(10.5, '600'), { color: colors.muted, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

export default function RestoProfile() {
  const { colors, follows, toggleFollow, restoById, dishesOfResto } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const nid = Number(id);
  const cachedResto = restoById(nid);
  const cachedDishes = dishesOfResto(nid);
  const [fetchedResto, setFetchedResto] = useState<Resto | null>(null);
  const [fetchedDishes, setFetchedDishes] = useState<Dish[] | null>(null);
  const [openingChat, setOpeningChat] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const followPop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!cachedResto || cachedDishes.length === 0) {
      fetchRestaurant(nid)
        .then(r => { setFetchedResto(mapResto(r)); setFetchedDishes((r.plats ?? []).map(mapPlat)); })
        .catch(() => {});
    }
  }, [cachedResto, cachedDishes.length, nid]);

  const resto = cachedResto ?? fetchedResto;
  const dishes = cachedDishes.length ? cachedDishes : (fetchedDishes ?? []);
  if (!resto) {
    return <View style={{ flex: 1, backgroundColor: colors.page }}><Loader colors={colors} /></View>;
  }
  const following = !!(follows[resto.id] ?? resto.isFollowing);

  // Petit « pop » du bouton à chaque bascule d'abonnement
  const onFollow = () => {
    Animated.sequence([
      Animated.spring(followPop, { toValue: 1.08, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.spring(followPop, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
    toggleFollow(resto.id);
  };

  // Ouvre la discussion sur le premier plat du resto (les conversations sont liées à un plat)
  const discuss = async () => {
    if (openingChat) return;
    const first = dishes[0];
    if (!first) {
      Alert.alert('Discussion indisponible', "Ce restaurant n'a pas encore de plat à discuter.");
      return;
    }
    setOpeningChat(true);
    try {
      const conv = await openConversation(first.id);
      router.push(`/chat/${conv.id}`);
    } catch (e) {
      Alert.alert('Discussion impossible', e instanceof Error ? e.message : 'Reconnectez-vous et réessayez.');
    } finally {
      setOpeningChat(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Bannière (image de couverture réelle si disponible) */}
        <LinearGradient colors={resto.grad} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.banner}>
          {resto.cover && (
            <Image source={{ uri: resto.cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          <KenteStripe height={8} style={styles.bannerStripe} />
          <PressableScale onPress={() => router.back()}>
            <View style={styles.backBtn}><ChevronLeft size={22} color="#fff" /></View>
          </PressableScale>
        </LinearGradient>

        <View style={{ paddingHorizontal: 20, marginTop: -46 }}>
          <LinearGradient colors={resto.grad} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.avatar, { borderColor: colors.page }, cardShadow(colors.shadow)]}>
            {resto.image ? (
              <Image source={{ uri: resto.image }} style={styles.avatarImg} resizeMode="cover" />
            ) : (
              <resto.icon size={40} color="#fff" strokeWidth={1.9} />
            )}
          </LinearGradient>
          <Text style={[displayFont(24, '800'), { color: colors.text, marginTop: 14 }]}>{resto.name}</Text>
          <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 4 }]}>{resto.bio}</Text>

          <View style={styles.statsRow}>
            <Stat value={resto.rating} label="note" color={Brand.yellow} colors={colors} />
            <Stat value={resto.followers} label="abonnés" color="#8fd6a8" colors={colors} />
            <Stat value={String(dishes.length)} label="plats" color={Brand.accentLight} colors={colors} />
          </View>

          {/* Livraison — frais fixés par le restaurant */}
          <View style={styles.deliveryRow}>
            <View style={[styles.deliveryPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Bike size={16} color={Brand.accentLight} strokeWidth={2.3} />
              <Text style={[bodyFont(13, '700'), { color: colors.text }]}>
                {resto.paliersLivraison.length
                  ? `Livraison dès ${formatPrice(resto.paliersLivraison[0].prix)} · selon distance`
                  : `Livraison ${resto.fraisLivraison > 0 ? formatPrice(resto.fraisLivraison) : 'offerte'}`}
              </Text>
            </View>
            <View style={[styles.deliveryPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Clock size={16} color="#8fd6a8" strokeWidth={2.3} />
              <Text style={[bodyFont(13, '700'), { color: colors.text }]}>~{resto.tempsLivraison} min</Text>
            </View>
          </View>

          {/* ─── Bouton Suivre + Réserver (actions primaires) ───── */}
          <View style={styles.primaryRow}>
            <Animated.View style={{ flex: 1, transform: [{ scale: followPop }] }}>
              <PressableScale onPress={onFollow}>
                {following ? (
                  <LinearGradient colors={[Brand.green, Brand.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.primaryBtn, glow(Brand.green, 14)]}>
                    <View style={styles.primaryIconRound}>
                      <BellRing size={14} color={Brand.green} strokeWidth={2.6} />
                    </View>
                    <Text style={[bodyFont(14.5, '800'), { color: '#fff' }]}>Abonné</Text>
                    <Check size={17} color="#fff" strokeWidth={3} />
                  </LinearGradient>
                ) : (
                  <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.primaryBtn, glow(Brand.accent, 18)]}>
                    <View style={styles.primaryIconRound}>
                      <Plus size={15} color={Brand.accent} strokeWidth={3} />
                    </View>
                    <Text style={[bodyFont(14.5, '800'), { color: '#fff' }]}>Suivre</Text>
                  </LinearGradient>
                )}
              </PressableScale>
            </Animated.View>

            {resto.reservationsActives && (
              <PressableScale onPress={() => setShowReserve(true)} style={{ flex: 1 }}>
                <LinearGradient colors={[Brand.green, Brand.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.primaryBtn, glow(Brand.green, 12)]}>
                  <CalendarCheck size={18} color="#fff" strokeWidth={2.4} />
                  <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>Réserver</Text>
                </LinearGradient>
              </PressableScale>
            )}
          </View>

          {/* ─── Actions secondaires : rangée d'icônes rondes défilable ─── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 14 }}
            contentContainerStyle={{ gap: 12, paddingHorizontal: 2, paddingVertical: 4 }}
          >
            {/* Chat */}
            <PressableScale onPress={discuss}>
              <View style={styles.iconPill}>
                <View style={[styles.iconCircle, { backgroundColor: Brand.accent + '18', borderColor: Brand.accent + '50' }]}>
                  <MessageCircle size={22} color={Brand.accentLight} strokeWidth={2.2} />
                </View>
                <Text style={[bodyFont(11, '700'), { color: colors.muted, textAlign: 'center' }]}>Chat</Text>
              </View>
            </PressableScale>

            {/* Galerie */}
            <PressableScale onPress={() => router.push(`/gallery/${resto.id}`)}>
              <View style={styles.iconPill}>
                <View style={[styles.iconCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Images size={22} color={Brand.accentLight} strokeWidth={2.2} />
                </View>
                <Text style={[bodyFont(11, '700'), { color: colors.muted, textAlign: 'center' }]}>Galerie</Text>
              </View>
            </PressableScale>

            {/* Itinéraire */}
            {resto.latitude != null && resto.longitude != null && (
              <PressableScale onPress={async () => {
                const lat = resto.latitude!;
                const lon = resto.longitude!;
                const label = encodeURIComponent(resto.name);
                const url = Platform.select({
                  ios: `maps://?daddr=${lat},${lon}&q=${label}`,
                  android: `geo:${lat},${lon}?q=${lat},${lon}(${label})`,
                  default: `https://www.openstreetmap.org/directions?to=${lat},${lon}`,
                })!;
                const fallback = `https://www.openstreetmap.org/directions?to=${lat},${lon}`;
                try {
                  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
                  else await Linking.openURL(fallback);
                } catch { Alert.alert('Itinéraire indisponible', "Aucune app de navigation n'a pu être ouverte."); }
              }}>
                <View style={styles.iconPill}>
                  <View style={[styles.iconCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Navigation size={22} color={Brand.accentLight} strokeWidth={2.2} />
                  </View>
                  <Text style={[bodyFont(11, '700'), { color: colors.muted, textAlign: 'center' }]}>Itinéraire</Text>
                </View>
              </PressableScale>
            )}

            {/* Partager photo/vidéo */}
            <PressableScale onPress={() => setShowComposer(true)}>
              <View style={styles.iconPill}>
                <View style={[styles.iconCircle, { backgroundColor: Brand.accent + '12', borderColor: Brand.accent + '40', borderStyle: 'dashed' }]}>
                  <Camera size={22} color={Brand.accentLight} strokeWidth={2.2} />
                </View>
                <Text style={[bodyFont(11, '700'), { color: colors.muted, textAlign: 'center' }]}>Partager</Text>
              </View>
            </PressableScale>
          </ScrollView>

          <LocalisationResto
            nom={resto.name}
            latitude={resto.latitude}
            longitude={resto.longitude}
            adresse={resto.adresse}
          />

          <Text style={[displayFont(18, '700'), { color: colors.text, marginTop: 24 }]}>Ses plats</Text>
          <View style={styles.grid}>
            {dishes.map(d => (
              <View key={d.id} style={styles.cell}><DishCardGrid dish={d} /></View>
            ))}
          </View>
        </View>
      </ScrollView>

      <ReservationModal
        visible={showReserve}
        restaurantId={resto.id}
        restaurantNom={resto.name}
        prix={resto.prixReservation}
        onClose={() => setShowReserve(false)}
        onDone={() => { setShowReserve(false); router.push('/reservations'); }}
      />

      <PublicationComposer
        visible={showComposer}
        restaurantId={resto.id}
        restaurantNom={resto.name}
        onClose={() => setShowComposer(false)}
        onDone={() => {
          setShowComposer(false);
          Alert.alert(
            'Publication envoyée',
            `${resto.name} doit la valider avant qu'elle apparaisse dans l'accueil. Vous la retrouverez dans votre profil.`,
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { height: 180, overflow: 'hidden' },
  bannerStripe: { position: 'absolute', top: 0, left: 0, right: 0 },
  backBtn: {
    position: 'absolute', top: 40, left: 18, width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(11,16,13,0.8)', alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 88, height: 88, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 4, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 16 },
  stat: { flex: 1, paddingVertical: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  deliveryRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  deliveryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1,
  },
  primaryRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  primaryIconRound: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: Radius.pill,
  },
  iconPill: { alignItems: 'center', gap: 6, width: 68 },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 14 },
  cell: { width: '47%', flexGrow: 1 },
});
