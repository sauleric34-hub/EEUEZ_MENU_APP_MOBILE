import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, StatusBar, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { Typography, Spacing, Radius, glow } from '../constants/theme';
import { User, Mail, Lock, Phone, AlertCircle, ArrowRight, Check } from 'lucide-react-native';
import { PressableScale } from '../components/Animations';

const ALLERGY_SUGGESTIONS = ['Arachides', 'Gluten', 'Lactose', 'Fruits à coque', 'Poisson', 'Soja', 'Œufs', 'Crustacés'];

export default function RegisterScreen() {
    const { colors } = useTheme();
    const { register } = useAuth();
    const { t } = useTranslation();
    const router = useRouter();

    const [nom, setNom] = useState('');
    const [email, setEmail] = useState('');
    const [tel, setTel] = useState('');
    const [pass, setPass] = useState('');
    const [allergyInput, setAllergyInput] = useState('');
    const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const lineAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (allergyInput.length > 0) {
            const filtered = ALLERGY_SUGGESTIONS.filter(s =>
                s.toLowerCase().includes(allergyInput.toLowerCase()) && !selectedAllergies.includes(s)
            );
            setSuggestions(filtered);
            Animated.timing(lineAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
        } else {
            setSuggestions([]);
            Animated.timing(lineAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
        }
    }, [allergyInput]);

    const addAllergy = (allergy: string) => {
        setSelectedAllergies([...selectedAllergies, allergy]);
        setAllergyInput('');
    };

    const handleRegister = async () => {
        try {
            const nameParts = nom.split(' ');
            const nomFamille = nameParts[nameParts.length - 1] || '';
            const prenom = nameParts.slice(0, -1).join(' ') || nomFamille;

            await register({
                nom: nomFamille,
                prenom,
                email,
                telephone: tel,
                password: pass,
                allergies: selectedAllergies.join(', ')
            });
            // La redirection se fera automatiquement via index.tsx si on est de retour
            router.replace('/(client)');
        } catch (error) {
            alert("Erreur d'inscription : " + (error as Error).message);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={[s.container, { backgroundColor: colors.bg.app }]}>
                <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                    <View style={s.header}>
                        <Text style={[s.title, { color: colors.text.primary }]}>{t('rejoignez_menu')}</Text>
                        <Text style={[s.subtitle, { color: colors.text.secondary }]}>Créez votre compte pour commencer l'aventure culinaire</Text>
                    </View>

                    <View style={s.form}>
                        <Input icon={User} placeholder="Nom complet" colors={colors} value={nom} onChangeText={setNom} />
                        <Input icon={Mail} placeholder="Adresse email" keyboardType="email-address" colors={colors} value={email} onChangeText={setEmail} />
                        <Input icon={Phone} placeholder="Numéro de téléphone" keyboardType="phone-pad" colors={colors} value={tel} onChangeText={setTel} />
                        <Input icon={Lock} placeholder="Mot de passe" secureTextEntry colors={colors} value={pass} onChangeText={setPass} />

                        <View style={s.allergySection}>
                            <View style={s.row}>
                                <AlertCircle size={20} color={colors.primary} />
                                <Text style={[s.sectionTitle, { color: colors.text.primary }]}>Allergies & Régimes</Text>
                            </View>

                            <View style={s.chipsContainer}>
                                {selectedAllergies.map(a => (
                                    <View key={a} style={[s.chip, { backgroundColor: colors.primaryBg }]}>
                                        <Text style={[s.chipText, { color: colors.primary }]}>{a}</Text>
                                        <TouchableOpacity onPress={() => setSelectedAllergies(old => old.filter(i => i !== a))}>
                                            <Check size={14} color={colors.primary} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>

                            <View style={s.inputWrapper}>
                                <TextInput
                                    style={[s.inputInline, { color: colors.text.primary }]}
                                    placeholder="Tapez vos allergies..."
                                    placeholderTextColor={colors.text.muted}
                                    value={allergyInput}
                                    onChangeText={setAllergyInput}
                                />
                                <Animated.View style={[s.activeLine, {
                                    backgroundColor: colors.primary,
                                    width: lineAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                                }]} />
                            </View>

                            {suggestions.length > 0 && (
                                <View style={[s.suggestionsBox, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                                    {suggestions.map(sug => (
                                        <TouchableOpacity key={sug} style={s.sugItem} onPress={() => addAllergy(sug)}>
                                            <Text style={{ color: colors.text.primary }}>{sug}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        <PressableScale onPress={handleRegister} style={{ marginTop: 20 }}>
                            <View style={[s.btn, { backgroundColor: colors.primary }, glow(colors.primary, 15)]}>
                                <Text style={s.btnText}>S'inscrire</Text>
                                <ArrowRight size={20} color="#FFF" />
                            </View>
                        </PressableScale>

                        <TouchableOpacity style={s.loginLink} onPress={() => router.replace('/login')}>
                            <Text style={{ color: colors.text.secondary }}>Déjà un compte ? <Text style={{ color: colors.primary, fontWeight: '700' }}>Se connecter</Text></Text>
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
    scroll: { padding: Spacing.xl },
    header: { marginBottom: 30 },
    title: { ...Typography.h1, fontSize: 32 },
    subtitle: { ...Typography.body, marginTop: 8 },
    form: { gap: 16 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, borderRadius: Radius.lg, borderWidth: 1 },
    input: { flex: 1, marginLeft: 12, fontSize: 16 },
    allergySection: { marginTop: 10, gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { ...Typography.h3, fontSize: 18 },
    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 5 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
    chipText: { fontSize: 13, fontWeight: '700' },
    inputWrapper: { position: 'relative', height: 40, justifyContent: 'center' },
    inputInline: { fontSize: 16, paddingVertical: 5 },
    activeLine: { position: 'absolute', bottom: 0, height: 2, borderRadius: 1 },
    suggestionsBox: { marginTop: 5, borderRadius: Radius.md, borderWidth: 1, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
    sugItem: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#EEE' },
    btn: { height: 60, borderRadius: Radius.xl, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
    loginLink: { alignItems: 'center', marginTop: 20 },
});
