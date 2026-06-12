import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Animated, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow } from '../constants/theme';
import { PressableScale } from '../components/Animations';

const ROLES = [
  { key: 'client',      label: 'Client',      emoji: '🛍️', desc: 'Créer un compte pour commander' },
  { key: 'restaurant',  label: 'Restaurant',  emoji: '🏪', desc: 'Enregistrer votre restaurant' },
  { key: 'livreur',     label: 'Livreur',     emoji: '🛵', desc: 'Rejoindre notre flotte' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [role, setRole] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [tel, setTel] = useState('');
  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideIn = useRef(new Animated.Value(40)).current;
  const cardAnims = useRef(ROLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(slideIn, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      ]),
      Animated.stagger(100, cardAnims.map(a =>
        Animated.spring(a, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true })
      )),
    ]).start();
  }, [step]);

  const selectRole = (key: string) => {
    setRole(key);
    setStep('form');
  };

  const submit = () => {
    router.push(`/(${role})` as any);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

          {/* Header */}
          <Animated.View style={[s.header, { opacity: fadeIn, transform: [{ translateY: slideIn }] }]}>
            <PressableScale onPress={() => step === 'form' ? setStep('role') : router.back()}>
              <View style={s.backBtn}><Text style={s.backArrow}>←</Text></View>
            </PressableScale>
            <View style={s.logoRow}>
              <Text style={s.logoText}>EEUEZ</Text>
              <View style={s.logoBadge}><Text style={s.logoBadgeText}>MENU</Text></View>
            </View>
            <Text style={s.title}>{step === 'role' ? '👋 Créer un compte' : `✏️ Inscription ${ROLES.find(r => r.key === role)?.label}`}</Text>
            <Text style={s.subtitle}>{step === 'role' ? 'Choisissez votre rôle' : 'Remplissez vos informations'}</Text>
          </Animated.View>

          {step === 'role' ? (
            <View style={s.rolesSection}>
              {ROLES.map((r, i) => (
                <Animated.View key={r.key} style={{
                  opacity: cardAnims[i],
                  transform: [{ translateX: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }]
                }}>
                  <PressableScale onPress={() => selectRole(r.key)}>
                    <View style={s.roleCard}>
                      <View style={s.roleIconBg}><Text style={{ fontSize: 28 }}>{r.emoji}</Text></View>
                      <View style={s.roleText}>
                        <Text style={s.roleLabel}>{r.label}</Text>
                        <Text style={s.roleDesc}>{r.desc}</Text>
                      </View>
                      <Text style={s.roleArrow}>›</Text>
                    </View>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          ) : (
            <Animated.View style={[s.form, { opacity: fadeIn }]}>
              {[
                { label: 'Prénom', value: prenom, onChange: setPrenom, placeholder: 'Jean', emoji: '👤' },
                { label: 'Nom',    value: nom,    onChange: setNom,    placeholder: 'Kamga', emoji: '👤' },
                { label: 'Email',  value: email,  onChange: setEmail,  placeholder: 'jean@example.cm', emoji: '✉️' },
                { label: 'Téléphone', value: tel, onChange: setTel,  placeholder: '+237 6XX XXX XXX', emoji: '📱' },
              ].map(field => (
                <View key={field.label} style={s.fieldBox}>
                  <Text style={s.fieldLabel}>{field.emoji} {field.label}</Text>
                  <View style={s.inputBox}>
                    <TextInput
                      style={s.input}
                      value={field.value}
                      onChangeText={field.onChange}
                      placeholder={field.placeholder}
                      placeholderTextColor={Colors.text.muted}
                    />
                  </View>
                </View>
              ))}

              <PressableScale onPress={submit}>
                <View style={[s.submitBtn, glow(Colors.client.glow, 12)]}>
                  <Text style={s.submitText}>✓ Créer mon compte</Text>
                </View>
              </PressableScale>

              <PressableScale onPress={() => router.push('/')}>
                <Text style={s.loginLink}>Déjà un compte ? <Text style={{ color: Colors.client.primary }}>Se connecter</Text></Text>
              </PressableScale>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg.app },
  header:       { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, paddingBottom: Spacing.xl, gap: 12 },
  backBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.glass.bg, justifyContent: 'center', alignItems: 'center' },
  backArrow:    { fontSize: 22, color: Colors.text.primary },
  logoRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  logoText:     { fontSize: 32, fontWeight: '900', letterSpacing: -1, color: Colors.text.primary },
  logoBadge:    { backgroundColor: Colors.client.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  logoBadgeText:{ fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#FFF' },
  title:        { ...Typography.h2 },
  subtitle:     { ...Typography.body, color: Colors.text.secondary },
  rolesSection: { paddingHorizontal: Spacing.md, gap: 14 },
  roleCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.md, gap: 14, borderWidth: 1, borderColor: Colors.border.default },
  roleIconBg:   { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.client.bg, justifyContent: 'center', alignItems: 'center' },
  roleText:     { flex: 1, gap: 4 },
  roleLabel:    { ...Typography.h3, fontSize: 17 },
  roleDesc:     { ...Typography.small },
  roleArrow:    { fontSize: 28, color: Colors.text.muted },
  form:         { paddingHorizontal: Spacing.md, gap: 16 },
  fieldBox:     { gap: 6 },
  fieldLabel:   { ...Typography.small, fontWeight: '700', color: Colors.text.secondary },
  inputBox:     { backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border.default },
  input:        { paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.text.primary },
  submitBtn:    { marginTop: 8, backgroundColor: Colors.client.primary, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  submitText:   { color: Colors.bg.app, fontWeight: '900', fontSize: 16 },
  loginLink:    { textAlign: 'center', marginTop: 16, ...Typography.small, color: Colors.text.secondary },
});
