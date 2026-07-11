// ═══════════════════════════════════════════════════════════
//  Confirmation de réception d'une commande
//  Le client scanne le QR du livreur OU saisit le code.
//  Sa validation termine la livraison et débloque le paiement resto.
// ═══════════════════════════════════════════════════════════

import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, QrCode, KeyRound, Check, ScanLine, TriangleAlert } from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { confirmReception } from '../services/menu';
import { PressableScale, displayFont, bodyFont } from './ui';

interface Props {
  visible: boolean;
  orderId: number;
  onClose: () => void;
  onConfirmed: () => void;
}

type Tab = 'scan' | 'code';

export function ConfirmReception({ visible, orderId, onClose, onConfirmed }: Props) {
  const { colors } = useApp();
  const [tab, setTab] = useState<Tab>('scan');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const submit = async (value: string) => {
    const clean = value.trim();
    if (!clean || busy) return;
    setBusy(true); setError(null);
    try {
      await confirmReception(orderId, clean);
      onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code invalide. Réessayez.');
      scannedRef.current = false; // autorise un nouveau scan après erreur
    } finally {
      setBusy(false);
    }
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (scannedRef.current || busy) return;
    scannedRef.current = true;
    submit(data);
  };

  const switchTab = (t: Tab) => { setTab(t); setError(null); scannedRef.current = false; };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[displayFont(20, '800'), { color: colors.text }]}>Confirmer la réception</Text>
              <Text style={[bodyFont(12.5, '500'), { color: colors.muted, marginTop: 2 }]}>
                Scannez le QR du livreur ou saisissez son code.
              </Text>
            </View>
            <PressableScale onPress={onClose}>
              <View style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <X size={20} color={colors.text} />
              </View>
            </PressableScale>
          </View>

          {/* Onglets */}
          <View style={styles.tabs}>
            {([['scan', 'Scanner', QrCode], ['code', 'Code', KeyRound]] as const).map(([key, label, Icon]) => {
              const on = tab === key;
              return (
                <PressableScale key={key} onPress={() => switchTab(key)} style={{ flex: 1 }}>
                  <View style={[
                    styles.tab,
                    on ? { backgroundColor: Brand.accent + '1f', borderColor: Brand.accent }
                       : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}>
                    <Icon size={17} color={on ? Brand.accentLight : colors.muted} strokeWidth={2.3} />
                    <Text style={[bodyFont(13.5, '700'), { color: on ? Brand.accentLight : colors.muted }]}>{label}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>

          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            {tab === 'scan' ? (
              <View style={styles.scanWrap}>
                {!permission ? (
                  <ActivityIndicator color={Brand.accent} />
                ) : !permission.granted ? (
                  <View style={styles.permBox}>
                    <QrCode size={44} color={Brand.accentLight} strokeWidth={1.8} />
                    <Text style={[bodyFont(13.5, '600'), { color: colors.muted, textAlign: 'center', marginTop: 12 }]}>
                      Autorisez la caméra pour scanner le QR code du livreur.
                    </Text>
                    <PressableScale onPress={requestPermission} style={{ marginTop: 16 }}>
                      <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.permBtn}>
                        <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>Activer la caméra</Text>
                      </LinearGradient>
                    </PressableScale>
                  </View>
                ) : (
                  <View style={styles.cameraBox}>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={busy ? undefined : onBarcode}
                    />
                    <View style={styles.reticle} pointerEvents="none">
                      <ScanLine size={40} color="#fff" strokeWidth={1.6} />
                    </View>
                    {busy && (
                      <View style={styles.scanBusy}><ActivityIndicator color="#fff" /></View>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View style={{ marginTop: 24 }}>
                <Text style={[bodyFont(12.5, '700'), { color: colors.faint, letterSpacing: 0.5, marginBottom: 8 }]}>
                  CODE DE CONFIRMATION
                </Text>
                <TextInput
                  value={code}
                  onChangeText={t => setCode(t.toUpperCase())}
                  placeholder="Ex : ABC234"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  style={[styles.codeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                />
                <PressableScale onPress={() => submit(code)} style={{ marginTop: 16 }}>
                  <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.confirmBtn, glow(Brand.accent, 20)]}>
                    {busy ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Check size={19} color="#fff" strokeWidth={2.7} />
                        <Text style={[bodyFont(15.5, '800'), { color: '#fff' }]}>Confirmer la réception</Text>
                      </>
                    )}
                  </LinearGradient>
                </PressableScale>
              </View>
            )}

            {error && (
              <View style={styles.errRow}>
                <TriangleAlert size={15} color={Brand.danger} strokeWidth={2.3} />
                <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', flex: 1 }]}>{error}</Text>
              </View>
            )}

            <Text style={[bodyFont(12, '500'), { color: colors.faint, textAlign: 'center', marginTop: 'auto', marginBottom: 16, lineHeight: 18 }]}>
              La confirmation valide la livraison et déclenche le paiement du restaurant.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 18 },
  tab: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: Radius.pill, borderWidth: 1,
  },
  scanWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  permBox: { alignItems: 'center', paddingHorizontal: 30 },
  permBtn: { paddingHorizontal: 26, paddingVertical: 14, borderRadius: Radius.pill },
  cameraBox: {
    width: '100%', aspectRatio: 1, maxWidth: 320, borderRadius: 28, overflow: 'hidden',
    backgroundColor: '#000', borderWidth: 1, borderColor: Brand.accent + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  reticle: {
    width: 180, height: 180, borderRadius: 24, borderWidth: 2.5, borderColor: '#ffffffcc',
    alignItems: 'center', justifyContent: 'center',
  },
  scanBusy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  codeInput: {
    borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 22, fontWeight: '800', letterSpacing: 4, textAlign: 'center',
  },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radius.pill },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 4 },
});
