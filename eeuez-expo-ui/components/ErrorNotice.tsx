// ═══════════════════════════════════════════════════════════
//  ErrorNotice — carte d'erreur lisible (connexion, inscription…)
//  Icône et teinte selon la catégorie : réseau coupé, lenteur,
//  panne serveur, saisie refusée… + bouton « Réessayer » facultatif.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  CircleAlert, Hourglass, Lock, RefreshCw, SearchX, ServerCrash, ShieldAlert, WifiOff, CloudOff,
  type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius } from '../constants/theme';
import { PressableScale, bodyFont, displayFont } from './ui';
import { useApp } from '../context/AppContext';
import type { ErrorInfo, ErrorKind } from '../services/errors';

const LOOK: Record<ErrorKind, { Icon: LucideIcon; tint: string }> = {
  offline:     { Icon: WifiOff,     tint: Brand.yellow },
  unreachable: { Icon: CloudOff,    tint: Brand.yellow },
  timeout:     { Icon: Hourglass,   tint: Brand.yellow },
  server:      { Icon: ServerCrash, tint: Brand.accentLight },
  rateLimit:   { Icon: Hourglass,   tint: Brand.accentLight },
  auth:        { Icon: Lock,        tint: Brand.danger },
  forbidden:   { Icon: ShieldAlert, tint: Brand.danger },
  notFound:    { Icon: SearchX,     tint: Brand.accentLight },
  validation:  { Icon: CircleAlert, tint: Brand.danger },
  unknown:     { Icon: CircleAlert, tint: Brand.danger },
};

/** Icône représentant une catégorie d'erreur (écrans plein-page, etc.). */
export const errorIcon = (kind: ErrorKind): LucideIcon => LOOK[kind].Icon;

/** Problèmes passagers : proposer de réessayer a du sens. */
const RETRYABLE: ErrorKind[] = ['offline', 'unreachable', 'timeout', 'server', 'unknown'];

export function ErrorNotice({ error, onRetry, style }: {
  error: ErrorInfo;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();
  const { Icon, tint } = LOOK[error.kind];
  const anim = useRef(new Animated.Value(0)).current;

  // Glisse depuis le haut + fondu. Rejoue à chaque nouvelle erreur
  // (l'appelant passe `key` pour remonter le composant).
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showRetry = onRetry && RETRYABLE.includes(error.kind);

  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        styles.card,
        { backgroundColor: `${tint}14`, borderColor: `${tint}55` },
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
        style,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tint}26` }]}>
        <Icon size={19} color={tint} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[displayFont(14.5, '700'), { color: colors.text }]}>{error.title}</Text>
        <Text style={[bodyFont(12.5, '500'), styles.msg, { color: colors.muted }]}>{error.message}</Text>
        {showRetry && (
          <PressableScale onPress={onRetry} style={{ alignSelf: 'flex-start' }}>
            <View style={[styles.retry, { borderColor: `${tint}66` }]}>
              <RefreshCw size={13} color={tint} strokeWidth={2.4} />
              <Text style={[bodyFont(12, '800'), { color: colors.text }]}>Réessayer</Text>
            </View>
          </PressableScale>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: 1, borderRadius: Radius.md, padding: 14, marginBottom: 14,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  msg: { marginTop: 3, lineHeight: 18 },
  retry: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1,
  },
});
