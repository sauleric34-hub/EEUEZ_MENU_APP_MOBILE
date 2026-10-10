// ═══════════════════════════════════════════════════════════
//  Carte de fidélité du profil — carte de membre Bronze/Argent/Or
//  avec reflet, points animés, valeur en FCFA et jauge vers le
//  niveau suivant (seuils fournis par le serveur).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Award, Sparkles } from 'lucide-react-native';
import { formatPrice } from '../data/menuData';
import type { NiveauFidelite } from '../services/dto';
import type { FideliteApercuDTO } from '../services/menu';
import { KenteStripe, bodyFont, displayFont } from './ui';

const STYLES: Record<NiveauFidelite, { libelle: string; grad: [string, string, string]; texte: string }> = {
  bronze: { libelle: 'Bronze', grad: ['#b9783d', '#8a5a2b', '#4a2f14'], texte: '#fff3e6' },
  argent: { libelle: 'Argent', grad: ['#c9d1da', '#8d98a5', '#4d5560'], texte: '#ffffff' },
  or:     { libelle: 'Or',     grad: ['#ffd25a', '#e0a10a', '#8a5a06'], texte: '#2a1a00' },
};
const SUIVANT: Record<NiveauFidelite, NiveauFidelite | null> = { bronze: 'argent', argent: 'or', or: null };

export function FideliteCard({ points, niveau, apercu }: {
  points: number;
  niveau: NiveauFidelite;
  /** Réglages du programme (seuils, valeur des points) — null tant que non chargés. */
  apercu: FideliteApercuDTO | null;
}) {
  const st = STYLES[niveau];
  const prochain = SUIVANT[niveau];
  const seuils = apercu?.seuils;

  // Progression vers le niveau suivant
  let ratio = 1;
  let reste = 0;
  if (prochain && seuils) {
    const bas = seuils[niveau];
    const haut = seuils[prochain];
    ratio = haut > bas ? Math.min(1, Math.max(0, (points - bas) / (haut - bas))) : 1;
    reste = Math.max(0, haut - points);
  }
  // Valeur en FCFA des points (par tranches entières)
  const valeur = apercu && apercu.actif && apercu.points_par_unite > 0
    ? Math.floor(points / apercu.points_par_unite) * apercu.valeur_unite
    : null;

  // ─── Animations : jauge qui se remplit, compteur, reflet ──
  const jauge = useSharedValue(0);
  const reflet = useSharedValue(0);
  const affiche = useCompteur(points);
  useEffect(() => {
    jauge.value = withDelay(250, withTiming(ratio, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [ratio, jauge]);
  useEffect(() => {
    reflet.value = withDelay(600, withRepeat(withSequence(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
      withDelay(4500, withTiming(0, { duration: 0 })),
    ), -1));
    return () => cancelAnimation(reflet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const jaugeStyle = useAnimatedStyle(() => ({ width: `${jauge.value * 100}%` }));
  const refletStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(reflet.value, [0, 1], [-120, 420]) }, { rotate: '20deg' }],
  }));

  const sombre = niveau !== 'or';
  const texteDoux = sombre ? 'rgba(255,255,255,0.75)' : 'rgba(42,26,0,0.7)';

  return (
    <LinearGradient colors={st.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Reanimated.View pointerEvents="none" style={[styles.reflet, refletStyle]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>
      {/* Motif décoratif : cercles discrets */}
      <View style={[styles.cercle, { width: 180, height: 180, right: -60, top: -70 }]} />
      <View style={[styles.cercle, { width: 120, height: 120, right: 30, bottom: -70 }]} />

      <View style={styles.row}>
        <Text style={[bodyFont(11, '800'), { color: texteDoux, letterSpacing: 1.6 }]}>CARTE MEMBRE MENU</Text>
        <View style={{ flex: 1 }} />
        <View style={[styles.badge, { backgroundColor: sombre ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.4)' }]}>
          <Award size={13} color={st.texte} strokeWidth={2.5} />
          <Text style={[bodyFont(12, '900'), { color: st.texte }]}>{st.libelle}</Text>
        </View>
      </View>

      <View style={[styles.row, { alignItems: 'flex-end', marginTop: 18, gap: 8 }]}>
        <Text style={[displayFont(38, '800'), { color: st.texte, lineHeight: 40 }]}>{affiche.toLocaleString('fr-FR')}</Text>
        <Text style={[bodyFont(14, '800'), { color: texteDoux, marginBottom: 6 }]}>points</Text>
        <View style={{ flex: 1 }} />
        {valeur != null && valeur > 0 && (
          <View style={{ alignItems: 'flex-end', marginBottom: 4 }}>
            <Text style={[bodyFont(10.5, '700'), { color: texteDoux }]}>soit</Text>
            <Text style={[displayFont(16, '800'), { color: st.texte }]}>{formatPrice(valeur)}</Text>
          </View>
        )}
      </View>

      <View style={[styles.track, { backgroundColor: sombre ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.45)' }]}>
        <Reanimated.View style={[styles.fill, { backgroundColor: st.texte }, jaugeStyle]} />
      </View>
      <View style={[styles.row, { marginTop: 8, gap: 5 }]}>
        <Sparkles size={12} color={texteDoux} strokeWidth={2.4} />
        <Text style={[bodyFont(11.5, '700'), { color: texteDoux }]}>
          {prochain
            ? (seuils ? `Encore ${reste.toLocaleString('fr-FR')} pts pour le niveau ${STYLES[prochain].libelle}` : 'Gagnez des points en publiant et en commandant')
            : 'Niveau maximum atteint — bravo !'}
        </Text>
      </View>
      <KenteStripe height={4} style={styles.kente} />
    </LinearGradient>
  );
}

/** Compteur qui grimpe jusqu'à la valeur (rend les points tangibles). */
function useCompteur(valeur: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (valeur <= 0) { setN(0); return; }
    const debut = Date.now();
    const duree = 900;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - debut) / duree);
      setN(Math.round(valeur * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [valeur]);
  return n;
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, paddingBottom: 22, overflow: 'hidden', marginTop: 22 },
  row: { flexDirection: 'row', alignItems: 'center' },
  reflet: { position: 'absolute', top: -80, bottom: -80, width: 70 },
  cercle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  track: { height: 7, borderRadius: 4, marginTop: 16, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  kente: { position: 'absolute', left: 0, right: 0, bottom: 0, opacity: 0.85 },
});
