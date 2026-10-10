// ═══════════════════════════════════════════════════════════
//  Commandes — éléments partagés par le Profil, la page « Mes
//  commandes » et le suivi : statuts, résumé, carte « en direct »
//  et carte d'historique (avec « Commander à nouveau »).
// ═══════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation,
} from 'react-native-reanimated';
import {
  Bike, Check, ChefHat, ChevronRight, Clock, Package, RotateCcw, ShoppingBag, X, type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius, cardShadow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
  absMedia, formatPrice, gradForId, iconForPlat, iconForResto, statutToStep, TRACK_STEPS,
  type Gradient,
} from '../data/menuData';
import type { CommandeDTO } from '../services/dto';
import { DishTile, PressableScale, StatusPill, bodyFont, displayFont } from './ui';

export const STATUT: Record<string, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  en_attente:     { label: 'En attente',     color: Brand.yellow,      bg: Brand.yellow + '18', Icon: Clock },
  acceptee:       { label: 'Acceptée',       color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Check },
  en_preparation: { label: 'En préparation', color: Brand.yellow,      bg: Brand.yellow + '18', Icon: ChefHat },
  prete:          { label: 'Prête',          color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Package },
  en_livraison:   { label: 'En livraison',   color: Brand.accentLight, bg: Brand.accent + '1f', Icon: Bike },
  recuperee:      { label: 'Récupérée',      color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Check },
  livree:         { label: 'Livrée',         color: '#8fd6a8',         bg: Brand.green + '1f',  Icon: Check },
  refusee:        { label: 'Refusée',        color: '#ff6b70',         bg: Brand.danger + '1f', Icon: X },
  annulee:        { label: 'Annulée',        color: '#ff6b70',         bg: Brand.danger + '1f', Icon: X },
};

const FINIS = ['livree', 'recuperee', 'refusee', 'annulee'];
export const estEnCours = (o: CommandeDTO) => !FINIS.includes(o.statut);
export const estAnnulee = (o: CommandeDTO) => o.statut === 'refusee' || o.statut === 'annulee';

/** Statut affiché : celui de la livraison quand elle a commencé (plus précis). */
export const statutAffiche = (o: CommandeDTO) =>
  STATUT[o.livraison_statut === 'en_livraison' ? 'en_livraison' : o.statut] ?? STATUT.en_attente;

// Étapes d'une commande à emporter (pas de livreur, pas de trajet)
export const EMPORTER_STEPS = [
  { title: 'Commande confirmée', desc: 'Le restaurant a reçu votre commande', statuts: ['en_attente', 'acceptee'] },
  { title: 'En préparation', desc: 'Vos plats sont en cuisine', statuts: ['en_preparation'] },
  { title: 'Prête', desc: 'Venez la récupérer avec votre code', statuts: ['prete'] },
  { title: 'Récupérée', desc: 'Bon appétit !', statuts: ['recuperee'] },
];

/** Étapes et étape courante d'une commande (livraison ou à emporter). */
export function etapesDe(o: CommandeDTO) {
  if (o.emporter) {
    const i = EMPORTER_STEPS.findIndex(s => s.statuts.includes(o.statut));
    return { steps: EMPORTER_STEPS, index: Math.max(0, i) };
  }
  return { steps: TRACK_STEPS, index: statutToStep(o.livraison_statut || o.statut) };
}

export interface ResumeCommande {
  restoName: string;
  titre: string;
  photo?: string;
  Icon: LucideIcon;
  grad: Gradient;
  date: string;
  nbArticles: number;
}

/** Ce qu'on affiche d'une commande : plat principal, restaurant, visuel, date. */
export function useResumeCommande(order: CommandeDTO): ResumeCommande {
  const { restoById } = useApp();
  const resto = order.restaurant ? restoById(order.restaurant) : undefined;
  const restoName = order.restaurant_details?.nom || resto?.name || 'Commande';
  const lignes = order.lignes ?? [];
  const first = lignes[0]?.plat_details;
  const nbArticles = lignes.reduce((n, l) => n + (l.quantite || 1), 0);
  return {
    restoName,
    titre: first
      ? (lignes.length > 1 ? `${first.nom} +${lignes.length - 1} autre${lignes.length > 2 ? 's' : ''}` : first.nom)
      : restoName,
    photo: first?.image ? absMedia(first.image) : undefined,
    Icon: first ? iconForPlat(first.nom, first.categorie_nom) : (resto?.icon ?? iconForResto(restoName, order.restaurant ?? 0)),
    grad: resto?.grad ?? gradForId(order.restaurant ?? 0),
    date: formaterDate(order.created_at),
    nbArticles,
  };
}

