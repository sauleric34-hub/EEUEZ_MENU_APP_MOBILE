// ═══════════════════════════════════════════════════════════
//  Notifications — événements réels des commandes du client
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, BellOff, Clock, Check, ChefHat, Package, Bike, X, Tag,
  Flame, Heart, Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { formatPrice, mapPlat, type Dish } from '../data/menuData';
import { fetchTendances } from '../services/menu';
import { ScreenBg } from '../components/ScreenBg';
import { PressableScale, CenterMessage, displayFont, bodyFont } from '../components/ui';
import { DishCardWide } from '../components/cards';

export const NOTIFS_SEEN_KEY = '@menu_notifs_seen';

const STATUT_NOTIF: Record<string, { titre: string; Icon: LucideIcon; color: string }> = {
  en_attente:     { titre: 'Commande reçue',                    Icon: Clock,   color: Brand.yellow },
  acceptee:       { titre: 'Commande acceptée',                 Icon: Check,   color: '#8fd6a8' },
  en_preparation: { titre: 'Vos plats sont en cuisine',         Icon: ChefHat, color: Brand.yellow },
  prete:          { titre: 'Commande prête',                    Icon: Package, color: '#8fd6a8' },
  en_livraison:   { titre: 'Votre livreur est en route',        Icon: Bike,    color: Brand.accentLight },
  livree:         { titre: 'Commande livrée — bon appétit !',   Icon: Check,   color: '#8fd6a8' },
  refusee:        { titre: 'Commande refusée',                  Icon: X,       color: '#ff6b70' },
  annulee:        { titre: 'Commande annulée',                  Icon: X,       color: '#ff6b70' },
};

function timeAgo(iso: string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

interface Tendances {
  topCommandes: Dish[];
  topLikes: Dish[];
  reco: Dish[];
}

export default function NotificationsScreen() {
  const { colors, orders, reloadOrders, notifsEnabled, promoEnabled, userLoc } = useApp();
  const router = useRouter();
  const [tendances, setTendances] = useState<Tendances | null>(null);

  useEffect(() => {
    reloadOrders();
    // Marque tout comme vu (efface la pastille de la cloche)
    AsyncStorage.setItem(NOTIFS_SEEN_KEY, new Date().toISOString()).catch(() => {});
  }, [reloadOrders]);

  // Tendances de la semaine (plats les plus commandés / aimés / recommandés)
  useEffect(() => {
    let alive = true;
    fetchTendances(userLoc)
      .then(d => {
        if (!alive) return;
        setTendances({
          topCommandes: (d.top_commandes ?? []).map(mapPlat),
          topLikes: (d.top_likes ?? []).map(mapPlat),
          reco: (d.recommandations ?? []).map(mapPlat),
        });
      })
      .catch(() => { if (alive) setTendances(null); });
    return () => { alive = false; };
  }, [userLoc]);

  const items = notifsEnabled ? orders : [];

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <PressableScale onPress={() => router.back()}>
              <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ChevronLeft size={20} color={colors.text} />
              </View>
            </PressableScale>
            <Text style={[displayFont(24, '800'), { color: colors.text }]}>Notifications</Text>
          </View>

          {!notifsEnabled ? (
            <CenterMessage
              Icon={BellOff} colors={colors}
              title="Notifications désactivées"
              subtitle="Activez-les dans les paramètres pour suivre vos commandes."
            />
          ) : items.length === 0 ? (
            <CenterMessage
              Icon={BellOff} colors={colors}
              title="Rien pour l'instant"
              subtitle="Vos notifications de commande apparaîtront ici."
            />
          ) : (
            <View style={{ gap: 12, marginTop: 20 }}>
              {items.map(o => {
                const n = STATUT_NOTIF[o.statut] ?? STATUT_NOTIF.en_attente;
                const resto = o.restaurant_details?.nom ?? 'Restaurant';
                const active = !['livree', 'refusee', 'annulee'].includes(o.statut);
                return (
                  <PressableScale key={o.id} onPress={active ? () => router.push('/tracking') : undefined} scaleTo={0.98}>
                    <View style={[styles.notif, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={[styles.notifIcon, { backgroundColor: n.color + '1c' }]}>
                        <n.Icon size={19} color={n.color} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[bodyFont(14, '700'), { color: colors.text }]}>{n.titre}</Text>
                        <Text numberOfLines={1} style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 2 }]}>
                          #MENU-{o.id} · {resto} · {formatPrice(Number(o.montant_total))}
                        </Text>
                        <Text style={[bodyFont(11, '600'), { color: colors.faint, marginTop: 3 }]}>{timeAgo(o.created_at)}</Text>
                      </View>
                      {active && (
                        <View style={[styles.suivre, { backgroundColor: Brand.accent + '1c' }]}>
                          <Text style={[bodyFont(11.5, '800'), { color: Brand.accentLight }]}>Suivre</Text>
                        </View>
                      )}
                    </View>
                  </PressableScale>
                );
              })}

              {promoEnabled && (
                <View style={[styles.notif, { backgroundColor: Brand.yellow + '0f', borderColor: Brand.yellow + '33' }]}>
                  <View style={[styles.notifIcon, { backgroundColor: Brand.yellow + '1c' }]}>
                    <Tag size={19} color={Brand.yellow} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[bodyFont(14, '700'), { color: colors.text }]}>Livraison offerte ce week-end</Text>
                    <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 2 }]}>
                      Sur votre première commande chez un nouveau restaurant.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ─── Découverte : tendances de la semaine ─────────────── */}
          <TrendSection
            title="Les plus commandés cette semaine" Icon={Flame} color={Brand.yellow}
            dishes={tendances?.topCommandes} colors={colors}
          />
          <TrendSection
            title="Les plus aimés" Icon={Heart} color="#ff6b70"
            dishes={tendances?.topLikes} colors={colors}
          />
          <TrendSection
            title="Recommandés pour vous" Icon={Sparkles} color={Brand.accentLight}
            dishes={tendances?.reco} colors={colors}
          />
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

/** Carrousel horizontal de plats — masqué s'il n'y a rien à montrer. */
function TrendSection({ title, Icon, color, dishes, colors }: {
  title: string; Icon: LucideIcon; color: string; dishes?: Dish[]; colors: any;
}) {
  if (!dishes || dishes.length === 0) return null;
  return (
    <View style={{ marginTop: 26 }}>
      <View style={styles.trendHead}>
        <View style={[styles.trendIcon, { backgroundColor: color + '1c' }]}>
          <Icon size={16} color={color} strokeWidth={2.4} />
        </View>
        <Text style={[displayFont(16.5, '800'), { color: colors.text, flex: 1 }]}>{title}</Text>
      </View>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 13, paddingRight: 4 }}
      >
        {dishes.map(d => <DishCardWide key={d.id} dish={d} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notif: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 20, borderWidth: 1 },
  notifIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  suivre: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill },
  trendHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  trendIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
