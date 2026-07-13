// ═══════════════════════════════════════════════════════════
//  Galerie d'un restaurant — photos & vidéos, grille animée
//  + visionneuse plein écran (lecture vidéo via expo-video).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Animated, Modal,
  useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, Play, X, Images } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { fetchGallery, type GalleryItem } from '../../services/gallery';
import { PressableScale, Loader, CenterMessage, displayFont, bodyFont } from '../../components/ui';

// ── Vignette animée (entrée en cascade) ──────────────────────
function Tile({ item, index, onOpen, size }: { item: GalleryItem; index: number; onOpen: () => void; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 380, delay: Math.min(index, 12) * 45, useNativeDriver: true,
    }).start();
  }, [anim, index]);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      ],
    }}>
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
    </Animated.View>
  );
}

// ── Visionneuse plein écran (montée à l'ouverture) ───────────
function Viewer({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const player = useVideoPlayer(item.type === 'video' ? item.url : null, p => {
    if (item.type === 'video') { p.loop = true; p.play(); }
  });
  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={styles.viewer}>
        {item.type === 'video' ? (
          <VideoView player={player} style={{ width, height: height * 0.72 }} contentFit="contain" nativeControls allowsFullscreen />
        ) : (
          <Image source={{ uri: item.url }} style={{ width, height: height * 0.82 }} resizeMode="contain" />
        )}
        {!!item.legende && (
          <Text style={[bodyFont(13, '600'), { color: '#fff', marginTop: 12, textAlign: 'center' }]}>{item.legende}</Text>
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
  const [selected, setSelected] = useState<GalleryItem | null>(null);

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
              <Tile key={`${it.url}-${i}`} item={it} index={i} size={size} onOpen={() => setSelected(it)} />
            ))}
          </View>
        )}
      </ScrollView>

      {selected && <Viewer key={selected.url} item={selected} onClose={() => setSelected(null)} />}
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
  viewerClose: {
    position: 'absolute', top: 44, right: 18, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
});
