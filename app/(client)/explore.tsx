import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Image, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../context/LanguageContext';
import { Typography, Spacing, Radius } from '../../constants/theme';
import { Search, Sliders, MapPin, Star, History } from 'lucide-react-native';

export default function ExploreScreen() {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const [query, setQuery] = useState('');

    return (
        <View style={[s.container, { backgroundColor: colors.bg.app }]}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }}>
                <View style={[s.searchHeader, { marginTop: 35 }]}>
                    <View style={[s.searchBar, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                        <Search size={20} color={colors.primary} />
                        <TextInput
                            placeholder={t('rechercher')}
                            placeholderTextColor={colors.text.muted}
                            style={[s.searchInput, { color: colors.text.primary }]}
                            value={query}
                            onChangeText={setQuery}
                        />
                    </View>
                    <TouchableOpacity style={[s.filterBtn, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                        <Sliders size={20} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 200 }}>
                    {/* Recent Searches */}
                    <View style={s.section}>
                        <View style={s.rowBetween}>
                            <Text style={[s.sectionTitle, { color: colors.primary }]}>{t('explorer')}</Text>
                            <History size={16} color={colors.text.muted} />
                        </View>
                        <View style={s.tagContainer}>
                            {['Pizza', 'Burger', 'Sushi', 'Pasta'].map(tag => (
                                <View key={tag} style={[s.tag, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                                    <Text style={{ color: colors.text.secondary }}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Popular Categories Grid */}
                    <View style={s.section}>
                        <Text style={[s.sectionTitle, { color: colors.primary }]}>Les plus populaires</Text>
                        <View style={s.grid}>
                            {[
                                { label: 'Italienne', img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80' },
                                { label: 'Japonaise', img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=200&q=80' },
                                { label: 'Française', img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80' },
                                { label: 'Végane', img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80' },
                            ].map(item => (
                                <TouchableOpacity key={item.label} style={s.gridItem}>
                                    <Image source={{ uri: item.img }} style={s.gridImg} />
                                    <View style={s.overlay} />
                                    <Text style={s.gridLabel}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    searchHeader: { flexDirection: 'row', padding: Spacing.lg, gap: 12, alignItems: 'center' },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: Radius.lg, paddingHorizontal: 15, borderWidth: 1 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
    filterBtn: { width: 50, height: 50, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
    section: { marginTop: 25 },
    sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
    gridItem: { width: '47.5%', height: 120, borderRadius: Radius.xl, overflow: 'hidden', position: 'relative' },
    gridImg: { width: '100%', height: '100%' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
    gridLabel: { position: 'absolute', bottom: 12, left: 12, color: '#FFF', fontWeight: '800', fontSize: 16 },
});
