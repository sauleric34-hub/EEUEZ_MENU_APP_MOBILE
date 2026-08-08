// ═══════════════════════════════════════════════════════════
//  CamerPayWebView — Modal plein écran de paiement Mobile Money
//  Affiche la pay_url CamerPay dans un WebView.
//  Surveille la navigation vers CAMERPAY_SUCCESS_URL pour
//  détecter la fin du paiement et appeler onSuccess / onCancel.
// ═══════════════════════════════════════════════════════════

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Brand, Radius } from '../constants/theme';
import { CAMERPAY_SUCCESS_URL } from '../constants/api';
import { bodyFont, displayFont } from './ui';

interface Props {
  /** pay_url CamerPay reçue du backend. */
  paymentUrl: string;
  /** Appelé quand la page de succès est détectée. */
  onSuccess: () => void;
  /** Appelé quand l'utilisateur ferme manuellement ou qu'une erreur survient. */
  onCancel: () => void;
  /** Montant affiché dans le header (optionnel). */
  amount?: number;
}

export function CamerPayWebView({ paymentUrl, onSuccess, onCancel, amount }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const handledRef = useRef(false);

  const handleNavChange = (nav: WebViewNavigation) => {
    if (handledRef.current) return;
    // Échec / annulation → on ferme et on prévient
    if (nav.url.includes('/payment/failed')) {
      handledRef.current = true;
      setTimeout(onCancel, 800);
      return;
    }
    // Succès → redirection vers /payment/success/
    if (nav.url.startsWith(CAMERPAY_SUCCESS_URL) || nav.url.includes('/payment/success')) {
      handledRef.current = true;
      // Petit délai pour que la page de succès s'affiche une fraction de seconde
      setTimeout(onSuccess, 800);
    }
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ─── Header ─────────────────────────────────────── */}
        <View style={styles.header}>
          <LinearGradient
            colors={[Brand.accentTop, Brand.accentBot]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGrad}
          >
            <View style={styles.headerLeft}>
              <ShieldCheck size={18} color="#fff" strokeWidth={2.4} />
              <View>
                <Text style={[displayFont(13, '800'), { color: '#fff' }]}>
                  Paiement sécurisé
                </Text>
                {amount !== undefined && (
                  <Text style={[bodyFont(11, '600'), { color: 'rgba(255,255,255,0.75)' }]}>
                    {amount.toLocaleString('fr-CM')} FCFA
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} hitSlop={12}>
              <X size={20} color="#fff" strokeWidth={2.6} />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* ─── WebView ─────────────────────────────────────── */}
        <View style={styles.webviewContainer}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={[displayFont(16, '700'), { color: '#fff', textAlign: 'center' }]}>
                Impossible de charger la page de paiement.
              </Text>
              <Text style={[bodyFont(13, '500'), { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8 }]}>
                Vérifiez votre connexion internet et réessayez.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onCancel}>
                <Text style={[bodyFont(14, '700'), { color: '#fff' }]}>Fermer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              source={{ uri: paymentUrl }}
              style={styles.webview}
              onNavigationStateChange={handleNavChange}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState={false}
              mixedContentMode="compatibility"
            />
          )}

          {/* Indicateur de chargement superposé */}
          {loading && !error && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Brand.accentLight} />
              <Text style={[bodyFont(13, '600'), { color: 'rgba(255,255,255,0.7)', marginTop: 12 }]}>
                Chargement du paiement…
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  header: {
    shadowColor: Brand.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: Brand.accent,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: Radius.pill,
  },
});
