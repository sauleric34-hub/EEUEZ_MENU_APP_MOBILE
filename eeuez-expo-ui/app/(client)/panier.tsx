// ═══════════════════════════════════════════════════════════
//  Panier
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Alert, Animated, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ShoppingCart, Minus, Plus, Trash2, ArrowRight, MapPin, TriangleAlert, Banknote, Smartphone, ChevronRight, Star, Phone, Sparkles, Check } from 'lucide-react-native';
import { Brand, Radius, glow } from '../../constants/theme';
import { useApp, type CartLine, type CartGroup } from '../../context/AppContext';
import { formatPrice } from '../../data/menuData';
import type { PaymentMode, FideliteApercuDTO } from '../../services/menu';
import { initiateCamerPayPaymentGroupe, cancelOrderGroup, fetchFideliteApercu } from '../../services/menu';
import type { CommandeGroupeDTO } from '../../services/dto';
import { ScreenBg } from '../../components/ScreenBg';
import { DishTile, PressableScale, displayFont, bodyFont } from '../../components/ui';
import { CamerPayWebView } from '../../components/CamerPayWebView';
import { useGardeDemo } from '../../hooks/useGardeDemo';
import { useToast } from '../../context/ToastContext';
import { animateListChange } from '../../lib/layoutAnimation';

const PAYMENTS: { mode: PaymentMode; label: string; Icon: typeof Banknote }[] = [
  { mode: 'mtn_money', label: 'MTN Money', Icon: Smartphone },
  { mode: 'orange_money', label: 'Orange Money', Icon: Smartphone },
];

/** Modes qui nécessitent le widget CamerPay (tous les modes actuels) */
const CAMERPAY_MODES: PaymentMode[] = ['mtn_money', 'orange_money'];

const SWIPE_DELETE_THRESHOLD = 96;
const GAP = 13;

/** Une ligne de panier : glisser vers la gauche pour supprimer (plutôt qu'un
 *  petit bouton ×), avec fondu + collapse de hauteur à la sortie. Le chiffre
 *  de quantité fait un bref « bump » à chaque tap +/-. `dimmed` signale un
 *  plat dont le restaurant est hors zone : visible, mais pas commandable. */
function CartLineRow({ line, dimmed }: { line: CartLine; dimmed?: boolean }) {
  const { colors, cartInc, cartDec, cartRemove } = useApp();
  const { cle, dish, qty, complements, prixUnitaire } = line;

  const translateX = useRef(new Animated.Value(0)).current;
  const collapse = useRef(new Animated.Value(1)).current; // 1 = taille normale, 0 = effondrée
  const qtyBump = useRef(new Animated.Value(1)).current;
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const enSuppression = useRef(false);

  const bumpQty = () => {
    Animated.sequence([
      Animated.spring(qtyBump, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 12 }),
      Animated.spring(qtyBump, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
  };

  const snapBack = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };

  const supprimer = () => {
    if (enSuppression.current) return;
    enSuppression.current = true;
    Animated.parallel([
      Animated.timing(translateX, { toValue: -420, duration: 200, useNativeDriver: true }),
      Animated.timing(collapse, { toValue: 0, duration: 220, useNativeDriver: false }),
    ]).start(() => {
      animateListChange();
      cartRemove(cle);
    });
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => translateX.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_DELETE_THRESHOLD) supprimer();
        else snapBack();
      },
      onPanResponderTerminate: snapBack,
    }),
  ).current;

  const deleteOpacity = translateX.interpolate({
    inputRange: [-SWIPE_DELETE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.lineWrap,
        measuredHeight != null && {
          height: collapse.interpolate({ inputRange: [0, 1], outputRange: [0, measuredHeight] }),
          marginBottom: collapse.interpolate({ inputRange: [0, 1], outputRange: [0, GAP] }),
          opacity: collapse,
        },
      ]}
    >
      <View
        onLayout={e => { if (measuredHeight == null) setMeasuredHeight(e.nativeEvent.layout.height); }}
        style={dimmed && { opacity: 0.5 }}
      >
        {/* Zone de suppression révélée derrière la ligne pendant le glissement */}
        <Animated.View style={[styles.deleteZone, { opacity: deleteOpacity }]}>
          <Trash2 size={20} color="#fff" strokeWidth={2.3} />
        </Animated.View>

        <Animated.View
          {...pan.panHandlers}
          style={[styles.line, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ translateX }] }]}
        >
          <DishTile Icon={dish.icon} grad={dish.grad} image={dish.image} size={64} iconSize={28} radius={16} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[displayFont(14.5, '700'), { color: colors.text }]}>{dish.name}</Text>

            {/* Détail des compléments : le client doit voir ce qu'il
                a choisi et ce que chaque option lui coûte. */}
            {complements.map(c => (
              <View key={c.optionId} style={styles.complementLigne}>
                <Text numberOfLines={1} style={[bodyFont(11.5, '600'), { color: colors.muted, flex: 1 }]}>
                  {c.groupeNom} : {c.optionNom}
                </Text>
                <Text style={[bodyFont(11.5, '700'), { color: c.supplement ? Brand.accentLight : colors.faint }]}>
                  {c.supplement ? `+${formatPrice(c.supplement)}` : 'offert'}
                </Text>
              </View>
            ))}

            <Text style={[displayFont(14, '800'), { color: Brand.accentLight, marginTop: 4 }]}>
              {formatPrice(prixUnitaire)}
            </Text>
            <View style={[styles.stepper, { backgroundColor: colors.surface2 }]}>
              <PressableScale onPress={() => { bumpQty(); animateListChange(); cartDec(cle); }}>
                <View style={[styles.stepBtn, { backgroundColor: colors.surface }]}><Minus size={16} color={colors.text} strokeWidth={2.6} /></View>
              </PressableScale>
              <Animated.Text style={[displayFont(14, '800'), { color: colors.text, minWidth: 20, textAlign: 'center', transform: [{ scale: qtyBump }] }]}>
                {qty}
              </Animated.Text>
              <PressableScale onPress={() => { bumpQty(); cartInc(cle); }}>
                <View style={[styles.stepBtn, { backgroundColor: Brand.accent }]}><Plus size={16} color="#fff" strokeWidth={2.6} /></View>
              </PressableScale>
            </View>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** Un restaurant du panier : ses plats, sa propre distance/frais de livraison
 *  (chaque restaurant a SON barème), et — s'il est hors zone pour l'adresse
 *  choisie — un signalement clair : ses plats restent visibles mais ne
 *  seront PAS commandés (les autres restaurants du panier, eux, le seront). */
