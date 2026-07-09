// ═══════════════════════════════════════════════════════════
//  StarRating — notation interactive 1..5 avec animation
//  Les étoiles rebondissent en cascade jusqu'à la note choisie
//  et la note reste affichée (état interne optimiste).
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Star } from 'lucide-react-native';
import { Brand } from '../constants/theme';
import { bodyFont } from './ui';
import type { Palette } from '../constants/theme';

interface StarRatingProps {
  value: number | null;            // note serveur de l'utilisateur
  onRate: (note: number) => Promise<void> | void;
  colors: Palette;
  size?: number;
}

export function StarRating({ value, onRate, colors, size = 34 }: StarRatingProps) {
  // `selected` conserve localement la note choisie même si la prop tarde à revenir
  const [selected, setSelected] = useState<number | null>(value);
  const [thanks, setThanks] = useState(false);
  const scales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

  // Se resynchronise si le serveur renvoie une note (ex : re-fetch du plat)
  useEffect(() => {
    if (value != null) setSelected(value);
  }, [value]);

  const display = selected ?? 0;

  const animateTo = (note: number) => {
    const seq = scales.slice(0, note).map((s, i) =>
      Animated.sequence([
        Animated.delay(i * 55),
        Animated.spring(s, { toValue: 1.45, useNativeDriver: true, speed: 40, bounciness: 14 }),
        Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
      ]),
    );
    Animated.parallel(seq).start();
  };

  const rate = async (note: number) => {
    setSelected(note);        // ← reste affiché immédiatement (optimiste)
    animateTo(note);
    try {
      await onRate(note);
      setThanks(true);
      setTimeout(() => setThanks(false), 2200);
    } catch { /* on garde l'affichage local même si l'appel échoue */ }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n, i) => {
          const filled = n <= display;
          return (
            <Pressable key={n} onPress={() => rate(n)} hitSlop={6}>
              <Animated.View style={{ transform: [{ scale: scales[i] }] }}>
                <Star
                  size={size}
                  color={filled ? Brand.yellow : colors.faint}
                  fill={filled ? Brand.yellow : 'transparent'}
                  strokeWidth={1.8}
                />
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
      <Text style={[bodyFont(12, '700'), { color: thanks ? '#8fd6a8' : colors.muted, marginTop: 8 }]}>
        {thanks
          ? 'Merci pour votre note !'
          : selected
            ? `Votre note : ${selected}/5 — touchez pour modifier`
            : 'Touchez une étoile pour noter'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row', gap: 10 },
});
