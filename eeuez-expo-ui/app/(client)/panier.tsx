// ═══════════════════════════════════════════════════════════
//  Panier
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ShoppingCart, Minus, Plus, Trash2, ArrowRight, MapPin, TriangleAlert, Banknote, Smartphone, ChevronRight, Star, Phone } from 'lucide-react-native';
import { Brand, Radius, glow } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { formatPrice } from '../../data/menuData';
import type { PaymentMode } from '../../services/menu';
import { initiateMonetbilPayment, cancelOrder } from '../../services/menu';
import { ScreenBg } from '../../components/ScreenBg';
import { DishTile, PressableScale, displayFont, bodyFont } from '../../components/ui';
import { MonetbilWebView } from '../../components/MonetbilWebView';

const PAYMENTS: { mode: PaymentMode; label: string; Icon: typeof Banknote }[] = [
  { mode: 'mtn_money', label: 'MTN Money', Icon: Smartphone },
  { mode: 'orange_money', label: 'Orange Money', Icon: Smartphone },
];

/** Modes qui nécessitent le widget Monetbil (tous les modes actuels) */
const MONETBIL_MODES: PaymentMode[] = ['mtn_money', 'orange_money'];

export default function PanierScreen() {
  const { colors, cartLines, cartInc, cartDec, cartRemove, clearCart, subtotal, deliveryFee, total, cartCount, checkout, reloadOrders, deliveryAddress, user } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<PaymentMode>('mtn_money');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.telephone || '');

  // ─── État WebView Monetbil ────────────────────────────
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  // Commande créée mais non encore payée (mobile money). Tant qu'elle n'est pas
  // confirmée, elle est invisible du restaurant et peut être relancée ou annulée.
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);

  /** Lance (ou relance) le widget Monetbil pour une commande déjà créée. */
  const launchPayment = async (orderId: number) => {
    setBusy(true); setError(null);
    try {
      const data = await initiateMonetbilPayment(orderId, phone || undefined);
      if (data.payment_url) setPaymentUrl(data.payment_url);
      else setError('Paiement indisponible pour le moment. Réessayez.');
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'initiation du paiement a échoué.");
    } finally {
      setBusy(false);
    }
  };

  /** Supprime la commande non payée puis réinitialise l'état de paiement. */
  const abandonOrder = async () => {
    const orderId = pendingOrderId;
    setPendingOrderId(null);
    if (orderId == null) return;
    try {
      await cancelOrder(orderId);
    } catch {
      // La commande non confirmée n'est de toute façon pas visible du restaurant.
    } finally {
      // Rafraîchit la liste (la commande non payée disparaît) ; le panier est conservé.
      reloadOrders();
    }
  };

  const submit = async () => {
    if (!deliveryAddress) { setError('Veuillez choisir un lieu de livraison.'); return; }
    setBusy(true); setError(null);
    try {
      // 1. Créer la commande (toujours)
      const order = await checkout(mode);

      if (MONETBIL_MODES.includes(mode)) {
        // 2. Pour MTN/Orange Money → initier le paiement Monetbil.
        //    On NE vide PAS le panier : la commande n'existe vraiment qu'une fois
        //    payée. Si le paiement est abandonné, les plats restent au panier.
        setPendingOrderId(order.id);
        await launchPayment(order.id);
        // Le WebView gère la suite (onSuccess / onCancel)
      } else {
        // Espèces → commande confirmée : on vide le panier et on suit la livraison.
        clearCart();
        router.push('/tracking');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La commande a échoué.');
      setBusy(false);
    }
  };

  return (
    <>
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={[displayFont(26, '800'), { color: colors.text }]}>Mon panier</Text>

          {cartCount === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ShoppingCart size={44} color={Brand.accentLight} strokeWidth={1.8} />
              </View>
              <Text style={[displayFont(18, '700'), { color: colors.text, marginTop: 16 }]}>Panier vide</Text>
              <Text style={[bodyFont(13, '500'), styles.emptyTxt, { color: colors.muted }]}>
                Ajoutez des plats depuis le menu pour commander.
              </Text>
              <PressableScale onPress={() => router.push('/(client)/plats')} style={{ marginTop: 20 }}>
                <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.browseBtn}>
                  <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>Parcourir les plats</Text>
                </LinearGradient>
              </PressableScale>
            </View>
          ) : (
            <>
              <View style={{ gap: 13, marginTop: 20 }}>
                {cartLines.map(({ dish, qty }) => (
                  <View key={dish.id} style={[styles.line, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <DishTile Icon={dish.icon} grad={dish.grad} image={dish.image} size={64} iconSize={28} radius={16} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[displayFont(14.5, '700'), { color: colors.text }]}>{dish.name}</Text>
                      <Text style={[displayFont(14, '800'), { color: Brand.accentLight, marginTop: 4 }]}>{formatPrice(dish.price)}</Text>
                      <View style={[styles.stepper, { backgroundColor: colors.surface2 }]}>
                        <PressableScale onPress={() => cartDec(dish.id)}>
                          <View style={[styles.stepBtn, { backgroundColor: colors.surface }]}><Minus size={16} color={colors.text} strokeWidth={2.6} /></View>
                        </PressableScale>
                        <Text style={[displayFont(14, '800'), { color: colors.text, minWidth: 20, textAlign: 'center' }]}>{qty}</Text>
                        <PressableScale onPress={() => cartInc(dish.id)}>
                          <View style={[styles.stepBtn, { backgroundColor: Brand.accent }]}><Plus size={16} color="#fff" strokeWidth={2.6} /></View>
                        </PressableScale>
                      </View>
                    </View>
                    <PressableScale onPress={() => cartRemove(dish.id)}>
                      <View style={styles.trash}><Trash2 size={16} color={Brand.danger} strokeWidth={2.2} /></View>
                    </PressableScale>
                  </View>
                ))}
              </View>

              {/* Lieu de livraison (GPS précis) */}
              <Text style={[displayFont(15, '700'), { color: colors.text, marginTop: 22, marginBottom: 10 }]}>Lieu de livraison</Text>
              <PressableScale onPress={() => router.push('/location-picker')}>
                <View style={[styles.addrRow, { backgroundColor: colors.surface, borderColor: deliveryAddress ? Brand.accent + '55' : colors.border }]}>
                  <View style={[styles.addrPin, { backgroundColor: Brand.accent + '1f' }]}>
                    <MapPin size={18} color={Brand.accentLight} strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {deliveryAddress ? (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text numberOfLines={1} style={[bodyFont(13.5, '800'), { color: colors.text, flexShrink: 1 }]}>
                            {deliveryAddress.label || 'Adresse choisie'}
                          </Text>
                          {deliveryAddress.savedId != null && (
                            <Star size={12} color={Brand.yellow} fill={Brand.yellow} strokeWidth={0} />
                          )}
                        </View>
                        <Text numberOfLines={1} style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 2 }]}>
                          {deliveryAddress.adresse}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[bodyFont(13.5, '800'), { color: colors.text }]}>Choisir un lieu</Text>
                        <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 2 }]}>
                          Ma position, une recherche ou un lieu enregistré
                        </Text>
                      </>
                    )}
                  </View>
                  <ChevronRight size={20} color={colors.faint} strokeWidth={2.4} />
                </View>
              </PressableScale>

              {/* Mode de paiement */}
              <Text style={[displayFont(15, '700'), { color: colors.text, marginTop: 20, marginBottom: 10 }]}>Paiement</Text>
              <View style={styles.payRow}>
                {PAYMENTS.map(p => {
                  const on = p.mode === mode;
                  return (
                    <PressableScale key={p.mode} onPress={() => setMode(p.mode)} style={{ flex: 1 }}>
                      <View style={[
                        styles.payChip,
                        on
                          ? { backgroundColor: Brand.accent + '1f', borderColor: Brand.accent }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}>
                        <p.Icon size={18} color={on ? Brand.accentLight : colors.muted} strokeWidth={2.2} />
                        <Text numberOfLines={1} style={[bodyFont(11, '700'), { color: on ? Brand.accentLight : colors.muted }]}>{p.label}</Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>

              {/* Numéro de téléphone (Mobile Money uniquement) */}
              {MONETBIL_MODES.includes(mode) && (
                <View style={[styles.phoneRow, { backgroundColor: colors.surface, borderColor: Brand.accent + '55' }]}>
                  <View style={[styles.phoneIcon, { backgroundColor: Brand.accent + '1f' }]}>
                    <Phone size={16} color={Brand.accentLight} strokeWidth={2.3} />
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="N° de téléphone (ex: 6XXXXXXXX)"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                    style={[bodyFont(13.5, '600'), styles.phoneInput, { color: colors.text }]}
                  />
                </View>
              )}


              <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sumRow}>
                  <Text style={[bodyFont(14, '500'), { color: colors.muted }]}>Sous-total</Text>
                  <Text style={[bodyFont(14, '700'), { color: colors.text }]}>{formatPrice(subtotal)}</Text>
                </View>
                <View style={[styles.sumRow, { marginTop: 10 }]}>
                  <Text style={[bodyFont(14, '500'), { color: colors.muted }]}>Livraison</Text>
                  <Text style={[bodyFont(14, '700'), { color: '#8fd6a8' }]}>{formatPrice(deliveryFee)}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.sumRow}>
                  <Text style={[displayFont(18, '800'), { color: colors.text }]}>Total</Text>
                  <Text style={[displayFont(22, '800'), { color: Brand.accentLight }]}>{formatPrice(total)}</Text>
                </View>
                {error && (
                  <View style={styles.errRow}>
                    <TriangleAlert size={15} color={Brand.danger} strokeWidth={2.3} />
                    <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', flex: 1 }]}>{error}</Text>
                  </View>
                )}
                {busy ? (
                  <View style={[styles.checkout, { backgroundColor: Brand.accent, marginTop: 16 }]}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : (
                  <PressableScale onPress={submit} style={{ marginTop: 16 }}>
                    <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.checkout, glow(Brand.accent, 24)]}>
                      <Text style={[bodyFont(15.5, '800'), { color: '#fff' }]}>Finaliser la commande</Text>
                      <ArrowRight size={19} color="#fff" strokeWidth={2.6} />
                    </LinearGradient>
                  </PressableScale>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>

    {/* ─── Modal WebView Monetbil ─────────────────── */}
    {paymentUrl && (
      <MonetbilWebView
        paymentUrl={paymentUrl}
        amount={total}
        onSuccess={() => {
          setPaymentUrl(null);
          setPendingOrderId(null);
          // Paiement confirmé → c'est une vraie commande : on vide le panier.
          clearCart();
          reloadOrders();
          router.push('/tracking');
        }}
        onCancel={() => {
          setPaymentUrl(null);
          Alert.alert(
            'Paiement non finalisé',
            "Votre paiement n'a pas été confirmé. Voulez-vous réessayer ?",
            [
              {
                text: 'Abandonner',
                style: 'destructive',
                onPress: () => {
                  abandonOrder();
                  setError("Commande annulée : le paiement n'a pas abouti.");
                },
              },
              {
                text: 'Réessayer',
                onPress: () => { if (pendingOrderId != null) launchPayment(pendingOrderId); },
              },
            ],
            { cancelable: false },
          );
        }}
      />
    )}
  </>);
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { width: 96, height: 96, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { textAlign: 'center', maxWidth: 220, marginTop: 6, lineHeight: 19 },
  browseBtn: { paddingHorizontal: 26, paddingVertical: 14, borderRadius: Radius.pill },
  line: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: 20, borderWidth: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, padding: 4, alignSelf: 'flex-start', marginTop: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  trash: { width: 38, height: 38, borderRadius: 19, backgroundColor: Brand.danger + '14', alignItems: 'center', justifyContent: 'center' },
  addrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1,
  },
  addrPin: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  payRow: { flexDirection: 'row', gap: 8 },
  payChip: {
    alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1,
  },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1,
  },
  phoneIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  phoneInput: { flex: 1, paddingVertical: 4 },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  summary: { padding: 18, borderRadius: 24, borderWidth: 1, marginTop: 16 },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, marginVertical: 14 },
  checkout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radius.pill },
});
