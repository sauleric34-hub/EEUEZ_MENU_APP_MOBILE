// Signature « par NgAfrica » en pied des écrans d'authentification
// (à la manière du « from Meta »). Le logo reprend backend/static/favicon.svg.
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { G, Polygon } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { bodyFont } from './ui';

export function NgAfricaMark({ size = 14 }: { size?: number }) {
  // viewBox 616×482 : on garde le ratio d'origine
  return (
    <Svg width={size * (616 / 482)} height={size} viewBox="322 198 616 482">
      <G strokeLinejoin="round" strokeWidth={12}>
        <Polygon points="624,206 724,342 460,453" fill="#F4A100" stroke="#F4A100" />
        <Polygon points="329,654 435,493 737,367 749,372 800,453 521,568 461,657" fill="#04614A" stroke="#04614A" />
        <Polygon points="543,595 811,479 859,548 631,665" fill="#0F8A64" stroke="#0F8A64" />
        <Polygon points="682,671 869,573 931,662 926,673" fill="#DC1431" stroke="#DC1431" />
      </G>
    </Svg>
  );
}

export function NgAfricaCredit({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useApp();
  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Un produit NgAfrica">
      <Text style={[bodyFont(11, '500'), { color: colors.faint }]}>par</Text>
      <View style={styles.brand}>
        <NgAfricaMark size={13} />
        <Text style={[bodyFont(12.5, '800'), { color: colors.muted, letterSpacing: 0.2 }]}>NgAfrica</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
