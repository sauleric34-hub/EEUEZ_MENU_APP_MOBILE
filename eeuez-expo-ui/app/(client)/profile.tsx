import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { Typography, Spacing, Radius } from '../../constants/theme';
import { User, Settings, Bell, CreditCard, Shield, LogOut, ChevronRight, AlertTriangle, Globe } from 'lucide-react-native';

export default function ProfileScreen() {
    const { colors } = useTheme();
    const { user, logout } = useAuth();
    const { language, setLanguage, t } = useTranslation();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.replace('/');
    };

    return (
        <View style={[s.container, { backgroundColor: colors.bg.app }]}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
                    {/* Header */}
                    <View style={[s.header, { marginTop: 35 }]}>
                        <View style={[s.avatarContainer, { borderColor: colors.primary }]}>
                            <Image
                                source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' }}
                                style={s.avatar}
                            />
                        </View>
                        <Text style={[s.userName, { color: colors.text.primary }]}>{user?.nom || 'Mariana Silva'}</Text>
                        <Text style={[s.userEmail, { color: colors.text.secondary }]}>{user?.email || 'mariana.silva@example.com'}</Text>
                    </View>

                    {/* Allergy Banner */}
                    <View style={[s.allergyBanner, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}>
                        <AlertTriangle size={20} color={colors.warning} />
                        <View style={{ flex: 1 }}>
                            <Text style={[s.allergyTitle, { color: colors.warning }]}>{t('allergies')}</Text>
                            <Text style={[s.allergyText, { color: colors.text.secondary }]}>
                                {user?.allergies || t('aucun_allergie')}
                            </Text>
                        </View>
                    </View>

                    {/* Language Switcher */}
                    <View style={s.section}>
                        <Text style={[s.sectionLabel, { color: colors.text.muted }]}>{t('langue')}</Text>
                        <View style={s.langRow}>
                            <TouchableOpacity
                                onPress={() => setLanguage('fr')}
                                style={[s.langBtn, language === 'fr' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                                <Text style={[s.langText, language === 'fr' && { color: '#FFF' }]}>{t('francais')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setLanguage('en')}
                                style={[s.langBtn, language === 'en' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                                <Text style={[s.langText, language === 'en' && { color: '#FFF' }]}>{t('anglais')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Menu Sections */}
                    <View style={s.section}>
                        <Text style={[s.sectionLabel, { color: colors.text.muted }]}>{t('compte')}</Text>
                        <ProfileItem icon={User} label={t('info_personnel')} colors={colors} />
                        <ProfileItem icon={CreditCard} label={t('methode_paiement')} colors={colors} />
                        <ProfileItem icon={Bell} label="Notifications" colors={colors} />
                    </View>

                    <View style={s.section}>
                        <Text style={[s.sectionLabel, { color: colors.text.muted }]}>{t('parametres')}</Text>
                        <ProfileItem icon={Shield} label={t('securite')} colors={colors} />
                        <ProfileItem icon={Settings} label={t('preferences')} colors={colors} />
                    </View>

                    <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
                        <LogOut size={20} color={colors.danger} />
                        <Text style={[s.logoutText, { color: colors.danger }]}>{t('deconnexion')}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

function ProfileItem({ icon: Icon, label, colors }: any) {
    return (
        <TouchableOpacity style={[s.item, { borderBottomColor: colors.border.subtle }]}>
            <View style={[s.iconBox, { backgroundColor: colors.bg.surface }]}>
                <Icon size={20} color={colors.primary} />
            </View>
            <Text style={[s.itemLabel, { color: colors.text.primary }]}>{label}</Text>
            <ChevronRight size={18} color={colors.text.muted} />
        </TouchableOpacity>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    header: { alignItems: 'center', paddingVertical: Spacing.xl },
    avatarContainer: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, padding: 4, marginBottom: 15 },
    avatar: { width: '100%', height: '100%', borderRadius: 55 },
    userName: { ...Typography.h2, fontSize: 24 },
    userEmail: { ...Typography.body, marginTop: 4 },
    allergyBanner: { flexDirection: 'row', alignItems: 'center', margin: Spacing.lg, padding: 16, borderRadius: Radius.lg, borderWidth: 1, gap: 12 },
    allergyTitle: { fontWeight: '800', fontSize: 14, textTransform: 'uppercase' },
    allergyText: { fontSize: 13, marginTop: 2 },
    section: { paddingHorizontal: Spacing.lg, marginBottom: 25 },
    sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
    iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15, elevation: 2 },
    itemLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 30, gap: 10 },
    logoutText: { fontSize: 16, fontWeight: '700' },
    langRow: { flexDirection: 'row', gap: 10 },
    langBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#EEE' },
    langText: { fontWeight: '700' },
});
