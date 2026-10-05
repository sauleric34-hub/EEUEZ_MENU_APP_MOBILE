// Logo de marque « Menu » — vrai logo (assets/logo.png) dans un carré blanc
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const LOGO = require('../assets/logo.png');

export function LogoMark({ size = 56, radius = 16 }: { size?: number; radius?: number }) {
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: radius }]}>
      {/* Le PNG a déjà une marge blanche : un léger retrait suffit */}
      <Image source={LOGO} style={{ width: size * 0.94, height: size * 0.94 }} contentFit="contain" />
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
});
