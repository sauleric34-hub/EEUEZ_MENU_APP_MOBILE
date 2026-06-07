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

const DEFAULT_PRODUCT: any = {
    id: 'default',
    nom: 'Cheese Burger',
    prix: 10.00,
    tempsPreparation: 15,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
};

export default function ProductDetailScreen() {
    const { id } = useLocalSearchParams();
    const { colors } = useTheme();
    const { addItem, items } = useCart();
    const router = useRouter();
    const [quantity, setQuantity] = useState(2);

    const allPlats = MOCK_RESTAURANT_USER.menu.flatMap(cat => cat.plats);
    const plat: any = allPlats.find(p => p.id === id) || DEFAULT_PRODUCT;

    const handleAddToCart = () => {
        const itemToAdd = {
            ...plat,
            description: plat.description || 'Délicieux repas par défaut',
            image: plat.image || DEFAULT_PRODUCT.image
        };
        for (let i = 0; i < quantity; i++) {
            addItem(itemToAdd);
        }
        router.back();
    };

    const totalCartQuantity = items.reduce((sum, item) => sum + (item.quantity as number || 0), 0);

    return (
        <View style={s.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            {/* Blob Background Stylisé */}
            <View style={[s.blobBackground, { backgroundColor: colors.primary }]} />

            <SafeAreaView style={{ flex: 1 }}>
                {/* Header Icons Area */}
                <View style={s.headerIcons}>
                    <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
                        <ChevronLeft size={22} color="#000" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/(client)/cart')} style={s.iconBtn}>
                        <ShoppingBag size={22} color="#A67C52" />
                        {totalCartQuantity > 0 && (
                            <View style={[s.badge, { backgroundColor: colors.primary }]}>
                                <Text style={s.badgeText}>{totalCartQuantity}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
                    {/* Title and Tabs Section */}
                    <View style={s.titleSection}>
                        <Text style={s.mainTitle}>Order Details 🍔</Text>

                        <View style={s.tabsContainer}>
                            <View style={[s.activeTabBg, { backgroundColor: '#FFD60022' }]}>
                                <Text style={[s.tabText, { color: '#000', fontWeight: '800' }]}>Active Orders</Text>
                                <View style={[s.tabIndicator, { backgroundColor: colors.primary }]} />
                            </View>
                            <TouchableOpacity style={s.inactiveTab}>
                                <Text style={[s.tabText, { color: '#999' }]}>Past Orders</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Product Carousel Area */}
                    <View style={s.carouselWrapper}>
                        <Image source={{ uri: plat.image }} style={s.mainImage} resizeMode="contain" />
                        {/* Peek of the next item */}
                        <View style={s.nextPeek}>
                            <Image
                                source={{ uri: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=400&q=80' }}
                                style={s.peekImage}
                                resizeMode="contain"
                            />
                        </View>
                    </View>

                    {/* Product Detail Floating Card */}
                    <View style={[s.floatingCard, shadow.medium]}>
                        <Text style={s.codeText}>#{plat.id.slice(0, 4).toUpperCase()} CODE</Text>
                        <Text style={[s.productTitle, { color: colors.primary }]}>{plat.nom}</Text>

                        <View style={s.infoRow}>
                            <Text style={s.priceText}>
                                {plat.id === 'default' ? '$10.00' : `${plat.prix.toLocaleString()} FCFA`}
                            </Text>
                            <Text style={s.deliveryText}>{plat.tempsPreparation || 15} min Delivery</Text>
                        </View>

                        <View style={s.quantitySelector}>
                            <TouchableOpacity
                                style={s.qtyActionBtn}
                                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                            >
                                <View style={[s.qtyActionBox, { borderColor: '#F0F0F0' }]}>
                                    <Minus size={24} color="#DDD" />
                                </View>
                            </TouchableOpacity>

                            <Text style={s.qtyValue}>{quantity}</Text>

                            <TouchableOpacity
                                style={s.qtyActionBtn}
                                onPress={() => setQuantity(quantity + 1)}
                            >
                                <View style={[s.qtyActionBox, { borderColor: '#F0F0F0' }]}>
                                    <Plus size={24} color="#DDD" />
                                </View>
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
    container: { flex: 1, backgroundColor: '#F9F9F9' },
    blobBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: height * 0.52,
        borderTopLeftRadius: 60,
        transform: [{ scaleY: 1.1 }],
    },
    headerIcons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 25,
        paddingTop: 15,
    },
    iconBtn: { padding: 5 },
    badge: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFF' },
    badgeText: { color: '#FFF', fontSize: 8, fontWeight: '900', textAlign: 'center' },
    scrollContent: { paddingBottom: 40 },
    titleSection: { paddingHorizontal: 25, marginTop: 15 },
    mainTitle: { fontSize: 32, fontWeight: '900', color: '#111' },
    tabsContainer: { flexDirection: 'row', marginTop: 30, alignItems: 'center' },
    activeTabBg: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 15,
        marginRight: 20,
        alignItems: 'center',
    },
    tabText: { fontSize: 16 },
    tabIndicator: { width: 18, height: 4, borderRadius: 2, marginTop: 5 },
    inactiveTab: { paddingHorizontal: 15 },
    carouselWrapper: { height: height * 0.45, marginTop: 20, flexDirection: 'row', alignItems: 'center' },
    mainImage: { width: width * 0.85, height: '100%', marginLeft: width * 0.05 },
    nextPeek: { position: 'absolute', right: -width * 0.1, width: width * 0.3, height: '70%', opacity: 0.8 },
    peekImage: { width: '100%', height: '100%' },
    floatingCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 35,
        borderRadius: 35,
        padding: 25,
        alignItems: 'center',
        marginTop: -30,
    },
    codeText: { fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 5, letterSpacing: 0.5 },
    productTitle: { fontSize: 24, fontWeight: '800', marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 25 },
    priceText: { fontSize: 22, fontWeight: '900', color: '#111' },
    deliveryText: { fontSize: 13, color: '#AAA', fontWeight: '600' },
    quantitySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 30,
    },
    qtyActionBox: {
        width: 50,
        height: 50,
        borderRadius: 12,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center'
    },
    qtyValue: { fontSize: 24, fontWeight: '900', color: '#444' },
    qtyActionBtn: { padding: 5 },
    addBtn: { width: '100%' },
    addBtnInner: { height: 65, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    addBtnText: { color: '#FFF', fontSize: 20, fontWeight: '800' },
});
