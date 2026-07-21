// ═══════════════════════════════════════════════════════════
//  Carte de publication (fil type Instagram)
//  Carrousel multi-médias, like, commentaires, suivre le restaurant,
//  et pastille « Commander » vers la fiche du plat associé.
//
//  Perf : une seule vidéo est lue à la fois (celle visible dans le
//  carrousel), sinon plusieurs lecteurs tournent en parallèle.
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Image, FlatList, useWindowDimensions, Share, Animated, Pressable,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import { Heart, MessageCircle, Play, UtensilsCrossed, Store, Check, Plus, Volume2, VolumeX, Send } from 'lucide-react-native';
import { Brand, Radius } from '../constants/theme';
import { WEB_BASE_URL } from '../constants/api';
import { useApp } from '../context/AppContext';
import { basculerSon, useSonCoupe } from '../lib/videoFeed';
import { formatPrice } from '../data/menuData';
import { PressableScale, displayFont, bodyFont } from './ui';
import { AuthorChip } from './AuthorChip';
import type { PublicationDTO, PublicationMediaDTO } from '../services/dto';

/** Ancienneté lisible : « il y a 3 h », « il y a 2 j ». */
function tempsEcoule(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/** Une cellule du carrousel. La vidéo n'est montée que si elle est visible. */
function MediaCell({ media, largeur, actif }: {
  media: PublicationMediaDTO; largeur: number; actif: boolean;
}) {
  if (media.type === 'video') {
    return <VideoCell url={media.url} largeur={largeur} actif={actif} />;
  }
  return (
    <ExpoImage
      source={{ uri: media.url }}
      // Le flou arrive avec le JSON : il s'affiche donc immédiatement,
      // sans requête, et l'image nette se fond par-dessus une fois chargée.
      placeholder={media.flou ? { uri: media.flou } : undefined}
      placeholderContentFit="cover"
      style={{ width: largeur, height: largeur }}
      contentFit="cover"
      transition={220}
      // Cache mémoire + disque : une image déjà vue ne se retélécharge pas
      // lorsqu'on remonte le fil.
      cachePolicy="memory-disk"
      recyclingKey={String(media.id)}
    />
  );
}

function VideoCell({ url, largeur, actif }: { url: string; largeur: number; actif: boolean }) {
  const sonCoupe = useSonCoupe();
  const player = useVideoPlayer(url, p => { p.loop = true; p.muted = true; });

  // Lecture uniquement quand la cellule est visible dans le carrousel ET que
  // la publication est celle qui occupe l'écran.
  React.useEffect(() => {
    try { actif ? player.play() : player.pause(); } catch { /* lecteur libéré */ }
  }, [actif, player]);

  // Le son suit le réglage global, y compris sur les lecteurs déjà montés.
  React.useEffect(() => {
    try { player.muted = sonCoupe; } catch { /* lecteur libéré */ }
  }, [sonCoupe, player]);

  return (
    <View style={{ width: largeur, height: largeur, backgroundColor: '#000' }}>
      <VideoView player={player} style={{ width: largeur, height: largeur }} contentFit="cover" nativeControls={false} />
      {!actif && (
        <View style={styles.playBadge}><Play size={16} color="#fff" fill="#fff" strokeWidth={0} /></View>
      )}
    </View>
  );
}

interface Props {
  publication: PublicationDTO;
  /** Ouvre le détail (commentaires). Par défaut : navigation vers /publication/[id]. */
  onOpenComments?: (id: number) => void;
  /**
   * La publication occupe-t-elle l'écran ? Seule la carte active lit sa vidéo,
   * les autres se mettent en pause (comportement Instagram).
   * Par défaut true : les écrans qui n'affichent qu'une publication (détail)
   * n'ont rien à gérer.
   */
  actif?: boolean;
}

export function PublicationCard({ publication: pub, onOpenComments, actif = true }: Props) {
  const { colors, pubLikes, togglePubLike, follows, toggleFollow, user } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const sonCoupe = useSonCoupe();

  // Précharge les images du carrousel au-delà de celle affichée, pour que le
  // balayage latéral ne montre jamais de carré vide. On se limite aux deux
  // suivantes : au-delà, on consommerait des données pour rien.
  React.useEffect(() => {
    const aVenir = (pub.medias ?? [])
      .filter(m => m.type === 'image')
      .slice(index + 1, index + 3)
      .map(m => m.url);
    if (aVenir.length) ExpoImage.prefetch(aVenir, { cachePolicy: 'memory-disk' });
  }, [pub.medias, index]);

  // Apparition en douceur à l'arrivée de la carte dans la liste.
  const apparition = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(apparition, {
      toValue: 1, duration: 340, useNativeDriver: true,
    }).start();
  }, [apparition]);

  // Largeur = écran moins les marges horizontales de la page (20 de chaque côté).
  const largeur = Math.max(0, width - 40);

  // L'état serveur sert de valeur initiale ; le contexte prend le relais dès
  // que l'utilisateur interagit (optimiste).
  const liked = pubLikes[pub.id] ?? pub.est_like;
  const suit = follows[pub.restaurant] ?? pub.est_abonne;
  const estMoi = !!user && pub.auteur_details?.id === user.id;

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (largeur <= 0) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / largeur));
  }, [largeur]);

  const medias = useMemo(() => pub.medias ?? [], [pub.medias]);
  const aUneVideo = useMemo(() => medias.some(m => m.type === 'video'), [medias]);

  // ─── Double-tap pour aimer (signature Instagram) ──────────
  const coeurEclat = useRef(new Animated.Value(0)).current;
  const coeurBouton = useRef(new Animated.Value(1)).current;
  const dernierTap = useRef(0);

  /** Petit rebond du cœur de la barre d'actions. */
  const animerBouton = useCallback(() => {
    coeurBouton.setValue(0.6);
    Animated.spring(coeurBouton, {
      toValue: 1, friction: 3, tension: 160, useNativeDriver: true,
    }).start();
  }, [coeurBouton]);

  /** Gros cœur qui éclot au centre du média puis s'efface. */
  const animerEclat = useCallback(() => {
    coeurEclat.setValue(0);
    Animated.sequence([
      Animated.spring(coeurEclat, {
        toValue: 1, friction: 4, tension: 140, useNativeDriver: true,
      }),
      Animated.timing(coeurEclat, {
        toValue: 0, duration: 380, delay: 260, useNativeDriver: true,
      }),
    ]).start();
  }, [coeurEclat]);

  const aimer = useCallback(() => {
    togglePubLike(pub.id);
    animerBouton();
  }, [togglePubLike, pub.id, animerBouton]);

  /** Deux touches rapprochées = j'aime. Un double-tap n'enlève jamais le like
   *  (comme Instagram) : sinon on retirerait son like par mégarde. */
  const surTapMedia = useCallback(() => {
    const maintenant = Date.now();
    if (maintenant - dernierTap.current < 300) {
      dernierTap.current = 0;
      animerEclat();
      if (!liked) { togglePubLike(pub.id); animerBouton(); }
    } else {
      dernierTap.current = maintenant;
    }
  }, [liked, togglePubLike, pub.id, animerEclat, animerBouton]);

  /** Partage un lien https qui rebondit vers la publication dans l'app. */
  const partager = useCallback(async () => {
    const lien = `${WEB_BASE_URL}/publication/${pub.id}/`;
    const intro = pub.texte
      ? `« ${pub.texte.slice(0, 90)}${pub.texte.length > 90 ? '…' : ''} »`
      : `Une publication de ${pub.restaurant_nom}`;
    try {
      await Share.share({
        message: `${intro}\n\nÀ découvrir sur Menu :\n${lien}`,
        url: lien,          // iOS distingue message et url
        title: pub.restaurant_nom,
      });
    } catch {
      // Partage annulé ou indisponible : rien à signaler.
    }
  }, [pub.id, pub.texte, pub.restaurant_nom]);
  const ouvrirCommentaires = () =>
    onOpenComments ? onOpenComments(pub.id) : router.push(`/publication/${pub.id}`);

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        {
          opacity: apparition,
          transform: [
            { translateY: apparition.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      {/* ── En-tête : restaurant + suivre ── */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.push(`/resto/${pub.restaurant}`)}>
          {pub.restaurant_logo ? (
            <Image source={{ uri: pub.restaurant_logo }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoVide, { backgroundColor: Brand.accent + '22' }]}>
              <Store size={18} color={Brand.accentLight} strokeWidth={2.3} />
            </View>
          )}
        </PressableScale>
        <PressableScale onPress={() => router.push(`/resto/${pub.restaurant}`)} style={{ flex: 1 }}>
          <View>
            <Text numberOfLines={1} style={[displayFont(14.5, '700'), { color: colors.text }]}>
              {pub.restaurant_nom}
            </Text>
            <Text style={[bodyFont(11.5, '600'), { color: colors.faint, marginTop: 1 }]}>
              {tempsEcoule(pub.created_at)}
            </Text>
          </View>
        </PressableScale>

        {!suit && (
          <PressableScale onPress={() => toggleFollow(pub.restaurant)}>
            <View style={[styles.suivreBtn, { borderColor: Brand.accent }]}>
              <Plus size={13} color={Brand.accentLight} strokeWidth={3} />
              <Text style={[bodyFont(12, '800'), { color: Brand.accentLight }]}>Suivre</Text>
            </View>
          </PressableScale>
        )}
        {suit && (
          <View style={[styles.suivreBtn, { borderColor: colors.border }]}>
            <Check size={13} color={colors.muted} strokeWidth={3} />
            <Text style={[bodyFont(12, '800'), { color: colors.muted }]}>Abonné</Text>
          </View>
        )}
      </View>

      {/* ── Carrousel de médias ── */}
      {medias.length > 0 && (
        <View>
          <FlatList
            data={medias}
            keyExtractor={m => String(m.id)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            renderItem={({ item, index: i }) => (
              // Pressable transparent : capte le double-tap sans gêner le
              // défilement horizontal du carrousel.
              <Pressable onPress={surTapMedia}>
                <MediaCell media={item} largeur={largeur} actif={actif && i === index} />
              </Pressable>
            )}
          />

          {/* Cœur qui éclot au double-tap */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.eclatWrap,
              {
                opacity: coeurEclat,
                transform: [
                  { scale: coeurEclat.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) },
                ],
              },
            ]}
          >
            <Heart size={96} color="#fff" fill="#fff" strokeWidth={0} />
          </Animated.View>

          {/* Son — bas à droite, comme Instagram. Le réglage vaut pour tout le fil. */}
          {aUneVideo && (
            <PressableScale onPress={basculerSon} style={styles.sonWrap}>
              <View style={styles.sonBtn}>
                {sonCoupe
                  ? <VolumeX size={16} color="#fff" strokeWidth={2.4} />
                  : <Volume2 size={16} color="#fff" strokeWidth={2.4} />}
              </View>
            </PressableScale>
          )}

          {/* Pastille auteur (contribution client) — à gauche, sur le média */}
          {pub.auteur_details && (
            <View style={styles.auteurWrap}>
              <AuthorChip auteur={pub.auteur_details} />
            </View>
          )}

          {/* Points indicateurs */}
          {medias.length > 1 && (
            <View style={styles.dots}>
              {medias.map((m, i) => (
                <View
                  key={m.id}
                  style={[styles.dot, { backgroundColor: i === index ? '#fff' : '#ffffff66' }]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Actions ── */}
      <View style={styles.actions}>
        <PressableScale onPress={aimer}>
          <View style={styles.action}>
            <Animated.View style={{ transform: [{ scale: coeurBouton }] }}>
              <Heart
                size={23}
                color={liked ? '#ff4d6d' : colors.text}
                fill={liked ? '#ff4d6d' : 'transparent'}
                strokeWidth={2.2}
              />
            </Animated.View>
            <Text style={[bodyFont(13, '700'), { color: colors.text }]}>
              {pub.nombre_likes + (liked && !pub.est_like ? 1 : 0) - (!liked && pub.est_like ? 1 : 0)}
            </Text>
          </View>
        </PressableScale>

        <PressableScale onPress={ouvrirCommentaires}>
          <View style={styles.action}>
            <MessageCircle size={22} color={colors.text} strokeWidth={2.2} />
            <Text style={[bodyFont(13, '700'), { color: colors.text }]}>{pub.nombre_commentaires}</Text>
          </View>
        </PressableScale>

        <PressableScale onPress={partager}>
          <View style={styles.action}>
            <Send size={21} color={colors.text} strokeWidth={2.2} />
          </View>
        </PressableScale>

        <View style={{ flex: 1 }} />

        {/* Plat associé : accès direct à la fiche */}
        {pub.plat_details && (
          <PressableScale onPress={() => router.push(`/dish/${pub.plat_details!.id}`)}>
            <LinearGradient
              colors={[Brand.accentTop, Brand.accentBot]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.commander}
            >
              <UtensilsCrossed size={14} color="#fff" strokeWidth={2.5} />
              <Text style={[bodyFont(12.5, '800'), { color: '#fff' }]}>
                {formatPrice(pub.plat_details.prix)}
              </Text>
            </LinearGradient>
          </PressableScale>
        )}
      </View>

      {/* ── Texte ── */}
      {!!pub.texte && (
        <Text style={[bodyFont(13.5, '500'), styles.texte, { color: colors.text }]}>
          {pub.auteur_details && (
            <Text style={[bodyFont(13.5, '800'), { color: Brand.accentLight }]}>
              {estMoi ? 'Vous' : pub.auteur_details.pseudo}{'  '}
            </Text>
          )}
          {pub.texte}
        </Text>
      )}

      {pub.nombre_commentaires > 0 && (
        <PressableScale onPress={ouvrirCommentaires}>
          <Text style={[bodyFont(12.5, '600'), styles.voirComs, { color: colors.faint }]}>
            Voir les {pub.nombre_commentaires} commentaire{pub.nombre_commentaires > 1 ? 's' : ''}
          </Text>
        </PressableScale>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, overflow: 'hidden', marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  logo: { width: 38, height: 38, borderRadius: 19 },
  logoVide: { alignItems: 'center', justifyContent: 'center' },
  suivreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1.5,
  },
  playBadge: {
    position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20,
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#00000088',
    alignItems: 'center', justifyContent: 'center',
  },
  auteurWrap: { position: 'absolute', left: 10, bottom: 10 },
  eclatWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  sonWrap: { position: 'absolute', right: 10, bottom: 10 },
  sonBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#000000a8',
    alignItems: 'center', justifyContent: 'center',
  },
  dots: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
    flexDirection: 'row', gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 13, paddingTop: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commander: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: Radius.pill,
  },
  texte: { paddingHorizontal: 14, paddingTop: 10, lineHeight: 19 },
  voirComs: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14 },
});
