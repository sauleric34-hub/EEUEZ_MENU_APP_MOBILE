// ═══════════════════════════════════════════════════════════
//  Favoris
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeartOff } from 'lucide-react-native';
import { Brand } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { ScreenBg } from '../../components/ScreenBg';
import { displayFont, bodyFont } from '../../components/ui';
import { DishCardGrid } from '../../components/cards';

export default function FavorisScreen() {
  const { colors, favList } = useApp();
  const count = favList.length;
  const label = count > 0
    ? `${count} plat${count > 1 ? 's' : ''} aimé${count > 1 ? 's' : ''}`
    : 'Votre liste est vide';

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={[displayFont(26, '800'), { color: colors.text }]}>Mes favoris</Text>
          <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 4 }]}>{label}</Text>

          {count > 0 ? (
            <View style={styles.grid}>
              {favList.map(d => (
                <View key={d.id} style={styles.cell}><DishCardGrid dish={d} /></View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <HeartOff size={44} color={Brand.accentLight} strokeWidth={1.8} />
              </View>
              <Text style={[displayFont(18, '700'), { color: colors.text, marginTop: 16 }]}>Aucun favori</Text>
              <Text style={[bodyFont(13, '500'), styles.emptyTxt, { color: colors.muted }]}>
                Touchez le cœur sur un plat pour le retrouver ici.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 22, gap: 14 },
  cell: { width: '47%', flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { width: 96, height: 96, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { textAlign: 'center', maxWidth: 230, marginTop: 6, lineHeight: 19 },
});
