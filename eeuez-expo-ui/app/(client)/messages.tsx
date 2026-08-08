// ═══════════════════════════════════════════════════════════
//  Messages — conversations client ↔ restaurant (par plat)
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MessagesSquare } from 'lucide-react-native';
import { Brand } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { fetchConversations } from '../../services/menu';
import type { ConversationDTO } from '../../services/dto';
import { iconForPlat, gradForId, absMedia } from '../../data/menuData';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, DishTile, CenterMessage, displayFont, bodyFont } from '../../components/ui';
import { SkeletonList } from '../../components/Skeleton';

/** Badge « non lus » : se rétracte (scale → 0) à la lecture au lieu de
 *  disparaître d'un coup ; réapparaît avec un léger pop sur un nouveau message. */
function UnreadBadge({ count }: { count: number }) {
  const scale = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;
  const [visible, setVisible] = useState(count > 0);
  const [displayCount, setDisplayCount] = useState(count);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > 0) setDisplayCount(count);
    if (count > 0 && prevCount.current === 0) {
      setVisible(true);
      scale.setValue(0);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 10 }).start();
    } else if (count === 0 && prevCount.current > 0) {
      Animated.timing(scale, {
        toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(() => setVisible(false));
    }
    prevCount.current = count;
  }, [count, scale]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles.unread, { transform: [{ scale }] }]}>
      <Text style={styles.unreadTxt}>{displayCount}</Text>
    </Animated.View>
  );
}

function timeAgo(iso: string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function MessagesScreen() {
  const { colors, user } = useApp();
  const router = useRouter();
  const [convs, setConvs] = useState<ConversationDTO[] | null>(null);
  // Distinct du chargement initial (convs === null) : reflète le
  // pull-to-refresh manuel, pour que l'indicateur natif s'affiche vraiment.
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setConvs([]); return; }
    try {
      setConvs(await fetchConversations());
    } catch {
      setConvs([]);
    }
  }, [user]);

  // Recharge à chaque retour sur l'onglet (nouveaux messages)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.accent} />}
        >
          <Text style={[displayFont(26, '800'), { color: colors.text }]}>Messages</Text>
          <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 4 }]}>
            Vos discussions avec les restaurants
          </Text>

          {convs === null ? (
            <SkeletonList colors={colors} />
          ) : convs.length === 0 ? (
            <CenterMessage
              Icon={MessagesSquare} colors={colors}
              title="Aucune discussion"
              subtitle="Touchez « Discuter » sur la page d'un plat pour poser une question au restaurant."
            />
          ) : (
            <View style={{ gap: 12, marginTop: 20 }}>
              {convs.map(c => {
                const p = c.plat_details;
                const Icon = iconForPlat(p.nom, p.categorie_nom);
                const image = p.images?.length ? absMedia(p.images[0]) : absMedia(p.image);
                const last = c.dernier_message;
                return (
                  <PressableScale key={c.id} onPress={() => router.push(`/chat/${c.id}`)}>
                    <View style={[styles.convRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <DishTile Icon={Icon} grad={gradForId(p.categorie ?? p.id)} image={image} size={60} iconSize={26} radius={16} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.row}>
                          <Text numberOfLines={1} style={[displayFont(15, '700'), { color: colors.text, flex: 1 }]}>{p.nom}</Text>
                          {last && <Text style={[bodyFont(10.5, '600'), { color: colors.faint }]}>{timeAgo(last.created_at)}</Text>}
                        </View>
                        <Text style={[bodyFont(11.5, '700'), { color: Brand.accentLight, marginTop: 2 }]}>{c.restaurant_nom}</Text>
                        {last && (
                          <Text numberOfLines={1} style={[bodyFont(12.5, c.non_lus > 0 ? '700' : '500'), { color: c.non_lus > 0 ? colors.text : colors.muted, marginTop: 3 }]}>
                            {last.sender === 'client' ? 'Vous : ' : ''}{last.texte}
                          </Text>
                        )}
                      </View>
                      <UnreadBadge count={c.non_lus} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: 20, borderWidth: 1 },
  unread: {
    minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11,
    backgroundColor: Brand.accent, alignItems: 'center', justifyContent: 'center',
  },
  unreadTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
