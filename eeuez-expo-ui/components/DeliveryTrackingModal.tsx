import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, Modal, Animated,
    Dimensions, Image, TouchableOpacity, Alert
} from 'react-native';
import { X, Navigation, Clock, Ban, CheckCircle2, MapPin } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Typography, Spacing, Radius, glow } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { PressableScale, PulseRing } from './Animations';

const { width: W, height: H } = Dimensions.get('window');

interface DeliveryTrackingModalProps {
    isVisible: boolean;
    onClose: () => void;
    orderId?: string;
    restaurantName?: string;
    estimatedTime?: number; // en minutes
}

export default function DeliveryTrackingModal({
    isVisible, onClose, orderId = "CMD-882", restaurantName = "La Pasta House", estimatedTime = 12
}: DeliveryTrackingModalProps) {
    const { colors, isDark } = useTheme();
    const [isCancelled, setIsCancelled] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(H)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
                Animated.timing(progressAnim, { toValue: 0.75, duration: 2500, useNativeDriver: false }), // Simule 75% du chemin fait
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: H, duration: 300, useNativeDriver: true }),
            ]).start();
        }
    }, [isVisible]);

    const handleCancel = () => {
        Alert.alert(
            "Annuler la commande",
            "⚠️ L'annulation en cours de livraison entraîne des frais de dédommagement de 1 500 FCFA pour le livreur. Souhaitez-vous continuer ?",
            [
                { text: "Garder la commande", style: "cancel" },
                {
                    text: "Annuler et Payer",
                    style: "destructive",
                    onPress: () => {
                        setIsCancelled(true);
                        setTimeout(() => {
                            onClose();
                            setIsCancelled(false);
                        }, 2000);
                    }
                }
            ]
        );
    };

    if (!isVisible) return null;

    return (
        <Modal transparent visible={isVisible} animationType="none">
            <View style={styles.container}>
                <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim, backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)' }]} />

                <Animated.View style={[
                    styles.content,
                    { backgroundColor: colors.bg.app, transform: [{ translateY: slideAnim }] }
                ]}>
                    {/* Header Carte */}
                    <View style={styles.mapContainer}>
                        {/* Simulation de carte avec un fond subtil */}
                        <View style={[styles.mapPlaceholder, { backgroundColor: isDark ? '#222' : '#f0f0f0' }]}>
                            <View style={styles.mapDecor}>
                                <Svg height="100%" width="100%" viewBox="0 0 100 100">
                                    <Path
                                        d="M20,80 Q40,40 80,20"
                                        stroke={colors.primary}
                                        strokeWidth="2"
                                        fill="none"
                                        strokeDasharray="4,2"
                                    />
                                    <Circle cx="20" cy="80" r="3" fill={colors.secondary} />
                                    <Circle cx="80" cy="20" r="3" fill={colors.primary} />
                                </Svg>
                            </View>
                            <View style={styles.mapHeader}>
                                <TouchableOpacity onPress={onClose} style={[styles.backBtn, { backgroundColor: colors.bg.surface }]}>
                                    <X size={20} color={colors.text.primary} />
                                </TouchableOpacity>
                                <Text style={[styles.mapTitle, { color: colors.text.primary }]}>Delivery map</Text>
                            </View>

                            <View style={[styles.pinResto, { top: '15%', right: '15%' }]}>
                                <PulseRing color={colors.primary} size={40}>
                                    <View style={[styles.pinIcon, { backgroundColor: colors.primary }]}>
                                        <MapPin size={12} color="#FFF" />
                                    </View>
                                </PulseRing>
                            </View>
                        </View>
                    </View>

                    {/* Corps Info */}
                    <View style={styles.infoSection}>
                        <View style={styles.timerContainer}>
                            <Svg height="160" width="160" viewBox="0 0 100 100">
                                <Circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    stroke={isDark ? '#333' : '#eee'}
                                    strokeWidth="5"
                                    fill="none"
                                />
                                <AnimatedCircle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    stroke={colors.primary}
                                    strokeWidth="5"
                                    fill="none"
                                    strokeDasharray="282.7"
                                    strokeDashoffset={progressAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [282.7, 0]
                                    })}
                                    strokeLinecap="round"
                                />
                            </Svg>
                            <View style={styles.timerContent}>
                                <Text style={[styles.timerValue, { color: colors.text.primary }]}>{estimatedTime}</Text>
                                <Text style={[styles.timerLabel, { color: colors.text.secondary }]}>min{"\n"}delivery time</Text>
                            </View>
                        </View>

                        <Text style={[styles.restoName, { color: colors.text.primary }]}>{restaurantName}</Text>
                        <Text style={[styles.statusMsg, { color: colors.text.secondary }]}>
                            {isCancelled ? "Commande annulée" : "Your order is being processed"}
                        </Text>

                        {/* Actions */}
                        <View style={styles.btnRow}>
                            <PressableScale onPress={onClose} style={{ flex: 1 }}>
                                <View style={[styles.btnSecondary, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}>
                                    <Text style={[styles.btnSecondaryText, { color: colors.text.primary }]}>Masquer le suivi</Text>
                                </View>
                            </PressableScale>

                            {!isCancelled && (
                                <PressableScale onPress={handleCancel} style={{ flex: 1 }}>
                                    <View style={[styles.btnCancel, { backgroundColor: colors.danger + '20', borderColor: colors.danger }]}>
                                        <Ban size={18} color={colors.danger} style={{ marginRight: 8 }} />
                                        <Text style={[styles.btnCancelText, { color: colors.danger }]}>Annuler</Text>
                                    </View>
                                </PressableScale>
                            )}
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    content: {
        height: H * 0.85,
        borderTopLeftRadius: Radius.xxl,
        borderTopRightRadius: Radius.xxl,
        overflow: 'hidden',
    },
    mapContainer: {
        height: '45%',
        width: '100%',
    },
    mapPlaceholder: {
        flex: 1,
    },
    mapDecor: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.3,
    },
    mapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        marginTop: Spacing.sm,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    mapTitle: {
        flex: 1,
        textAlign: 'center',
        ...Typography.h3,
        marginRight: 36,
    },
    pinResto: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    infoSection: {
        flex: 1,
        alignItems: 'center',
        paddingTop: Spacing.xl,
        paddingHorizontal: Spacing.lg,
    },
    timerContainer: {
        width: 160,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    timerContent: {
        position: 'absolute',
        alignItems: 'center',
    },
    timerValue: {
        fontSize: 48,
        fontWeight: '900',
        letterSpacing: -1,
    },
    timerLabel: {
        ...Typography.caption,
        textAlign: 'center',
        lineHeight: 14,
    },
    restoName: {
        ...Typography.h3,
        marginBottom: 4,
    },
    statusMsg: {
        ...Typography.body,
        fontWeight: '500',
        marginBottom: Spacing.xl,
    },
    btnRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        paddingBottom: Spacing.xl,
    },
    btnSecondary: {
        height: 54,
        borderRadius: Radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    btnSecondaryText: {
        fontWeight: '700',
        fontSize: 15,
    },
    btnCancel: {
        height: 54,
        borderRadius: Radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        flexDirection: 'row',
    },
    btnCancelText: {
        fontWeight: '700',
        fontSize: 15,
    },
});
