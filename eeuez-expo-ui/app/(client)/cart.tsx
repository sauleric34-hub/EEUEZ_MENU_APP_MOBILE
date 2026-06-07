import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { Typography, Spacing, Radius, glow } from '../../constants/theme';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function CartScreen() {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const { items, increaseQty, decreaseQty, removeItem, total } = useCart();
    const router = useRouter();

    const delivery = items.length > 0 ? 800 : 0;
    const finalTotal = total + delivery;

    return (
        <View style={[s.container, { backgroundColor: colors.bg.app }]}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }}>
                <View style={[s.header, { marginTop: 35 }]}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                        <ChevronLeft size={28} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={[s.title, { color: colors.text.primary }]}>{t('panier')}</Text>
                    <View style={{ width: 44 }} />
                </View>

                {items.length === 0 ? (
                    <View style={s.emptyContainer}>
                        <ShoppingBag size={100} color={colors.border.default} />
                        <Text style={[s.emptyText, { color: colors.text.muted }]}>Votre panier est vide</Text>
                        <TouchableOpacity onPress={() => router.push('/(client)')} style={[s.shopBtn, { backgroundColor: colors.primary }]}>
                            <Text style={{ color: '#FFF', fontWeight: '700' }}>Retourner à l'accueil</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 260 }}>
                            {items.map(item => (
                                <View key={item.id} style={[s.cartItem, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                                    <Image source={{ uri: item.image }} style={s.itemImg} />
                                    <View style={s.itemInfo}>
                                        <Text style={[s.itemNom, { color: colors.text.primary }]}>{item.nom}</Text>
                                        <Text style={[s.itemPrix, { color: colors.primary }]}>{item.prix.toLocaleString()} F</Text>
                                        <View style={s.qtyRow}>
                                            <TouchableOpacity
                                                onPress={() => decreaseQty(item.id)}
                                                style={[s.qtyBtn, { borderColor: colors.border.default }]}>
                                                <Minus size={16} color={colors.text.secondary} />
                                            </TouchableOpacity>
                                            <Text style={[s.qtyText, { color: colors.text.primary }]}>{item.qty}</Text>
                                            <TouchableOpacity
                                                onPress={() => increaseQty(item.id)}
                                                style={[s.qtyBtn, { borderColor: colors.primary }]}>
                                                <Plus size={16} color={colors.primary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => removeItem(item.id)} style={s.deleteBtn}>
                                        <Trash2 size={20} color={colors.danger} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={[s.footer, { backgroundColor: colors.bg.surface, borderTopColor: colors.border.subtle, bottom: 110 }]}>
                            <View style={s.footerRow}>
                                <Text style={{ color: colors.text.secondary }}>Sous-total</Text>
                                <Text style={[s.footerVal, { color: colors.text.primary }]}>{total.toLocaleString()} F</Text>
                            </View>
                            <View style={s.footerRow}>
                                <Text style={{ color: colors.text.secondary }}>Frais de livraison</Text>
                                <Text style={[s.footerVal, { color: colors.success }]}>{delivery.toLocaleString()} F</Text>
                            </View>
                            <View style={[s.totalRow, { marginTop: 10 }]}>
                                <Text style={[s.totalLabel, { color: colors.text.primary }]}>{t('total')}</Text>
                                <Text style={[s.totalVal, { color: colors.primary }]}>{finalTotal.toLocaleString()} F</Text>
                            </View>

                            <TouchableOpacity onPress={() => router.push('/(client)/map')} style={[s.checkoutBtn, { backgroundColor: colors.primary }, glow(colors.primary, 15)]}>
                                <Text style={s.checkoutText}>{t('commander')}</Text>
                                <ArrowRight size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    title: { ...Typography.h3, fontSize: 20 },
    cartItem: { flexDirection: 'row', padding: 12, borderRadius: Radius.xl, borderWidth: 1, marginBottom: 15 },
    itemImg: { width: 90, height: 90, borderRadius: Radius.lg },
    itemInfo: { flex: 1, marginLeft: 15, gap: 4 },
    itemNom: { fontWeight: '700', fontSize: 16 },
    itemPrix: { fontWeight: '800', fontSize: 15 },
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 8 },
    qtyBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    qtyText: { fontWeight: '700', fontSize: 14 },
    deleteBtn: { padding: 5 },
    footer: { position: 'absolute', left: 0, right: 0, padding: Spacing.lg, borderTopWidth: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    footerVal: { fontWeight: '700' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { fontSize: 18, fontWeight: '900' },
    totalVal: { fontSize: 22, fontWeight: '900' },
    checkoutBtn: { height: 50, borderRadius: Radius.xl, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 15 },
    checkoutText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
    emptyText: { fontSize: 18, fontWeight: '600' },
    shopBtn: { paddingVertical: 12, paddingHorizontal: 25, borderRadius: Radius.lg, marginTop: 10 },
});
