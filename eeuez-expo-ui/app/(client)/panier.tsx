import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PressableScale, ConfettiBurst } from '../../components/Animations';
import { Colors, Typography, Spacing, Radius, glow } from '../../constants/theme';
import { useAppContext, CartItem } from '../../context/AppContext';
import { commandeService } from '../../services/apiService';

function ProcessingModal({ visible, onComplete }: { visible: boolean, onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const STEPS = [
    { emoji: '📡', text: 'Transmission de la commande...' },
    { emoji: '👨‍🍳', text: 'Acceptation par le restaurant...' },
    { emoji: '🔍', text: 'Recherche d\'un livreur à proximité...' },
    { emoji: '✅', text: 'Livreur trouvé ! Préparation du suivi...' }
  ];

  useEffect(() => {
    if (visible) {
      setStep(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        if (currentStep < STEPS.length) {
          setStep(currentStep);
        } else {
          clearInterval(interval);
          setTimeout(onComplete, 800); // Wait a bit on the last success step before completing
        }
      }, 2000); // 2 seconds per step

      return () => clearInterval(interval);
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <Animated.View style={[s.modalOverlay, { opacity: fadeAnim }]}>
        <View style={s.modalBox}>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>{STEPS[step].emoji}</Text>
          <Text style={s.modalText}>{STEPS[step].text}</Text>
          
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressBar, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

export default function PanierScreen() {
  const { cart, removeFromCart, addToCart, clearCart, addActiveOrder } = useAppContext();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const sousTotal = cart.reduce((sum, item) => sum + (item.prix * item.quantite), 0);
  const fraisLivraison = cart.length > 0 ? 500 : 0;
  const total = sousTotal + fraisLivraison;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
  };

  const handleCheckoutComplete = async () => {
    setIsProcessing(false);
    
    if (cart.length === 0) return;

    try {
      const body = {
        restaurant: cart[0].restaurantId,
        adresse_livraison: 'Ma position GPS',
        notes: '',
        items: cart.map(item => ({ plat_id: item.id, quantite: item.quantite }))
      };

      const res = await commandeService.passer(body).catch((err) => {
        console.log("Backend hors-ligne, simulation de commande réussie");
        return {
          id: 'CMD-' + Math.floor(Math.random() * 10000),
          statut: 'en_preparation',
          montant_total: cart.reduce((sum, i) => sum + i.prix * i.quantite, 0) + 500
        };
      });

      const orderData = {
        id: res.id,
        status: res.statut,
        total: res.montant_total,
        items: [...cart],
        date: new Date().toISOString()
      };
      
      addActiveOrder(orderData);
      clearCart();
      
      router.replace({ pathname: '/(client)', params: { screen: 'carte' } });
    } catch (err: any) {
      alert("Erreur lors de la commande : " + err.message);
    }
  };

  const updateQuantite = (item: CartItem, delta: number) => {
    if (item.quantite + delta <= 0) {
      removeFromCart(item.id);
    } else {
      addToCart({ ...item, quantite: delta }); // addToCart will aggregate by id
    }
  };

  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={() => router.back()}>
            <View style={s.backBtn}><Text style={s.backBtnText}>←</Text></View>
          </PressableScale>
          <Text style={s.headerTitle}>Mon Panier</Text>
          <View style={{ width: 44 }} />
        </View>

        {cart.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 60, marginBottom: 20 }}>🛒</Text>
            <Text style={s.emptyTitle}>Votre panier est vide</Text>
            <Text style={s.emptySub}>Ajoutez des plats savoureux pour lancer votre commande.</Text>
            <PressableScale onPress={() => router.back()} style={{ marginTop: 30 }}>
              <View style={s.btnPrimary}><Text style={s.btnPrimaryText}>Découvrir les restaurants</Text></View>
            </PressableScale>
          </View>
        ) : (
          <ScrollView style={s.scrollContent} contentContainerStyle={{ paddingBottom: 120 }}>
            {/* Liste des articles */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Vos articles</Text>
              {cart.map((item) => (
                <View key={item.id} style={s.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName}>{item.nom}</Text>
                    <Text style={s.itemPrice}>{item.prix} FCFA</Text>
                  </View>
                  <View style={s.qtyControls}>
                    <PressableScale onPress={() => updateQuantite(item, -1)}>
                      <View style={s.qtyBtn}><Text style={s.qtyBtnText}>-</Text></View>
                    </PressableScale>
                    <Text style={s.qtyValue}>{item.quantite}</Text>
                    <PressableScale onPress={() => updateQuantite(item, 1)}>
                      <View style={[s.qtyBtn, { backgroundColor: Colors.client.primary }]}>
                        <Text style={[s.qtyBtnText, { color: '#FFF' }]}>+</Text>
                      </View>
                    </PressableScale>
                  </View>
                </View>
              ))}
            </View>

            {/* Détails du paiement */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Résumé</Text>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Sous-total</Text>
                <Text style={s.summaryValue}>{sousTotal} FCFA</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Frais de livraison</Text>
                <Text style={s.summaryValue}>{fraisLivraison} FCFA</Text>
              </View>
              <View style={[s.summaryRow, s.summaryTotalRow]}>
                <Text style={s.summaryTotalLabel}>Total</Text>
                <Text style={s.summaryTotalValue}>{total} FCFA</Text>
              </View>
            </View>
            
            {/* Mode de paiement simulé */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Paiement (Simulé)</Text>
              <View style={s.paymentMethod}>
                <Text style={{ fontSize: 24 }}>📱</Text>
                <View style={{ marginLeft: 12 }}>
                  <Text style={s.itemName}>Mobile Money</Text>
                  <Text style={s.itemPrice}>Payer à la livraison ou via app</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Bouton Valider */}
      {cart.length > 0 && (
        <View style={s.bottomFooter}>
          <PressableScale onPress={handleCheckout} style={{ width: '100%' }}>
            <View style={[s.btnPrimary, glow(Colors.client.primary, 15)]}>
              <Text style={s.btnPrimaryText}>Valider la commande • {total} FCFA</Text>
            </View>
          </PressableScale>
        </View>
      )}

      {/* Modal interactif de traitement de commande */}
      <ProcessingModal visible={isProcessing} onComplete={handleCheckoutComplete} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 24, color: Colors.text.primary },
  headerTitle: { ...Typography.h2, fontSize: 18 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  emptyTitle: { ...Typography.h2, marginBottom: 8 },
  emptySub: { ...Typography.body, color: Colors.text.secondary, textAlign: 'center' },
  scrollContent: { paddingHorizontal: Spacing.md },
  section: { backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border.default },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.md },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border.default },
  itemName: { ...Typography.bodyBold, fontSize: 16 },
  itemPrice: { ...Typography.small, color: Colors.client.primary, marginTop: 4 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.elevated, borderRadius: Radius.full, padding: 4 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: 'bold', color: Colors.text.primary },
  qtyValue: { width: 30, textAlign: 'center', ...Typography.bodyBold },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { ...Typography.body, color: Colors.text.secondary },
  summaryValue: { ...Typography.bodyBold },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: Colors.border.default, marginTop: 8, paddingTop: 12 },
  summaryTotalLabel: { ...Typography.h3 },
  summaryTotalValue: { ...Typography.h2, color: Colors.client.primary },
  paymentMethod: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.elevated, padding: Spacing.md, borderRadius: Radius.md },
  bottomFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, paddingBottom: 110, backgroundColor: Colors.bg.surface, borderTopWidth: 1, borderTopColor: Colors.border.default },
  btnPrimary: { backgroundColor: Colors.client.primary, paddingVertical: 16, borderRadius: Radius.lg, alignItems: 'center' },
  btnPrimaryText: { ...Typography.bodyBold, color: '#FFF', fontSize: 16 },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalBox: { backgroundColor: Colors.bg.surface, width: '100%', borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.client.primary + '55' },
  modalText: { ...Typography.h3, textAlign: 'center', marginBottom: 30 },
  progressTrack: { width: '100%', height: 6, backgroundColor: Colors.bg.elevated, borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: Colors.client.primary },
});