function CartGroupSection({ group }: { group: CartGroup }) {
  const { colors } = useApp();
  const { resto, lines, deliveryFee, distanceKm, horsZone } = group;

  return (
    <View style={{ marginTop: 22 }}>
      <View style={styles.groupHeader}>
        <Text numberOfLines={1} style={[displayFont(14.5, '800'), { color: colors.text, flex: 1 }]}>
          {resto?.name ?? 'Restaurant'}
        </Text>
        {horsZone ? (
          <View style={[styles.zoneBadge, { backgroundColor: '#ff6b7022', borderColor: '#ff6b7055' }]}>
            <TriangleAlert size={12} color="#ff6b70" strokeWidth={2.4} />
            <Text style={[bodyFont(11, '700'), { color: '#ff6b70' }]}>Hors zone</Text>
          </View>
        ) : (
          <Text style={[bodyFont(12, '700'), { color: '#8fd6a8' }]}>
            {distanceKm != null ? `${distanceKm.toFixed(1)} km · ` : ''}{formatPrice(deliveryFee)}
          </Text>
        )}
      </View>

      {lines.map(line => <CartLineRow key={line.cle} line={line} dimmed={horsZone} />)}

      {horsZone && (
        <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: -4, marginBottom: 4 }]}>
          Ce restaurant ne livre pas jusqu'à cette adresse — ces plats ne seront pas commandés.
        </Text>
      )}
    </View>
  );
}

