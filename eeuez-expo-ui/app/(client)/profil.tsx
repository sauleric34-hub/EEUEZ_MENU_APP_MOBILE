// ═══════════════════════════════════════════════════════════
//  Profil client
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Sun, Moon, Settings, ChefHat, Bike, Check, Clock, Package, X, LogOut, TriangleAlert,
  CalendarCheck, ChevronRight, Trash2, Award,
  type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { formatPrice, gradForId, iconForResto, absMedia, iconForPlat } from '../../data/menuData';
import { fetchMesPublications, supprimerPublication } from '../../services/publications';
import type { CommandeDTO, PublicationDTO, NiveauFidelite } from '../../services/dto';
import { ScreenBg } from '../../components/ScreenBg';
import {
  IconButton, DishTile, PressableScale, StatusPill, SectionTitle, displayFont, bodyFont,
} from '../../components/ui';
import { animateListChange } from '../../lib/layoutAnimation';

const STATUT: Record<string, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  en_attente:     { label: 'En attente',     color: Brand.yellow,      bg: Brand.yellow + '18', Icon: Clock },
  acceptee:       { label: 'Acceptée',       color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Check },
  en_preparation: { label: 'En préparation', color: Brand.yellow,      bg: Brand.yellow + '18', Icon: ChefHat },
  prete:          { label: 'Prête',          color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Package },
  en_livraison:   { label: 'En livraison',   color: Brand.accentLight, bg: Brand.accent + '1f', Icon: Bike },
  livree:         { label: 'Livrée',         color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Check },
  refusee:        { label: 'Refusée',        color: '#ff6b70',         bg: Brand.danger + '1f', Icon: X },
  annulee:        { label: 'Annulée',        color: '#ff6b70',         bg: Brand.danger + '1f', Icon: X },
};

function OrderRow({ order }: { order: CommandeDTO }) {
  const { colors, restoById } = useApp();
  const router = useRouter();
  const resto = order.restaurant ? restoById(order.restaurant) : undefined;
  const restoName = order.restaurant_details?.nom || resto?.name || 'Commande';
  const st = STATUT[order.statut] ?? STATUT.en_attente;
  const date = new Date(order.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const canTrack = !['livree', 'refusee', 'annulee'].includes(order.statut);

  // Détail des plats commandés : nom, photo et prix
  const lignes = order.lignes ?? [];
  const first = lignes[0]?.plat_details;
  const dishName = first
    ? (lignes.length > 1 ? `${first.nom} +${lignes.length - 1} autre${lignes.length > 2 ? 's' : ''}` : first.nom)
    : restoName;
  const photo = first?.image ? absMedia(first.image) : undefined;
  const Icon = first ? iconForPlat(first.nom, first.categorie_nom) : (resto?.icon ?? iconForResto(restoName, order.restaurant ?? 0));
  const grad = resto?.grad ?? gradForId(order.restaurant ?? 0);

  return (
    <View style={[styles.order, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <DishTile Icon={Icon} grad={grad} image={photo} size={56} iconSize={24} radius={15} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[displayFont(14, '700'), { color: colors.text }]}>{dishName}</Text>
        <Text numberOfLines={1} style={[bodyFont(11, '500'), { color: colors.muted, marginTop: 2 }]}>{restoName} · {date}</Text>
        <Text style={[displayFont(13.5, '800'), { color: Brand.accentLight, marginTop: 3 }]}>{formatPrice(Number(order.montant_total))}</Text>
        <StatusPill Icon={st.Icon} label={st.label} color={st.color} bg={st.bg} style={{ marginTop: 7 }} />
      </View>
      {canTrack && (
        <PressableScale onPress={() => router.push('/tracking')}>
          <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trackBtn}>
            <Text style={[bodyFont(12.5, '800'), { color: '#fff' }]}>Suivre</Text>
          </LinearGradient>
        </PressableScale>
      )}
    </View>
  );
}

/** Compteur qui grimpe jusqu'à sa valeur — rend les points gagnés tangibles. */
function PointsAnimes({ valeur, couleur }: { valeur: number; couleur: string }) {
  const [affiche, setAffiche] = useState(0);
  const progression = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (valeur <= 0) { setAffiche(0); return; }
    progression.setValue(0);
    const abonnement = progression.addListener(({ value }) => {
      setAffiche(Math.round(value * valeur));
    });
    Animated.timing(progression, {
      toValue: 1,
      duration: 900,
      // useNativeDriver impossible : on lit la valeur en JS pour l'afficher.
      useNativeDriver: false,
    }).start();
    return () => progression.removeListener(abonnement);
  }, [valeur, progression]);

  return <Text style={[displayFont(20, '800'), { color: couleur }]}>{affiche}</Text>;
}

/** Barre fine et discrète : signale un rafraîchissement silencieux en cours
 *  (retour sur l'onglet) sans le bruit d'un spinner ou d'un skeleton. */
