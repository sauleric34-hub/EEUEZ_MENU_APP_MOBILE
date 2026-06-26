import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { PressableScale } from '../../components/Animations';
import { restaurantWorkspaceService } from '../../services/apiService';

export default function MenuScreen() {
    const router = useRouter();
    const [plats, setPlats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        restaurantWorkspaceService.getPlats()
            .then(res => setPlats(Array.isArray(res) ? res : (res.data || [])))
            .catch(() => {
                // Fallback to mock data if API fails
                setPlats([
                    { id: 1, nom: 'Ndolé Royal', prix: 4500, is_available: true },
                    { id: 2, nom: 'Poulet DG', prix: 5000, is_available: false },
                    { id: 3, nom: 'Poisson Braisé', prix: 6000, is_available: true }
                ]);
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <SafeAreaView style={s.screen}>
            <View style={s.topBar}>
                <PressableScale onPress={() => router.back()}>
                    <View style={s.backBtn}><Text style={s.backBtnText}>←</Text></View>
                </PressableScale>
                <Text style={s.headerTitle}>Gestion du Menu</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={s.content}>
                {loading ? (
                    <ActivityIndicator size="large" color={Colors.restaurant.primary} style={{ marginTop: 50 }} />
                ) : (
                    plats.map(plat => (
                        <View key={plat.id} style={s.platCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.platName}>{plat.nom}</Text>
                                <Text style={s.platPrice}>{plat.prix} FCFA</Text>
                            </View>
                            <View style={[s.statusBadge, { backgroundColor: plat.is_available ? Colors.successBg : Colors.dangerBg }]}>
                                <Text style={[s.statusText, { color: plat.is_available ? Colors.success : Colors.danger }]}>
                                    {plat.is_available ? 'Disponible' : 'Épuisé'}
                                </Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            <View style={s.fab}>
                <Text style={{ color: '#FFF', fontSize: 24 }}>+</Text>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Colors.bg.app },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    backBtnText: { fontSize: 20, color: Colors.text.primary },
    headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.text.primary },
    content: { padding: Spacing.xl, gap: 12 },
    platCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.surface, padding: 16, borderRadius: Radius.md, elevation: 2 },
    platName: { fontSize: 16, fontWeight: '700', color: Colors.text.primary, marginBottom: 4 },
    platPrice: { fontSize: 14, color: Colors.restaurant.primary, fontWeight: '600' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '700' },
    fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.restaurant.primary, justifyContent: 'center', alignItems: 'center', elevation: 6 },
});
