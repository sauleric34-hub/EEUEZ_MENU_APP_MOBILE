import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../context/LanguageContext';
import { Typography, Spacing, Radius } from '../../constants/theme';
import { Heart, Star, ChevronRight } from 'lucide-react-native';

export default function FavoritesScreen() {
    const { colors } = useTheme();
    const { t } = useTranslation();

    return (
        <View style={[s.container, { backgroundColor: colors.bg.app }]}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }}>
                <View style={[s.header, { marginTop: 35 }]}>
                    <Text style={[s.title, { color: colors.text.primary }]}>{t('favoris')}</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 180 }}>
                    {[1, 2, 3].map(i => (
                        <View key={i} style={[s.favCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                            <Image
                                source={{ uri: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80` }}
                                style={s.cardImg}
                            />
                            <View style={s.cardContent}>
                                <Text style={[s.name, { color: colors.text.primary }]}>Restaurant Aroma {i}</Text>
                                <View style={s.ratingRow}>
                                    <Star size={14} color={colors.accent} fill={colors.accent} />
                                    <Text style={[s.rating, { color: colors.text.primary }]}>4.8</Text>
                                    <Text style={{ color: colors.text.muted }}>· Italienne</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={s.heartBtn}>
                                <Heart size={20} color={colors.primary} fill={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    header: { padding: Spacing.lg },
    title: { ...Typography.h1, fontSize: 24 },
    favCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: Radius.xl, borderWidth: 1, marginBottom: 15 },
    cardImg: { width: 70, height: 70, borderRadius: Radius.lg },
    cardContent: { flex: 1, marginLeft: 15, gap: 4 },
    name: { fontWeight: '700', fontSize: 16 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    rating: { fontWeight: '700', fontSize: 13 },
    heartBtn: { padding: 10 },
});
