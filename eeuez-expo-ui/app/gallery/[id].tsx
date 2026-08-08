// ═══════════════════════════════════════════════════════════
//  Galerie d'un restaurant — photos & vidéos, grille animée
//  + visionneuse plein écran (lecture vidéo via expo-video),
//  navigable au swipe (prev/next) plutôt qu'un seul média figé.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Modal,
  useWindowDimensions, ActivityIndicator,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, Play, X, Images } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { fetchGallery, type GalleryItem } from '../../services/gallery';
import { PressableScale, CascadeReveal, Loader, CenterMessage, displayFont, bodyFont } from '../../components/ui';

// ── Vignette animée (entrée en cascade) ──────────────────────
function Tile({ item, index, onOpen, size }: { item: GalleryItem; index: number; onOpen: () => void; size: number }) {
  return (
    <CascadeReveal index={index}>
      <PressableScale onPress={onOpen} scaleTo={0.96}>
        <View style={[styles.tile, { width: size, height: size }]}>
          <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {item.type === 'video' && (
            <View style={styles.playOverlay}>
              <View style={styles.playBadge}><Play size={20} color="#fff" fill="#fff" strokeWidth={0} /></View>
            </View>
          )}
        </View>
      </PressableScale>
    </CascadeReveal>
  );
}

// ── Une page de la visionneuse : ne joue sa vidéo que si active ──
function ViewerPage({ item, width, height, actif }: {
  item: GalleryItem; width: number; height: number; actif: boolean;
}) {
  const player = useVideoPlayer(item.type === 'video' ? item.url : null, p => {
    if (item.type === 'video') p.loop = true;
  });
  useEffect(() => {
    if (item.type !== 'video') return;
    if (actif) player.play(); else player.pause();
  }, [actif, item.type, player]);

  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
      {item.type === 'video' ? (
        <VideoView player={player} style={{ width, height: height * 0.72 }} contentFit="contain" nativeControls allowsFullscreen />
      ) : (
        <Image source={{ uri: item.url }} style={{ width, height: height * 0.82 }} resizeMode="contain" />
      )}
      {!!item.legende && (
        <Text style={[bodyFont(13, '600'), { color: '#fff', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 }]}>
          {item.legende}
        </Text>
      )}
    </View>
  );
}

// ── Visionneuse plein écran — swipe pour passer au média suivant/précédent ──
function Viewer({ items, index, onClose, onIndexChange }: {
  items: GalleryItem[]; index: number; onClose: () => void; onIndexChange: (i: number) => void;
}) {
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(index);

  // Ouverture directe sur l'élément choisi dans la grille, sans animation de défilement.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: index * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrent(i);
    onIndexChange(i);
  };

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={styles.viewer}>
        <ScrollView
          ref={scrollRef}
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
        >
          {items.map((it, i) => (
            <ViewerPage key={`${it.url}-${i}`} item={it} width={width} height={height} actif={i === current} />
          ))}
        </ScrollView>

        {items.length > 1 && (
          <View style={styles.viewerDots}>
            {items.map((_, i) => (
              <View key={i} style={[styles.viewerDot, i === current && styles.viewerDotActive]} />
            ))}
          </View>
        )}

        <PressableScale onPress={onClose} style={styles.viewerClose}>
          <X size={22} color="#fff" />
        </PressableScale>
      </View>
    </Modal>
  );
}

export default function GalleryScreen() {
  const { colors } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchGallery(Number(id)).then(setItems).catch(() => setItems([]));
  }, [id]);

  const size = useMemo(() => (width - 20 * 2 - 12 * 2) / 3, [width]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingTop: insets.top + 8 }}>
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()}>
            <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ChevronLeft size={20} color={colors.text} />
            </View>
          </PressableScale>
          <Text style={[displayFont(23, '800'), { color: colors.text }]}>Galerie</Text>
        </View>

        {items === null ? (
          <Loader colors={colors} />
        ) : items.length === 0 ? (
          <CenterMessage Icon={Images} colors={colors} title="Galerie vide" subtitle="Ce restaurant n'a pas encore ajouté de photos ou vidéos." />
        ) : (
          <View style={styles.grid}>
            {items.map((it, i) => (
              <Tile key={`${it.url}-${i}`} item={it} index={i} size={size} onOpen={() => setSelectedIndex(i)} />
            ))}
          </View>
        )}
      </ScrollView>

      {items && selectedIndex != null && (
        <Viewer
          items={items}
          index={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onIndexChange={setSelectedIndex}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, marginTop: 18 },
  tile: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.22)' },
  playBadge: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)',
  },
  viewer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  viewerDots: {
    position: 'absolute', bottom: 34, alignSelf: 'center',
    flexDirection: 'row', gap: 6, alignItems: 'center',
  },
  viewerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  viewerDotActive: { backgroundColor: Brand.accent, width: 18 },
  viewerClose: {
    position: 'absolute', top: 44, right: 18, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
});