function formaterDate(iso: string): string {
  const d = new Date(iso);
  const auj = new Date();
  const hier = new Date(); hier.setDate(auj.getDate() - 1);
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === auj.toDateString()) return `Aujourd'hui, ${heure}`;
  if (d.toDateString() === hier.toDateString()) return `Hier, ${heure}`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + `, ${heure}`;
}

/** Remet au panier les plats d'une commande (ceux sans choix obligatoire). */
export function useCommanderANouveau() {
  const { addToCart, dishById } = useApp();
  const toast = useToast();
  const router = useRouter();
  return (order: CommandeDTO) => {
    let ajoutes = 0;
    let ignores = 0;
    for (const l of order.lignes ?? []) {
      const dish = l.plat != null ? dishById(l.plat) : undefined;
      const choixObligatoire = (dish?.groupesComplements ?? []).some(g => g.obligatoire && g.options.length > 0);
      if (!dish || choixObligatoire) { ignores += 1; continue; }
      addToCart(dish.id, l.quantite || 1, [], !!order.emporter);
      ajoutes += 1;
    }
    if (ajoutes === 0) {
      toast.error('Ces plats ne sont plus disponibles à l\'identique. Choisissez-les depuis le menu.');
      return;
    }
    toast.success(ignores ? 'Plats ajoutés — certains demandent un choix, à refaire.' : 'Commande ajoutée au panier !');
    router.push('/(client)/panier');
  };
}

// ─── Barre de progression segmentée (une étape = un segment) ──
export function EtapesBar({ total, index, couleur = Brand.accent }: { total: number; index: number; couleur?: string }) {
  const { colors } = useApp();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.seg, { backgroundColor: colors.border }]}>
          {i < index && <View style={[StyleSheet.absoluteFill, { backgroundColor: Brand.green }]} />}
          {i === index && <SegmentActif couleur={couleur} />}
        </View>
      ))}
    </View>
  );
}

/** Segment de l'étape en cours : se remplit en boucle, signe d'activité. */
function SegmentActif({ couleur }: { couleur: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }), -1);
    return () => cancelAnimation(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    width: `${interpolate(t.value, [0, 1], [15, 100])}%`,
    opacity: interpolate(t.value, [0, 0.8, 1], [1, 1, 0.4]),
  }));
  return <Reanimated.View style={[styles.segFill, { backgroundColor: couleur }, style]} />;
}

/** Point vert qui pulse — « en direct ». */
export function PointDirect() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.out(Easing.ease) }), -1);
    return () => cancelAnimation(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.6, 0]),
    transform: [{ scale: interpolate(t.value, [0, 1], [1, 2.4]) }],
  }));
  return (
    <View style={styles.liveDotWrap}>
      <Reanimated.View style={[styles.liveDot, styles.liveRing, ring]} />
      <View style={styles.liveDot} />
    </View>
  );
}

