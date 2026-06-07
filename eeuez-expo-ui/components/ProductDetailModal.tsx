import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Modal,
    Animated, Dimensions, TouchableOpacity,
    ScrollView,
} from 'react-native';
import { X, Heart, Plus, Minus, ShoppingBag } from 'lucide-react-native';
import { Typography, Radius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { PressableScale } from './Animations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ProductDetailModalProps {
    visible: boolean;
    onClose: () => void;
    product: {
        id: string;
        nom: string;
        prix: number;
        description: string;
        image: any;
    } | null;
    onAddToCart?: (product: any) => void;
}

export default function ProductDetailModal({ visible, onClose, product, onAddToCart }: ProductDetailModalProps) {
    const { colors, isDark } = useTheme();

    // Animations
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const contentFade = useRef(new Animated.Value(0)).current;

    // Exploded View Animations
    const layer1 = useRef(new Animated.Value(0)).current; // Top bun
    const layer2 = useRef(new Animated.Value(0)).current; // Onions/Lettuce
    const layer3 = useRef(new Animated.Value(0)).current; // Meat
    const layer4 = useRef(new Animated.Value(0)).current; // Cheese
    const layer5 = useRef(new Animated.Value(0)).current; // Bottom bun

    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
                Animated.parallel([
                    Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }),
                    Animated.stagger(100, [
                        Animated.spring(layer1, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
                        Animated.spring(layer2, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
                        Animated.spring(layer3, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
                        Animated.spring(layer4, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
                        Animated.spring(layer5, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
                    ])
                ])
            ]).start();
        } else {
            slideAnim.setValue(SCREEN_HEIGHT);
            contentFade.setValue(0);
            layer1.setValue(0);
            layer2.setValue(0);
            layer3.setValue(0);
            layer4.setValue(0);
            layer5.setValue(0);
        }
    }, [visible]);

    if (!product) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)' }]} />

                <Animated.View style={[
                    styles.content,
                    {
                        backgroundColor: colors.bg.app,
                        transform: [{ translateY: slideAnim }]
                    }
                ]}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={[styles.circleBtn, { backgroundColor: colors.bg.surface }]}>
                            <X size={20} color={colors.text.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.circleBtn, { backgroundColor: colors.bg.surface }]}>
                            <Heart size={20} color={colors.danger} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        <Animated.View style={{ opacity: contentFade, paddingHorizontal: 24, marginTop: 20 }}>
                            <Text style={[styles.title, { color: colors.text.primary }]}>{product.nom.toUpperCase()}</Text>
                            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>Customize with delicious topping</Text>
                        </Animated.View>

                        <View style={styles.explodedContainer}>
                            <Animated.View style={[styles.burgerLayer, { transform: [{ translateY: layer1.interpolate({ inputRange: [0, 1], outputRange: [0, -80] }) }] }]}>
                                <View style={[styles.layerDisc, { backgroundColor: '#E29E4B', width: 140, height: 40, borderRadius: 20 }]} />
                            </Animated.View>
                            <Animated.View style={[styles.burgerLayer, { transform: [{ translateY: layer2.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }] }]}>
                                <View style={[styles.layerDisc, { backgroundColor: '#6BAE3A', width: 150, height: 10, borderRadius: 5 }]} />
                            </Animated.View>
                            <Animated.View style={[styles.burgerLayer, { transform: [{ translateY: layer3.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }) }] }]}>
                                <View style={[styles.layerDisc, { backgroundColor: '#8B4513', width: 160, height: 30, borderRadius: 10 }]} />
                            </Animated.View>
                            <Animated.View style={[styles.burgerLayer, { transform: [{ translateY: layer4.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) }] }]}>
                                <View style={[styles.layerDisc, { backgroundColor: '#FFD700', width: 155, height: 5, borderRadius: 2 }]} />
                            </Animated.View>
                            <Animated.View style={[styles.burgerLayer, { transform: [{ translateY: layer5.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }) }] }]}>
                                <View style={[styles.layerDisc, { backgroundColor: '#E29E4B', width: 140, height: 35, borderRadius: 10 }]} />
                            </Animated.View>

                            <View style={styles.floatingIngredients}>
                                <View style={[styles.miniIng, { top: -20, left: -40, backgroundColor: '#FFF', width: 20, height: 20 }]} />
                                <View style={[styles.miniIng, { top: 60, right: -50, backgroundColor: '#FFF', width: 30, height: 30 }]} />
                            </View>
                        </View>

                        <Animated.View style={{ opacity: contentFade, paddingHorizontal: 24, marginTop: 40 }}>
                            <Text style={[styles.price, { color: colors.primary }]}>{product.prix.toLocaleString()} F</Text>
                            <Text style={[styles.description, { color: colors.text.secondary }]}>
                                {product.description || "A classic favorite done right."}
                            </Text>

                            <View style={styles.customRow}>
                                <View style={styles.quantityContainer}>
                                    <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}>
                                        <Minus size={16} color={colors.text.primary} />
                                    </TouchableOpacity>
                                    <Text style={[styles.qtyText, { color: colors.text.primary }]}>1</Text>
                                    <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}>
                                        <Plus size={16} color={colors.text.primary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Animated.View>
                    </ScrollView>

                    <View style={[styles.footer, { backgroundColor: colors.bg.app, borderTopColor: colors.border.subtle }]}>
                        <PressableScale
                            style={[styles.addToCartBtn, { backgroundColor: colors.primary }]}
                            onPress={() => {
                                if (onAddToCart && product) {
                                    onAddToCart(product);
                                    onClose();
                                }
                            }}
                        >
                            <ShoppingBag size={20} color="#FFF" style={{ marginRight: 10 }} />
                            <Text style={styles.addToCartText}>Add to Cart</Text>
                        </PressableScale>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    content: {
        height: SCREEN_HEIGHT * 0.9,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 24,
        zIndex: 10,
    },
    circleBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    title: { ...Typography.h1, fontSize: 36 },
    subtitle: { ...Typography.body, fontSize: 16, marginTop: 4 },
    explodedContainer: {
        height: 350,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
    },
    burgerLayer: { position: 'absolute', zIndex: 5 },
    layerDisc: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    floatingIngredients: { position: 'absolute', width: 200, height: 200 },
    miniIng: { position: 'absolute', borderRadius: 4, transform: [{ rotate: '45deg' }], elevation: 4 },
    price: { ...Typography.h2, fontSize: 28, marginBottom: 16 },
    description: { ...Typography.body, lineHeight: 24 },
    customRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
    quantityContainer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    qtyBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    qtyText: { ...Typography.h3, fontSize: 18 },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingBottom: 40,
        borderTopWidth: 1,
    },
    addToCartBtn: {
        flexDirection: 'row',
        height: 60,
        borderRadius: Radius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
    },
    addToCartText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
});
