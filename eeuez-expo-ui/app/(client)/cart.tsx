import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow } from '../../constants/theme';
import { PressableScale } from '../../components/Animations';

// ─── DONNÉES MOCK PANIER ───────────────────────────────────────────────────
const MOCK_PANIER = [
  { id: 'p1', nom: 'Poulet DG', prix: 4500, qty: 1, emoji: '🍗', restaurant: "Le Phénix d'Or" },
  { id: 'p2', nom: 'Ndolé',     prix: 3500, qty: 2, emoji: '🥘', restaurant: "Le Phénix d'Or" },
  { id: 'p6', nom: 'Jus de bissap', prix: 800, qty: 1, emoji: '🍹', restaurant: "Le Phénix d'Or" },
];
const FRAIS_LIVRAISON = 500;
import { useAppContext } from '../../context/AppContext';
import { commandeService } from '../../services/apiService';

export default function CartScreen() {
  const router = useRouter();
  const { cart, addToCart, removeFromCart, setActiveOrder, clearCart } = useAppContext();

  const increase = (id: string) => {
    const item = cart.find(i => i.id === id);
    if(item) addToCart({ ...item, quantite: 1 });
  };
  const decrease = (id: string) => {
    const item = cart.find(i => i.id === id);
    if (item && item.quantite > 1) {
       addToCart({ ...item, quantite: -1 });
    } else if (item) {
       removeFromCart(id);
    }
  };
  const remove = (id: string) => removeFromCart(id);

  const sousTotal = cart.reduce((acc, i) => acc + i.prix * i.quantite, 0);
  const total = sousTotal + (cart.length > 0 ? FRAIS_LIVRAISON : 0);

  const [isLoading, setIsLoading] = React.useState(false);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsLoading(true);
    
    try {
      // Assuming all items belong to the same restaurant
      const restaurantId = cart[0].restaurantId || 1; // Fallback to 1 if not set in mocks
      
      const payload = {
        restaurant: parseInt(restaurantId.toString().replace('r', '')),
        items: cart.map(i => ({ 
          plat_id: parseInt(i.id.toString().replace('p', '')), 
          quantite: i.quantite 
        }))
      };
      
      const response: any = await commandeService.passer(payload);
      
      setActiveOrder({
        id: response.id || `CMD-${Math.floor(Math.random() * 10000)}`,
        status: 'en_attente',
        total: total,
        items: cart,
        date: new Date().toISOString()
      });
      clearCart();
      router.push(`/(client)/suivi?order_id=${response.id}` as any); // Navigate to our new tracking page
    } catch (error) {
      console.error("Erreur de commande:", error);
      alert("Impossible de passer la commande. Vérifiez que vous êtes connecté.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <PressableScale onPress={() => router.back()}>
            <View style={s.backBtn}>
              <Text style={s.backArrow}>←</Text>
            </View>
          </PressableScale>
          <Text style={s.title}>🛒 Mon Panier</Text>
          <View style={{ width: 44 }} />
        </View>

        {cart.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={{ fontSize: 72 }}>🛒</Text>
            <Text style={s.emptyTitle}>Panier vide</Text>
            <Text style={s.emptySubtitle}>Ajoutez des plats depuis l'accueil</Text>
            <PressableScale onPress={() => router.push('/(client)')}>
              <View style={[s.shopBtn, glow(Colors.client.glow, 10)]}>
                <Text style={s.shopBtnText}>🏠 Retour à l'accueil</Text>
              </View>
            </PressableScale>
          </View>
        ) : (
          <>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.md }}>
              {/* Groupement restaurant */}
              <View style={s.restaurantBadge}>
                <Text style={s.restaurantBadgeText}>🏪 Restaurant</Text>
              </View>

              {cart.map(item => (
                <View key={item.id} style={s.cartItem}>
                  <View style={s.emojiBox}>
                    <Text style={{ fontSize: 32 }}>🍽️</Text>
                  </View>
                  <View style={s.itemInfo}>
                    <Text style={s.itemNom}>{item.nom}</Text>
                    <Text style={s.itemPrix}>{(item.prix * item.quantite).toLocaleString()} FCFA</Text>
                  </View>
                  <View style={s.qtyRow}>
                    <PressableScale onPress={() => decrease(item.id)}>
                      <View style={s.qtyBtn}><Text style={s.qtyBtnText}>−</Text></View>
                    </PressableScale>
                    <Text style={s.qtyText}>{item.quantite}</Text>
                    <PressableScale onPress={() => increase(item.id)}>
                      <View style={[s.qtyBtn, { backgroundColor: Colors.client.bg, borderColor: Colors.client.primary }]}>
                        <Text style={[s.qtyBtnText, { color: Colors.client.primary }]}>+</Text>
                      </View>
                    </PressableScale>
                    <PressableScale onPress={() => remove(item.id)}>
                      <View style={s.deleteBtn}><Text style={{ fontSize: 16 }}>🗑️</Text></View>
                    </PressableScale>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Footer récapitulatif */}
            <View style={s.footer}>
              <View style={s.footerRow}>
                <Text style={s.footerLabel}>Sous-total</Text>
                <Text style={s.footerVal}>{sousTotal.toLocaleString()} FCFA</Text>
              </View>
              <View style={s.footerRow}>
                <Text style={s.footerLabel}>🛵 Livraison</Text>
                <Text style={[s.footerVal, { color: Colors.livreur.primary }]}>{FRAIS_LIVRAISON.toLocaleString()} FCFA</Text>
              </View>
              <View style={[s.footerRow, s.totalRow]}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={[s.totalVal, { color: Colors.client.primary }]}>{total.toLocaleString()} FCFA</Text>
              </View>
              <PressableScale onPress={handleCheckout} disabled={isLoading}>
                <View style={[s.checkoutBtn, glow(Colors.client.glow, 12), isLoading && { opacity: 0.6 }]}>
                  <Text style={s.checkoutText}>{isLoading ? '⏳ Traitement...' : '✓ Commander maintenant'}</Text>
                </View>
              </PressableScale>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:         { flex: 1, backgroundColor: Colors.bg.app },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  backBtn:           { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.glass.bg, justifyContent: 'center', alignItems: 'center' },
  backArrow:         { fontSize: 22, color: Colors.text.primary },
  title:             { ...Typography.h3, fontSize: 20 },
  restaurantBadge:   { marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.sm, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.client.bg, borderRadius: Radius.md, alignSelf: 'flex-start' },
  restaurantBadgeText: { ...Typography.small, color: Colors.client.primary, fontWeight: '700' },
  cartItem:          { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.md, marginBottom: 12, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border.default, gap: 12 },
  emojiBox:          { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  itemInfo:          { flex: 1, gap: 4 },
  itemNom:           { ...Typography.bodyBold, fontSize: 15 },
  itemPrix:          { ...Typography.small, color: Colors.client.primary, fontWeight: '700' },
  qtyRow:            { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn:            { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: Colors.border.default, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg.elevated },
  qtyBtnText:        { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  qtyText:           { ...Typography.bodyBold, minWidth: 20, textAlign: 'center' },
  deleteBtn:         { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  footer:            { backgroundColor: Colors.bg.surface, borderTopWidth: 1, borderTopColor: Colors.border.default, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.lg, paddingBottom: 20, gap: 8 },
  footerRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel:       { ...Typography.small },
  footerVal:         { ...Typography.bodyBold },
  totalRow:          { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.default },
  totalLabel:        { ...Typography.h3 },
  totalVal:          { fontSize: 22, fontWeight: '900', color: Colors.client.primary },
  checkoutBtn:       { marginTop: 14, backgroundColor: Colors.client.primary, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  checkoutText:      { color: Colors.bg.app, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  emptyContainer:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: Spacing.xl },
  emptyTitle:        { ...Typography.h2 },
  emptySubtitle:     { ...Typography.body, textAlign: 'center' },
  shopBtn:           { backgroundColor: Colors.client.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: Radius.xl, marginTop: 8 },
  shopBtnText:       { color: Colors.bg.app, fontWeight: '800', fontSize: 16 },
});
