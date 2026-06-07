import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ScrollView, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { Typography, Radius, Spacing, shadow } from '../../constants/theme';
import { ChevronLeft, ShoppingBag, Plus, Minus, Clock } from 'lucide-react-native';
import { MOCK_RESTAURANT_USER } from '../../data/mockData';
import { PressableScale } from '../../components/Animations';

const { width, height } = Dimensions.get('window');

// Données par défaut si le produit n'est pas trouvé (Mode Dégradé)
const DEFAULT_PRODUCT: any = {
    id: 'default',
    nom: 'Repas Spécial MENU',
    prix: 3500,
    tempsPreparation: 20,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
};

export default function ProductDetailScreen() {
    const { id } = useLocalSearchParams();
    const { colors } = useTheme();
    const { addItem, items } = useCart();
    const router = useRouter();
    const [quantity, setQuantity] = useState(1);

    // Trouver le produit ou utiliser le fallback
    const allPlats = MOCK_RESTAURANT_USER.menu.flatMap(cat => cat.plats);
    const plat: any = allPlats.find(p => p.id === id) || DEFAULT_PRODUCT;

    const handleAddToCart = () => {
        // Si c'est un produit réel du mockData, il a le bon type. Sinon on simule.
        const itemToAdd = {
            ...plat,
            description: plat.description || 'Délicieux repas par défaut',
            image: plat.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80'
        };

        for (let i = 0; i < quantity; i++) {
            addItem(itemToAdd);
        }
        router.back();
    };

    const totalCartQuantity = items.reduce((sum, item) => sum + (item.quantity as number || 0), 0);

    return (
        <View style={[s.container, { backgroundColor: '#FCF9F2' }]}>
            <StatusBar barStyle="dark-content" />

            {/* Background Slant (Diagonale Orange) */}
            <View style={[s.slantBackground, { backgroundColor: colors.primary }]} />

            <SafeAreaView style={{ flex: 1 }}>
                <View style={s.header}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                        <ChevronLeft size={24} color="#000" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/(client)/cart')} style={s.cartBtn}>
                        <ShoppingBag size={24} color="#000" />
                        {totalCartQuantity > 0 && (
                            <View style={[s.badge, { backgroundColor: colors.primary }]}>
                                <Text style={s.badgeText}>{totalCartQuantity}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
                    <View style={s.titleSection}>
                        <Text style={s.mainTitle}>Order Details 🍔</Text>
                        <View style={s.tabs}>
                            <TouchableOpacity style={s.activeTab}>
                                <Text style={[s.tabText, { color: '#000' }]}>Active Orders</Text>
                                <View style={[s.tabUnderline, { backgroundColor: colors.primary }]} />
                            </TouchableOpacity>
                            <TouchableOpacity style={s.inactiveTab}>
                                <Text style={[s.tabText, { color: colors.text.muted }]}>Past Orders</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={s.imageContainer}>
                        <Image
                            source={{ uri: plat.image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80' }}
                            style={s.productImage}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Product Detail Card */}
                    <View style={[s.card, shadow.medium]}>
                        <Text style={s.productCode}>#{plat.id.toUpperCase()} CODE</Text>
                        <Text style={[s.productName, { color: colors.primary }]}>{plat.nom}</Text>

                        <View style={s.priceRow}>
                            <Text style={s.price}>{plat.prix.toLocaleString()} FCFA</Text>
                            <View style={s.deliveryInfo}>
                                <Clock size={14} color={colors.text.muted} />
                                <Text style={s.deliveryText}>{plat.tempsPreparation || 15} min Delivery</Text>
                            </View>
                        </View>

                        <View style={s.quantitySelector}>
                            <TouchableOpacity
                                style={[s.qtyBtn, { borderColor: '#EEE' }]}
                                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                            >
                                <Minus size={20} color={colors.text.muted} />
                            </TouchableOpacity>

                            <Text style={s.qtyValue}>{quantity}</Text>

                            <TouchableOpacity
                                style={[s.qtyBtn, { borderColor: '#EEE' }]}
                                onPress={() => setQuantity(quantity + 1)}
                            >
                                <Plus size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>

                        <PressableScale onPress={handleAddToCart} style={s.addBtn}>
                            <View style={[s.addBtnInner, { backgroundColor: colors.primary }]}>
                                <Text style={s.addBtnText}>Add to Cart</Text>
                            </View>
                        </PressableScale>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    slantBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: height * 0.55,
        borderTopLeftRadius: 100,
        transform: [{ scaleX: 1.5 }, { rotate: '-5deg' }, { translateY: 50 }],
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingTop: 10,
        zIndex: 10,
    },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', ...shadow.small },
    cartBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', ...shadow.small },
    badge: { position: 'absolute', top: -5, right: -5, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
    scrollContent: { paddingBottom: 50 },
    titleSection: { paddingHorizontal: Spacing.xl, marginTop: 20 },
    mainTitle: { fontSize: 28, fontWeight: '800', color: '#000' },
    tabs: { flexDirection: 'row', marginTop: 25, gap: 30 },
    activeTab: { paddingBottom: 10 },
    inactiveTab: { paddingBottom: 10 },
    tabText: { fontSize: 16, fontWeight: '600' },
    tabUnderline: { position: 'absolute', bottom: 0, left: 0, width: 20, height: 4, borderRadius: 2 },
    imageContainer: { height: height * 0.45, justifyContent: 'center', alignItems: 'center' },
    productImage: { width: width * 0.85, height: '100%' },
    card: {
        backgroundColor: '#FFF',
        marginHorizontal: Spacing.xl,
        borderRadius: Radius.xl,
        padding: 25,
        alignItems: 'center',
        marginTop: -80,
    },
    productCode: { fontSize: 12, fontWeight: '700', color: '#999', marginBottom: 5 },
    productName: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
    price: { fontSize: 20, fontWeight: '900', color: '#000' },
    deliveryInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    deliveryText: { fontSize: 12, color: '#999', fontWeight: '600' },
    quantitySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 25,
        borderWidth: 1,
        borderColor: '#F5F5F5',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: Radius.lg,
        marginBottom: 25,
    },
    qtyBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    qtyValue: { fontSize: 20, fontWeight: '800' },
    addBtn: { width: '100%' },
    addBtnInner: { height: 60, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center' },
    addBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