export default function PanierScreen() {
  const {
    colors, cartGroups, removeCartForRestaurants,
    subtotal, deliveryFee, deliveryHorsZone, total, cartCount, checkout, reloadOrders, deliveryAddress, user,
  } = useApp();
  // Restaurants réellement payables (hors zone exclue) — c'est CE périmètre
  // que le paiement porte ; les autres restent visibles mais de côté.
  const groupesPayables = cartGroups.filter(g => !g.horsZone);
  const groupesExclus = cartGroups.filter(g => g.horsZone);
  const router = useRouter();
  const toast = useToast();
  // Le compte de démonstration peut remplir un panier, mais pas commander.
  const { bloquer } = useGardeDemo();
  const [mode, setMode] = useState<PaymentMode>('mtn_money');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.telephone || '');

  // ─── Fidélité ─────────────────────────────────────────
  // L'aperçu (et donc la réduction) est TOUJOURS calculé par le serveur :
  // l'app n'applique aucune règle métier de son côté.
  const [fidelite, setFidelite] = useState<FideliteApercuDTO | null>(null);
  const [usePoints, setUsePoints] = useState(false);

  useEffect(() => {
    if (!user || total <= 0) { setFidelite(null); return; }
    let vivant = true;
    fetchFideliteApercu(total)
      .then(res => { if (vivant) setFidelite(res); })
      .catch(() => { if (vivant) setFidelite(null); });
    return () => { vivant = false; };
  }, [user, total]);

  // Rien à convertir → on ne laisse pas la case cochée.
  useEffect(() => {
    if (!fidelite || fidelite.reduction <= 0) setUsePoints(false);
  }, [fidelite]);

  const reduction = usePoints && fidelite ? fidelite.reduction : 0;
  const totalAPayer = Math.max(0, total - reduction);

  // Petit rebond du total quand la réduction s'applique : le changement de
  // montant se remarque, au lieu de passer inaperçu.
  const rebondTotal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!fidelite || fidelite.reduction <= 0) return;
    rebondTotal.setValue(0.88);
    Animated.spring(rebondTotal, {
      toValue: 1, friction: 4, tension: 150, useNativeDriver: true,
    }).start();
  }, [usePoints, rebondTotal, fidelite]);

  // Même rebond sur les frais de livraison : ils changent silencieusement
  // quand une ligne est ajoutée/retirée (le plus élevé du panier l'emporte).
  const rebondLivraison = useRef(new Animated.Value(1)).current;
  const dernierFrais = useRef(deliveryFee);
  useEffect(() => {
    if (dernierFrais.current === deliveryFee) return;
    dernierFrais.current = deliveryFee;
    rebondLivraison.setValue(0.88);
    Animated.spring(rebondLivraison, {
      toValue: 1, friction: 4, tension: 150, useNativeDriver: true,
    }).start();
  }, [deliveryFee, rebondLivraison]);

  // ─── État WebView CamerPay ────────────────────────────
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  // Groupe de commandes créé mais non encore payé (mobile money) — un seul
  // paiement CamerPay pour toutes ses commandes (une par restaurant). Tant
  // qu'il n'est pas confirmé, elles sont invisibles des restaurants et
  // peuvent être relancées ou annulées ENSEMBLE.
  const [pendingGroup, setPendingGroup] = useState<CommandeGroupeDTO | null>(null);

  /** Restaurants effectivement commandés dans `groupe` (ceux exclus — hors
   *  zone, fermés — n'y figurent pas et restent au panier). */
  const restosCommandes = (groupe: CommandeGroupeDTO) =>
    groupe.commandes.map(c => c.restaurant).filter((id): id is number => id != null);

  /** Où envoyer le client une fois le groupe payé : le suivi habituel pour
   *  une seule commande, la liste « Mes commandes » si plusieurs restaurants
   *  ont été commandés en une fois (pas d'écran de suivi multi-livraisons). */
  const routeApresPaiement = (groupe: CommandeGroupeDTO) =>
    groupe.commandes.length > 1 ? '/(client)/profil' : '/tracking';

  /** Le serveur peut exclure un restaurant AU MOMENT de la validation (hors
   *  zone / fermé entre-temps) sans que l'estimation affichée au panier ne
   *  l'ait anticipé — le client doit le savoir, même si la commande des
   *  autres restaurants a réussi. */
  const signalerExclusions = (groupe: CommandeGroupeDTO) => {
    if (!groupe.exclusions.length) return;
    const noms = groupe.exclusions.map(e => e.restaurant_nom).join(', ');
    toast.error(
      groupe.exclusions.length === 1
        ? `${noms} n'a pas pu être commandé : ${groupe.exclusions[0].message}`
        : `Certains restaurants n'ont pas pu être commandés : ${noms}.`,
    );
  };

  /** Lance (ou relance) le widget CamerPay pour un groupe déjà créé. */
  const launchPayment = async (groupeId: number) => {
    setBusy(true); setError(null);
    try {
      const data = await initiateCamerPayPaymentGroupe(groupeId, phone || undefined);
      if (data.payment_url) setPaymentUrl(data.payment_url);
      else setError('Paiement indisponible pour le moment. Réessayez.');
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'initiation du paiement a échoué.");
    } finally {
      setBusy(false);
    }
  };

  /** Supprime le groupe non payé puis réinitialise l'état de paiement. */
  const abandonOrder = async () => {
    const groupe = pendingGroup;
    setPendingGroup(null);
    if (!groupe) return;
    try {
      await cancelOrderGroup(groupe.id);
    } catch {
      // Le groupe non confirmé n'est de toute façon pas visible des restaurants.
    } finally {
      // Rafraîchit la liste (le groupe non payé disparaît) ; le panier est conservé.
      reloadOrders();
    }
  };

  const submit = async () => {
    if (!deliveryAddress) { setError('Veuillez choisir un lieu de livraison.'); return; }
    if (deliveryHorsZone) {
      setError('Aucun restaurant de ce panier ne livre jusqu\'à cette adresse.');
      return;
    }
    setBusy(true); setError(null);
    try {
      // 1. Créer une Commande par restaurant payable (toujours)
      const groupe = await checkout(mode, usePoints);

      if (CAMERPAY_MODES.includes(mode)) {
        // 2. Pour MTN/Orange Money → initier UN SEUL paiement CamerPay pour
        //    tout le groupe. On NE retire RIEN du panier : les commandes
        //    n'existent vraiment qu'une fois payées. Si le paiement est
        //    abandonné, les plats restent au panier.
        setPendingGroup(groupe);
        await launchPayment(groupe.id);
        // Le WebView gère la suite (onSuccess / onCancel)
      } else {
        // Espèces → commandes confirmées tout de suite : on retire du panier
        // uniquement les restaurants effectivement commandés (les exclus —
        // hors zone — y restent) et on suit la livraison.
        removeCartForRestaurants(restosCommandes(groupe));
        signalerExclusions(groupe);
        router.push(routeApresPaiement(groupe));
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
              {/* Un restaurant à la fois : chacun garde son propre frais de
                  livraison (son barème, sa distance à l'adresse choisie). */}
              {cartGroups.map(group => <CartGroupSection key={group.restoId} group={group} />)}

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
              {CAMERPAY_MODES.includes(mode) && (
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


              {/* Réduction fidélité — le montant vient toujours du serveur */}
              {fidelite && fidelite.actif && fidelite.solde > 0 && (
                <PressableScale
                  onPress={fidelite.reduction > 0 ? () => setUsePoints(v => !v) : undefined}
                  scaleTo={0.99}
                  style={{ marginTop: 16 }}
                >
                  <View style={[
                    styles.points,
                    {
                      backgroundColor: colors.surface,
                      borderColor: usePoints ? Brand.yellow : colors.border,
                    },
                  ]}>
                    <View style={[styles.pointsIcon, { backgroundColor: Brand.yellow + '1f' }]}>
                      <Sparkles size={18} color={Brand.yellow} strokeWidth={2.3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[bodyFont(13.5, '800'), { color: colors.text }]}>
                        {fidelite.reduction > 0 ? 'Utiliser mes points' : 'Mes points'}
                      </Text>
                      <Text style={[bodyFont(11.5, '600'), { color: colors.muted, marginTop: 2 }]}>
                        {fidelite.reduction > 0
                          ? `${fidelite.solde} pts · −${formatPrice(fidelite.reduction)} sur cette commande`
                          : `${fidelite.solde} pts · minimum ${fidelite.seuil_minimum} pts pour convertir`}
                      </Text>
                    </View>
                    {fidelite.reduction > 0 && (
                      <View style={[
                        styles.box,
                        usePoints
                          ? { backgroundColor: Brand.yellow, borderColor: Brand.yellow }
                          : { borderColor: colors.border },
                      ]}>
                        {usePoints && <Check size={13} color="#1a1200" strokeWidth={3.2} />}
                      </View>
                    )}
                  </View>
                </PressableScale>
              )}

              <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.sumRow}>
                  <Text style={[bodyFont(14, '500'), { color: colors.muted }]}>Sous-total</Text>
                  <Text style={[bodyFont(14, '700'), { color: colors.text }]}>{formatPrice(subtotal)}</Text>
                </View>

                {/* Un restaurant payable : distance + frais sur une ligne.
                    Plusieurs : détail par restaurant, puis le total livraison. */}
                {groupesPayables.length <= 1 ? (
                  <View style={[styles.sumRow, { marginTop: 10 }]}>
                    <Text style={[bodyFont(14, '500'), { color: colors.muted }]}>
                      Livraison
                      {groupesPayables[0]?.distanceKm != null ? `  ·  ${groupesPayables[0].distanceKm.toFixed(1)} km` : ''}
                    </Text>
                    {deliveryHorsZone ? (
                      <Text style={[bodyFont(14, '700'), { color: '#ff6b70' }]}>Hors zone</Text>
                    ) : (
                      <Animated.Text style={[bodyFont(14, '700'), { color: '#8fd6a8', transform: [{ scale: rebondLivraison }] }]}>
                        {formatPrice(deliveryFee)}
                      </Animated.Text>
                    )}
                  </View>
                ) : (
                  <View style={{ marginTop: 10 }}>
                    {groupesPayables.map(g => (
                      <View key={g.restoId} style={[styles.sumRow, { marginTop: 4 }]}>
                        <Text numberOfLines={1} style={[bodyFont(12.5, '500'), { color: colors.muted, flexShrink: 1 }]}>
                          Livraison · {g.resto?.name ?? 'Restaurant'}
                          {g.distanceKm != null ? ` (${g.distanceKm.toFixed(1)} km)` : ''}
                        </Text>
                        <Text style={[bodyFont(12.5, '700'), { color: '#8fd6a8' }]}>{formatPrice(g.deliveryFee)}</Text>
                      </View>
                    ))}
                    <View style={[styles.sumRow, { marginTop: 8 }]}>
                      <Text style={[bodyFont(14, '500'), { color: colors.muted }]}>Livraison totale</Text>
                      <Animated.Text style={[bodyFont(14, '700'), { color: '#8fd6a8', transform: [{ scale: rebondLivraison }] }]}>
                        {formatPrice(deliveryFee)}
                      </Animated.Text>
                    </View>
                  </View>
                )}

                {deliveryHorsZone && (
                  <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 6 }]}>
                    Aucun restaurant de ce panier ne livre jusqu'à cette adresse. Choisissez un lieu plus proche.
                  </Text>
                )}
                {!deliveryHorsZone && groupesExclus.length > 0 && (
                  <Text style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 6 }]}>
                    {groupesExclus.length === 1
                      ? `${groupesExclus[0].resto?.name ?? 'Un restaurant'} ne livre pas jusqu'à cette adresse : ses plats ne seront pas commandés.`
                      : `${groupesExclus.length} restaurants ne livrent pas jusqu'à cette adresse : leurs plats ne seront pas commandés.`}
                  </Text>
                )}
                {reduction > 0 && (
                  <View style={[styles.sumRow, { marginTop: 10 }]}>
                    <Text style={[bodyFont(14, '500'), { color: colors.muted }]}>
                      Réduction fidélité
                    </Text>
                    <Text style={[bodyFont(14, '700'), { color: Brand.yellow }]}>
                      −{formatPrice(reduction)}
                    </Text>
                  </View>
                )}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.sumRow}>
                  <Text style={[displayFont(18, '800'), { color: colors.text }]}>Total</Text>
                  <Animated.Text
                    style={[
                      displayFont(22, '800'),
                      { color: Brand.accentLight, transform: [{ scale: rebondTotal }] },
                    ]}
                  >
                    {formatPrice(totalAPayer)}
                  </Animated.Text>
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
                ) : deliveryHorsZone ? (
                  <View style={[styles.checkout, { backgroundColor: colors.border, marginTop: 16 }]}>
                    <Text style={[bodyFont(15.5, '800'), { color: colors.muted }]}>Adresse hors zone de livraison</Text>
                  </View>
                ) : (
                  <PressableScale onPress={() => bloquer(submit)} style={{ marginTop: 16 }}>
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

    {/* ─── Modal WebView CamerPay ─────────────────── */}
    {paymentUrl && pendingGroup && (
      <CamerPayWebView
        paymentUrl={paymentUrl}
        groupeId={pendingGroup.id}
        amount={totalAPayer}
        onRetry={() => launchPayment(pendingGroup.id)}
        onSuccess={() => {
          setPaymentUrl(null);
          // Paiement confirmé → ce sont de vraies commandes : on retire du
          // panier les restaurants commandés (les exclus y restent déjà —
          // ils n'ont jamais fait partie de ce groupe).
          removeCartForRestaurants(restosCommandes(pendingGroup));
          signalerExclusions(pendingGroup);
          const destination = routeApresPaiement(pendingGroup);
          setPendingGroup(null);
          reloadOrders();
          router.push(destination);
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
                onPress: () => launchPayment(pendingGroup.id),
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
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  zoneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1,
  },
  lineWrap: { borderRadius: 20, overflow: 'hidden' },
  deleteZone: {
    ...StyleSheet.absoluteFillObject, backgroundColor: Brand.danger,
    alignItems: 'flex-end', justifyContent: 'center', paddingRight: 26,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, borderRadius: 20, borderWidth: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, padding: 4, alignSelf: 'flex-start', marginTop: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  complementLigne: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
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
  points: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1,
  },
  pointsIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center' },
  summary: { padding: 18, borderRadius: 24, borderWidth: 1, marginTop: 16 },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, marginVertical: 14 },
  checkout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radius.pill },
});
