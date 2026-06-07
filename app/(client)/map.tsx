import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Typography, Spacing, Radius, glow } from '../../constants/theme';
import { ChevronLeft, MapPin, Navigation, Clock, Phone, XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function MapScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    return (
        <View style={[s.container, { backgroundColor: colors.bg.app }]}>
            <StatusBar barStyle="dark-content" />

            {/* Simulation de la carte */}
            <View style={s.mapMock}>
                <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1000&q=80' }}
                    style={s.mapImage}
                />
                <View style={s.overlay}>
                    <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { marginTop: 10 }]}>
                        <ChevronLeft size={28} color={colors.text.primary} />
                    </TouchableOpacity>

                    {/* Itinerary Line (Simulated) */}
                    <View style={s.itineraryContainer}>
                        <View style={[s.marker, { top: '30%', left: '40%', backgroundColor: colors.primary }]}>
                            <MapPin size={20} color="#FFF" />
                        </View>
                        <View style={[s.marker, { bottom: '40%', right: '30%', backgroundColor: colors.success }]}>
                            <Navigation size={20} color="#FFF" />
                        </View>
                    </View>
                </View>
            </View>

            <SafeAreaView style={s.safeArea} edges={['bottom']}>
                <View style={[s.bottomSheet, { backgroundColor: colors.bg.surface }]}>
                    <View style={s.sheetHeader}>
                        <View style={s.handle} />
                    </View>

                    <View style={s.infoRow}>
                        <View style={[s.iconBox, { backgroundColor: colors.primaryBg }]}>
                            <Clock size={24} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.timeText, { color: colors.primary }]}>12-15 min</Text>
                            <Text style={[s.statusText, { color: colors.text.secondary }]}>Le livreur est en route</Text>
                        </View>
                        <TouchableOpacity style={[s.callBtn, { backgroundColor: colors.success }]}>
                            <Phone size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={[s.divider, { backgroundColor: colors.border.subtle }]} />

                    <View style={s.actionRow}>
                        <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.danger }]}>
                            <XCircle size={20} color={colors.danger} />
                            <Text style={[s.cancelText, { color: colors.danger }]}>Annuler la commande</Text>
                        </TouchableOpacity>
                        <Text style={[s.dedomageText, { color: colors.text.muted }]}>Des frais de 1500F seront appliqués</Text>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    mapMock: { flex: 1, position: 'relative' },
    mapImage: { width: '100%', height: '100%', opacity: 0.8 },
    overlay: { ...StyleSheet.absoluteFillObject, padding: Spacing.lg },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 5 },
    itineraryContainer: { ...StyleSheet.absoluteFillObject },
    marker: { position: 'absolute', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 10, borderWidth: 2, borderColor: '#FFF' },
    safeArea: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    bottomSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: Spacing.xl, elevation: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20 },
    sheetHeader: { alignItems: 'center', marginBottom: 20 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    iconBox: { width: 56, height: 56, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center' },
    timeText: { fontSize: 22, fontWeight: '900' },
    statusText: { fontSize: 14, fontWeight: '600' },
    callBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    divider: { height: 1, marginVertical: 20 },
    actionRow: { alignItems: 'center', gap: 8 },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1 },
    cancelText: { fontWeight: '700' },
    dedomageText: { fontSize: 11, fontWeight: '500' },
});