// ─── Carte « commande en cours » ─────────────────────────────
export function LiveOrderCard({ order }: { order: CommandeDTO }) {
  const { colors } = useApp();
  const router = useRouter();
  const r = useResumeCommande(order);
  const st = statutAffiche(order);
  const { steps, index } = etapesDe(order);
  const eta = order.suivi?.eta_minutes;

  return (
    <PressableScale onPress={() => router.push(`/tracking?id=${order.id}`)} scaleTo={0.98}>
      <LinearGradient
        colors={[Brand.accentTop + '55', Brand.green + '44']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.liveBorder, cardShadow(colors.shadow)]}
      >
        <View style={[styles.live, { backgroundColor: colors.page }]}>
          <View style={styles.row}>
            <PointDirect />
            <Text style={[bodyFont(11, '800'), { color: Brand.green, letterSpacing: 0.6, marginLeft: 8 }]}>EN DIRECT</Text>
            <View style={{ flex: 1 }} />
            <Text style={[bodyFont(11, '600'), { color: colors.faint }]}>#{order.id} · {r.date}</Text>
          </View>

          <View style={[styles.row, { gap: 12, marginTop: 12 }]}>
            <DishTile Icon={r.Icon} grad={r.grad} image={r.photo} size={54} iconSize={22} radius={15} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[displayFont(15, '800'), { color: colors.text }]}>{r.titre}</Text>
              <Text numberOfLines={1} style={[bodyFont(12, '600'), { color: colors.muted, marginTop: 2 }]}>{r.restoName}</Text>
              <View style={[styles.row, { gap: 6, marginTop: 6 }]}>
                <st.Icon size={13} color={st.color} strokeWidth={2.5} />
                <Text style={[bodyFont(12.5, '800'), { color: st.color }]}>{st.label}</Text>
                {eta != null && order.livraison_statut === 'en_livraison' && (
                  <Text style={[bodyFont(12, '700'), { color: colors.muted }]}>· ~{eta} min</Text>
                )}
              </View>
            </View>
          </View>

          <View style={{ marginTop: 14 }}><EtapesBar total={steps.length} index={index} /></View>

          <View style={[styles.row, { marginTop: 14 }]}>
            {order.emporter && order.code_retrait ? (
              <View style={[styles.row, { gap: 6, flex: 1 }]}>
                <ShoppingBag size={14} color={Brand.green} strokeWidth={2.4} />
                <Text style={[bodyFont(12.5, '700'), { color: colors.muted }]}>Code </Text>
                <Text style={[displayFont(15, '800'), { color: Brand.green, letterSpacing: 2 }]}>{order.code_retrait}</Text>
              </View>
            ) : (
              <Text style={[displayFont(15, '800'), { color: colors.text, flex: 1 }]}>{formatPrice(Number(order.montant_total))}</Text>
            )}
            <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trackBtn}>
              <Text style={[bodyFont(12.5, '800'), { color: '#fff' }]}>Suivre</Text>
              <ChevronRight size={15} color="#fff" strokeWidth={2.8} />
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

// ─── Carte d'historique ──────────────────────────────────────
export function OrderHistoryCard({ order }: { order: CommandeDTO }) {
  const { colors } = useApp();
  const r = useResumeCommande(order);
  const st = statutAffiche(order);
  const recommander = useCommanderANouveau();
  const termineeOk = order.statut === 'livree' || order.statut === 'recuperee';

  return (
    <View style={[styles.hist, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.row, { gap: 12 }]}>
        <DishTile Icon={r.Icon} grad={r.grad} image={r.photo} size={52} iconSize={22} radius={14} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[displayFont(14, '700'), { color: colors.text }]}>{r.titre}</Text>
          <Text numberOfLines={1} style={[bodyFont(11.5, '500'), { color: colors.muted, marginTop: 2 }]}>
            {r.restoName} · {r.date}
          </Text>
          <View style={[styles.row, { gap: 8, marginTop: 6 }]}>
            <StatusPill Icon={st.Icon} label={st.label} color={st.color} bg={st.bg} />
            {order.emporter && <Text style={[bodyFont(11, '700'), { color: Brand.green }]}>À emporter</Text>}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[displayFont(14, '800'), { color: colors.text }]}>{formatPrice(Number(order.montant_total))}</Text>
          <Text style={[bodyFont(11, '600'), { color: colors.faint, marginTop: 2 }]}>
            {r.nbArticles} article{r.nbArticles > 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      {termineeOk && (
        <PressableScale onPress={() => recommander(order)} style={{ marginTop: 12 }}>
          <View style={[styles.again, { borderColor: Brand.accent + '55', backgroundColor: Brand.accent + '12' }]}>
            <RotateCcw size={14} color={Brand.accentLight} strokeWidth={2.5} />
            <Text style={[bodyFont(12.5, '800'), { color: Brand.accentLight }]}>Commander à nouveau</Text>
          </View>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  seg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  segFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  liveDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.green },
  liveRing: { position: 'absolute' },
  liveBorder: { borderRadius: 24, padding: 1.5 },
  live: { borderRadius: 22.5, padding: 15 },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingLeft: 16, paddingRight: 11, paddingVertical: 9, borderRadius: Radius.pill,
  },
  hist: { padding: 13, borderRadius: 20, borderWidth: 1 },
  again: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1,
  },
});
