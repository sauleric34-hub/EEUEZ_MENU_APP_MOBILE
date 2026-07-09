// Fond d'écran commun : dégradé + halos d'ambiance (orange / vert)
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Brand } from '../constants/theme';
import { useApp } from '../context/AppContext';

export function ScreenBg({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useApp();
  return (
    <LinearGradient colors={colors.screenGrad} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[styles.fill, style]}>
      <View pointerEvents="none" style={[styles.blob, { top: '4%', left: '-14%', backgroundColor: Brand.green, opacity: 0.16 }]} />
      <View pointerEvents="none" style={[styles.blob, { bottom: '2%', right: '-16%', backgroundColor: Brand.accent, opacity: 0.13 }]} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  blob: { position: 'absolute', width: 320, height: 320, borderRadius: 160 },
});
