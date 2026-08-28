// ═══════════════════════════════════════════════════════════
//  QR + code de confirmation à montrer au client à la livraison.
//  Le client scanne le QR (payload « EEUEZ:<id>:<code> ») ou saisit
//  le code à 6 caractères dans son application.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Brand } from '../constants/theme';
import { displayFont, bodyFont } from './ui';

interface Props {
  commandeId: number;
  code: string;
}

export function DeliveryQR({ commandeId, code }: Props) {
  const payload = `EEUEZ:${commandeId}:${code}`;
  return (
    <View style={styles.wrap}>
      <View style={styles.qrBox}>
        <QRCode value={payload} size={190} backgroundColor="#fff" color="#111" />
      </View>
      <Text style={[bodyFont(12, '600'), { color: '#8a938c', marginTop: 14 }]}>
        OU dictez ce code au client
      </Text>
      <Text style={[displayFont(30, '800'), styles.code]}>{code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  qrBox: { padding: 14, backgroundColor: '#fff', borderRadius: 16 },
  code: { color: Brand.green, letterSpacing: 8, marginTop: 4 },
});
