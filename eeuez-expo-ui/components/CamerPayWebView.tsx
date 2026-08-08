// ═══════════════════════════════════════════════════════════
//  CamerPayWebView — Modal plein écran de paiement Mobile Money
//  Affiche la pay_url CamerPay dans un WebView.
//  Surveille la navigation vers CAMERPAY_SUCCESS_URL pour détecter la fin
//  du paiement, puis VÉRIFIE réellement la confirmation (paiement_confirme)
//  par un court polling plutôt qu'un délai fixe — plus robuste sur réseau lent.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Brand, Radius } from '../constants/theme';
import { CAMERPAY_SUCCESS_URL } from '../constants/api';
import { fetchOrder } from '../services/menu';
import { bodyFont, displayFont } from './ui';

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 8; // ~12 s au maximum avant de céder à la redirection

interface Props {
  /** pay_url CamerPay reçue du backend. */
  paymentUrl: string;
  /** Identifiant de la commande — permet de vérifier réellement le paiement
   *  (paiement_confirme) plutôt que de se fier à un simple délai. */
  orderId?: number;
  /** Appelé quand le paiement est confirmé (ou, à défaut d'orderId, après
   *  détection de la page de succès). */
  onSuccess: () => void;
  /** Appelé quand l'utilisateur ferme manuellement ou qu'une erreur survient. */
  onCancel: () => void;
  /** Relance un paiement (nouvelle pay_url) après un échec — affiche un
   *  bouton « Réessayer » quand fourni. */
  onRetry?: () => void;
  /** Montant affiché dans le header (optionnel). */
  amount?: number;
}

export function CamerPayWebView({ paymentUrl, orderId, onSuccess, onCancel, onRetry, amount }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const handledRef = useRef(false);

  // Fondu du contenu à l'ouverture (et à chaque nouvelle tentative) — vient
  // s'ajouter au slide natif de la Modal plutôt que de s'y substituer.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [paymentUrl, fade]);

  // Une nouvelle pay_url (relance après échec) réinitialise tout l'état local.
  useEffect(() => {
    handledRef.current = false;
    setLoading(true);
    setLoadError(false);
    setPaymentFailed(false);
    setVerifying(false);
  }, [paymentUrl]);

  /** Vérifie réellement le paiement (paiement_confirme) au lieu d'un délai
   *  fixe : on interroge la commande jusqu'à confirmation ou jusqu'à un
   *  plafond de tentatives, borné dans le temps (~12 s) même sur réseau lent. */
  const verifyPayment = async () => {
    setVerifying(true);
    if (orderId != null) {
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        try {
          const commande = await fetchOrder(orderId);
          if (commande.paiement_confirme) break;
        } catch {
          // Tentative suivante — on ne cède qu'après épuisement du quota.
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } else {
      // Pas d'identifiant fourni par l'appelant : repli minimal.
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    setVerifying(false);
    onSuccess();
  };

  const handleNavChange = (nav: WebViewNavigation) => {
    if (handledRef.current) return;
    // Échec / annulation → état d'échec visible, avec option de réessayer.
    if (nav.url.includes('/payment/failed')) {
      handledRef.current = true;
      setPaymentFailed(true);
      return;
    }
    // Succès → redirection vers /payment/success/
    if (nav.url.startsWith(CAMERPAY_SUCCESS_URL) || nav.url.includes('/payment/success')) {
      handledRef.current = true;
      verifyPayment();
    }
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <Animated.View style={{ flex: 1, opacity: fade }}>
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
          {loadError ? (
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
          ) : paymentFailed ? (
            <View style={styles.errorBox}>
              <View style={styles.failIcon}>
                <TriangleAlert size={28} color={Brand.danger} strokeWidth={2.2} />
              </View>
              <Text style={[displayFont(16, '700'), { color: '#fff', textAlign: 'center', marginTop: 14 }]}>
                Le paiement a échoué
              </Text>
              <Text style={[bodyFont(13, '500'), { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8 }]}>
                La transaction n'a pas abouti. Vous pouvez réessayer.
              </Text>
              <View style={styles.failActions}>
                {onRetry && (
                  <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
                    <Text style={[bodyFont(14, '700'), { color: '#fff' }]}>Réessayer</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.retryBtn, styles.closeBtnAlt]} onPress={onCancel}>
                  <Text style={[bodyFont(14, '700'), { color: 'rgba(255,255,255,0.85)' }]}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <WebView
              source={{ uri: paymentUrl }}
              style={styles.webview}
              onNavigationStateChange={handleNavChange}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => { setLoading(false); setLoadError(true); }}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState={false}
              mixedContentMode="compatibility"
            />
          )}

          {/* Indicateur de chargement superposé */}
          {loading && !loadError && !paymentFailed && !verifying && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Brand.accentLight} />
              <Text style={[bodyFont(13, '600'), { color: 'rgba(255,255,255,0.7)', marginTop: 12 }]}>
                Chargement du paiement…
              </Text>
            </View>
          )}

          {/* Vérification réelle du paiement — remplace l'ancien délai fixe */}
          {verifying && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Brand.accentLight} />
              <Text style={[bodyFont(13, '600'), { color: 'rgba(255,255,255,0.7)', marginTop: 12 }]}>
                Vérification du paiement…
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
      </Animated.View>
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
  failIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Brand.danger + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  failActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  retryBtn: {
    backgroundColor: Brand.accent,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: Radius.pill,
  },
  closeBtnAlt: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
