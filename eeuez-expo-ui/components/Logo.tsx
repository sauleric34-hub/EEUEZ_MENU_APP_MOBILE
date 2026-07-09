// Logo de marque « Menu » — carré blanc, initiale verte, bande kente
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Brand } from '../constants/theme';
import { KenteStripe, displayFont } from './ui';

export function LogoMark({ size = 56, radius = 16 }: { size?: number; radius?: number }) {
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: radius }]}>
      <KenteStripe height={Math.max(4, size * 0.06)} style={styles.stripe} />
      <Text style={[displayFont(size * 0.5, '800'), { color: Brand.green }]}>M</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0 },
});
