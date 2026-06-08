import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ScrollView, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { Typography, Radius, Spacing, shadow } from '../../constants/theme';
import { ChevronLeft, ShoppingBag, Plus, Minus } from 'lucide-react-native';
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

            {/* Background Blob Stylisé (Plus grand et plus arrondi) */}
            <View style={[s.blobBackground, { backgroundColor: colors.primary }]} />

            <SafeAreaView style={{ flex: 1 }}>
                {/* Header Icons Area */}
                <View style={s.headerIcons}>
                    <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
                        <ChevronLeft size={24} color="#000" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/(client)/cart')} style={s.iconBtn}>
                        <ShoppingBag size={24} color="#A67C52" />
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
                        <View style={s.nextPeek}>
                            <Image
                                source={{ uri: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=400&q=80' }}
                                style={s.peekImage}
                                resizeMode="contain"
                            />
                        </View>
                    </View>

                    {/* LA CARTE FLOTTANTE (REPRODUITE À 100%) */}
                    <View style={[s.detailCard, shadow.medium]}>
                        {/* Code */}
                        <Text style={s.cardCode}>#{plat.id.slice(0, 4).toUpperCase()} CODE</Text>

                        {/* Title (Orange/Peach) */}
                        <Text style={s.cardTitle}>Cheese Burger</Text>

                        {/* Price & Delivery Row */}
                        <View style={s.cardPriceRow}>
                            <Text style={s.cardPrice}>$10.00</Text>
                            <Text style={s.cardDelivery}>15 min Delivery</Text>
                        </View>

                        {/* Selector Stylisé */}
                        <View style={s.cardSelector}>
                            <TouchableOpacity onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                                <View style={[s.qtyBox, { borderColor: '#FDEEE0' }]}>
                                    <Minus size={22} color="#FDCAB0" />
                                </View>
                            </TouchableOpacity>

                            <Text style={s.qtyText}>{quantity}</Text>

                            <TouchableOpacity onPress={() => setQuantity(quantity + 1)}>
                                <View style={[s.qtyBox, { borderColor: '#FDEEE0' }]}>
                                    <Plus size={22} color="#FDCAB0" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Add Button */}
                        <PressableScale onPress={handleAddToCart} style={s.cardBtn}>
                            <View style={[s.cardBtnInner, { backgroundColor: '#FFA726' }]}>
                                <Text style={s.cardBtnText}>Add to Cart</Text>
                            </View>
                        </PressableScale>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    blobBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: height * 0.48,
        borderTopLeftRadius: 50,
        transform: [{ scaleY: 1.1 }],
    },
    headerIcons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    iconBtn: { padding: 5 },
    badge: { position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
    scrollContent: { paddingBottom: 40 },
    titleSection: { paddingHorizontal: 25, marginTop: 10 },
    mainTitle: { fontSize: 28, fontWeight: '900', color: '#111' },
    tabsContainer: { flexDirection: 'row', marginTop: 20, alignItems: 'center' },
    activeTabBg: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#FFF0E6',
        marginRight: 20,
        alignItems: 'center',
    },
    tabText: { fontSize: 15 },
    tabIndicator: { width: 15, height: 3, borderRadius: 2, marginTop: 5 },
    inactiveTab: { paddingHorizontal: 15 },
    carouselWrapper: { height: height * 0.38, marginTop: 10, flexDirection: 'row', alignItems: 'center' },
    mainImage: { width: width * 0.8, height: '100%', marginLeft: width * 0.1 },
    nextPeek: { position: 'absolute', right: -width * 0.1, width: width * 0.3, height: '60%', opacity: 0.6 },
    peekImage: { width: '100%', height: '100%' },
    detailCard: {
        backgroundColor: '#FFF',
        marginHorizontal: 50,
        borderRadius: 35,
        padding: 25,
        alignItems: 'center',
        marginTop: -20,
    },
    cardCode: { fontSize: 13, fontWeight: '700', color: '#BDBDBD', marginBottom: 5 },
    cardTitle: { fontSize: 20, fontWeight: '700', color: '#FBC02D', marginBottom: 12 },
    cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 25 },
    cardPrice: { fontSize: 18, fontWeight: '900', color: '#212121' },
    cardDelivery: { fontSize: 12, color: '#9E9E9E', fontWeight: '600' },
    cardSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 35,
        marginBottom: 30,
    },
    qtyBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center'
    },
    qtyText: { fontSize: 22, fontWeight: '900', color: '#424242' },
    cardBtn: { width: '100%' },
    cardBtnInner: { height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    cardBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