function BarreRafraichissement({ actif }: { actif: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!actif) { opacity.stopAnimation(); opacity.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [actif, opacity]);
  if (!actif) return null;
  return <Animated.View style={[styles.barreRafraichissement, { opacity }]} />;
}

/** Habillage du badge de fidélité (les seuils, eux, sont côté serveur). */
const NIVEAUX: Record<NiveauFidelite, { libelle: string; fond: string; bord: string; texte: string }> = {
  bronze: { libelle: 'Bronze', fond: '#8a5a2b22', bord: '#8a5a2b66', texte: '#c98b46' },
  argent: { libelle: 'Argent', fond: '#9aa5b122', bord: '#9aa5b166', texte: '#c3ccd6' },
  or:     { libelle: 'Or',     fond: Brand.yellow + '22', bord: Brand.yellow + '66', texte: Brand.yellow },
};

export default function ProfilScreen() {
  const { colors, mode, toggleTheme, user, favList, orders, signOut, refreshUser } = useApp();
  const router = useRouter();
  const favCount = favList.length;

  // Mes contributions + solde de points, rechargés à chaque affichage :
  // les points évoluent côté serveur (likes et commentaires reçus).
  const [mesPubs, setMesPubs] = useState<PublicationDTO[]>([]);
  const [rafraichitPubs, setRafraichitPubs] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      refreshUser();
      setRafraichitPubs(true);
      fetchMesPublications()
        .then(res => { if (vivant) setMesPubs(res); })
        .catch(() => { if (vivant) setMesPubs([]); })
        .finally(() => { if (vivant) setRafraichitPubs(false); });
      return () => { vivant = false; };
    }, [refreshUser]),
  );

  const supprimerPub = (pub: PublicationDTO) => {
    Alert.alert(
      'Supprimer',
      'Cette publication ne sera plus visible nulle part. Action irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await supprimerPublication(pub.id);
              animateListChange();
              setMesPubs(prev => prev.filter(p => p.id !== pub.id));
            } catch {
              Alert.alert('Erreur', 'Suppression impossible.');
            }
          },
        },
      ],
    );
  };

  const displayName = user
    ? (`${user.first_name} ${user.last_name}`.trim() || user.username || user.email)
    : 'Invité';
  const email = user?.email ?? '';
  const points = user?.points_solde ?? 0;
  const niveauStyle = NIVEAUX[user?.niveau ?? 'bronze'];
  // Le serializer renvoie une URL relative : absMedia() la préfixe.
  const avatarUri = absMedia(user?.avatar ?? null);

  const logout = async () => { await signOut(); router.replace('/'); };

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Text style={[displayFont(24, '800'), { color: colors.text }]}>Profil</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <IconButton Icon={mode === 'dark' ? Sun : Moon} onPress={toggleTheme} colors={colors} />
              <IconButton Icon={Settings} onPress={() => router.push('/settings')} colors={colors} />
            </View>
          </View>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <LinearGradient colors={[Brand.yellow, Brand.accent, Brand.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={[styles.avatar, { borderColor: colors.page }]} />
              ) : (
                <LinearGradient colors={[Brand.green, Brand.greenDark]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.avatar, { borderColor: colors.page }]}>
                  <ChefHat size={40} color="#fff" strokeWidth={1.9} />
                </LinearGradient>
              )}
            </LinearGradient>
            <Text style={[displayFont(21, '800'), { color: colors.text, marginTop: 12 }]}>{displayName}</Text>
            {!!email && <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 3 }]}>{email}</Text>}

            {/* Badge de niveau — gagné via les publications */}
            <View style={[styles.niveauChip, { backgroundColor: niveauStyle.fond, borderColor: niveauStyle.bord }]}>
              <Award size={13} color={niveauStyle.texte} strokeWidth={2.5} />
              <Text style={[bodyFont(11.5, '800'), { color: niveauStyle.texte }]}>
                {niveauStyle.libelle}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { v: String(orders.length), l: 'Commandes', c: Brand.yellow, anime: false },
              { v: String(favCount), l: 'Favoris', c: '#ff6b70', anime: false },
              { v: String(points), l: 'Points', c: Brand.accentLight, anime: true },
            ].map(s => (
              <View key={s.l} style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {s.anime
                  ? <PointsAnimes valeur={points} couleur={s.c} />
                  : <Text style={[displayFont(20, '800'), { color: s.c }]}>{s.v}</Text>}
                <Text style={[bodyFont(11, '600'), { color: colors.muted, marginTop: 2 }]}>{s.l}</Text>
              </View>
            ))}
          </View>

          {/* Favoris */}
          <SectionTitle title="Mes favoris" colors={colors} action="Tout voir" onAction={() => router.push('/favoris')} />
          {favCount > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
              {favList.map(d => (
                <PressableScale key={d.id} onPress={() => router.push(`/dish/${d.id}`)}>
                  <View style={[styles.favMini, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <DishTile Icon={d.icon} grad={d.grad} image={d.image} iconSize={30} radius={0} style={{ height: 76 }} />
                    <Text numberOfLines={1} style={[displayFont(12.5, '700'), { color: colors.text, padding: 10 }]}>{d.name}</Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[bodyFont(13, '500'), { color: colors.muted, textAlign: 'center' }]}>Aucun favori pour l'instant.</Text>
            </View>
          )}

          {/* Mes publications */}
          {mesPubs.length > 0 && (
            <>
              <BarreRafraichissement actif={rafraichitPubs} />
              <SectionTitle title="Mes publications" colors={colors} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
                {mesPubs.map(p => {
                  const media = p.medias?.[0];
                  const enAttente = p.statut === 'en_attente';
                  const refusee = p.statut === 'refusee';
                  return (
                    <View key={p.id} style={[styles.favMini, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <PressableScale
                        onPress={() => (enAttente || refusee ? undefined : router.push(`/publication/${p.id}`))}
                      >
                        <View>
                          {media ? (
                            <Image source={{ uri: media.url }} style={{ height: 76, width: '100%' }} />
                          ) : (
                            <View style={{ height: 76, backgroundColor: colors.surface2 }} />
                          )}
                          {/* Statut de modération */}
                          <View style={[
                            styles.pubBadge,
                            { backgroundColor: enAttente ? Brand.yellow : refusee ? Brand.danger : '#2f8f4e' },
                          ]}>
                            <Text style={[bodyFont(9.5, '800'), { color: enAttente ? '#1a1200' : '#fff' }]}>
                              {enAttente ? 'En attente' : refusee ? 'Refusée' : 'Publiée'}
                            </Text>
                          </View>
                        </View>
                      </PressableScale>
                      <View style={{ padding: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text numberOfLines={1} style={[bodyFont(11.5, '600'), { color: colors.muted, flex: 1 }]}>
                          {p.restaurant_nom}
                        </Text>
                        <PressableScale onPress={() => supprimerPub(p)}>
                          <Trash2 size={14} color={Brand.danger} strokeWidth={2.3} />
                        </PressableScale>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Mes réservations */}
          <PressableScale onPress={() => router.push('/reservations')} style={{ marginTop: 20 }}>
            <View style={[styles.linkRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.linkIcon, { backgroundColor: Brand.green + '1f' }]}>
                <CalendarCheck size={18} color="#8fd6a8" strokeWidth={2.3} />
              </View>
              <Text style={[bodyFont(14.5, '700'), { color: colors.text, flex: 1 }]}>Mes réservations</Text>
              <ChevronRight size={20} color={colors.faint} strokeWidth={2.3} />
            </View>
          </PressableScale>

          {/* Commandes */}
          <Text style={[displayFont(18, '700'), { color: colors.text, marginTop: 24 }]}>Mes commandes</Text>
          {orders.length > 0 ? (
            <View style={{ gap: 12, marginTop: 12 }}>
              {orders.map(o => <OrderRow key={o.id} order={o} />)}
            </View>
          ) : (
            <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 12 }]}>
              <Text style={[bodyFont(13, '500'), { color: colors.muted, textAlign: 'center' }]}>Aucune commande pour l'instant.</Text>
            </View>
          )}

          {/* Allergies (renseignées à l'inscription) */}
          {!!user?.allergies && (
            <View style={[styles.allergy, { backgroundColor: Brand.yellow + '0f', borderColor: Brand.yellow + '33' }]}>
              <TriangleAlert size={22} color={Brand.yellow} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={[bodyFont(12, '800'), { color: Brand.yellow, letterSpacing: 0.6 }]}>ALLERGIES ENREGISTRÉES</Text>
                <Text style={[bodyFont(13.5, '500'), { color: colors.text, marginTop: 4 }]}>
                  {user.allergies.split(',').map(a => a.trim()).filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          )}

          {/* Déconnexion */}
          <PressableScale onPress={logout} style={{ marginTop: 20 }}>
            <View style={[styles.logout, { backgroundColor: Brand.danger + '14', borderColor: Brand.danger + '33' }]}>
              <LogOut size={18} color="#ff6b70" strokeWidth={2.3} />
              <Text style={[bodyFont(14.5, '800'), { color: '#ff6b70' }]}>Se déconnecter</Text>
            </View>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarWrap: { alignItems: 'center', marginTop: 14 },
  avatarRing: { padding: 4, borderRadius: 999 },
  avatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  stat: { flex: 1, paddingVertical: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  favMini: { width: 120, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  pubBadge: {
    position: 'absolute', top: 6, left: 6,
    paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 8,
  },
  niveauChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1,
  },
  barreRafraichissement: { height: 2, borderRadius: 1, backgroundColor: Brand.accent, marginTop: 10 },
  note: { padding: 18, borderRadius: 18, borderWidth: 1, marginTop: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  linkIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  order: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: 20, borderWidth: 1 },
  trackBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill },
  allergy: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15, borderRadius: 20, borderWidth: 1, marginTop: 20 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: Radius.pill, borderWidth: 1 },
});
