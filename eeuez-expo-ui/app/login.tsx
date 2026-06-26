import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { Spacing, glow } from '../constants/theme';
import { Mail, Lock, ArrowRight } from 'lucide-react-native';
import { PressableScale } from '../components/Animations';

export default function LoginScreen() {
    const { colors } = useTheme();
    const { login } = useAuth();
    const { t } = useTranslation();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');

    const handleLogin = async () => {
        try {
            await login({ email, password: pass });
            // Redirection is handled automatically in index.tsx
            router.replace('/');
        } catch (error) {
            alert("Erreur de connexion : " + (error as Error).message);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={[s.container, { backgroundColor: colors.bg.app }]}>
                <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                    <View style={s.header}>
                        <Text style={[s.title, { color: colors.text.primary }]}>{t('welcome_back') || 'Bon retour'}</Text>
                        <Text style={[s.subtitle, { color: colors.text.secondary }]}>Connectez-vous pour continuer</Text>
                    </View>

                    <View style={s.form}>
                        <Input icon={Mail} placeholder="Adresse email" keyboardType="email-address" colors={colors} value={email} onChangeText={setEmail} />
                        <Input icon={Lock} placeholder="Mot de passe" secureTextEntry colors={colors} value={pass} onChangeText={setPass} />

                        <PressableScale onPress={handleLogin} style={{ marginTop: 20 }}>
                            <View style={[s.btn, { backgroundColor: colors.primary }, glow(colors.primary, 15)]}>
                                <Text style={s.btnText}>Se connecter</Text>
                                <ArrowRight size={20} color="#FFF" />
                            </View>
                        </PressableScale>

                        <TouchableOpacity style={s.registerLink} onPress={() => router.replace('/register')}>
                            <Text style={{ color: colors.text.secondary }}>Pas de compte ? <Text style={{ color: colors.primary, fontWeight: '700' }}>S'inscrire</Text></Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

function Input({ icon: Icon, colors, ...props }: any) {
    return (
        <View style={[s.inputContainer, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}>
            <Icon size={20} color={colors.primary} />
            <TextInput
                style={[s.input, { color: colors.text.primary }]}
                placeholderTextColor={colors.text.muted}
                {...props}
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    scroll: { flexGrow: 1, padding: Spacing.xl, justifyContent: 'center' },
    header: { marginBottom: 40 },
    title: { fontSize: 32, fontWeight: '900', marginBottom: 8 },
    subtitle: { fontSize: 16, lineHeight: 24 },
    form: { gap: 16 },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center', height: 56,
        borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, gap: 12
    },
    input: { flex: 1, fontSize: 16, height: '100%' },
    btn: {
        height: 56, borderRadius: 28, flexDirection: 'row',
        justifyContent: 'center', alignItems: 'center', gap: 10
    },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
    registerLink: { alignItems: 'center', marginTop: 30, padding: 10 },
});
