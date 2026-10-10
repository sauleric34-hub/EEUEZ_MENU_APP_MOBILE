// ═══════════════════════════════════════════════════════════
//  Changer de mot de passe — vérification par code e-mail (OTP)
//  1. Envoi du code  2. Saisie du code (6 cases)  3. Nouveau mot
//  de passe (robustesse en direct)  → écran de succès.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  FadeIn, FadeInRight, FadeOutLeft, ZoomIn, useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';
import {
  ChevronLeft, ShieldCheck, Mail, Lock, Eye, EyeOff, Check, Circle, RefreshCw, CircleCheck,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { ScreenBg } from '../components/ScreenBg';
import { PressableScale, bodyFont, displayFont } from '../components/ui';
import { ErrorNotice } from '../components/ErrorNotice';
import { describeError, type ErrorInfo } from '../services/errors';
import { changerMotDePasse, demanderCodeMotDePasse, verifierCodeMotDePasse } from '../services/auth';
import { useGardeDemo } from '../hooks/useGardeDemo';

type Etape = 'intro' | 'code' | 'nouveau' | 'succes';
const LONGUEUR_CODE = 6;

export default function ChangePasswordScreen() {
  const { colors, user } = useApp();
  const router = useRouter();
  const { bloquer } = useGardeDemo();

  const [etape, setEtape] = useState<Etape>('intro');
  const [emailMasque, setEmailMasque] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<ErrorInfo | null>(null);
  const [renvoiDans, setRenvoiDans] = useState(0);

  // Compte à rebours avant de pouvoir redemander un code
  useEffect(() => {
    if (renvoiDans <= 0) return;
    const id = setTimeout(() => setRenvoiDans(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [renvoiDans]);

  const envoyerCode = async () => {
    setBusy(true); setErreur(null);
    try {
      const res = await demanderCodeMotDePasse();
      setEmailMasque(res.email);
      setRenvoiDans(res.renvoi_dans);
      setCode('');
      setEtape('code');
    } catch (e) {
      setErreur(describeError(e, 'Le code n\'a pas pu être envoyé.'));
    } finally {
      setBusy(false);
    }
  };

  const verifier = async (valeur: string) => {
    setBusy(true); setErreur(null);
    try {
      await verifierCodeMotDePasse(valeur);
      setEtape('nouveau');
    } catch (e) {
      setErreur(describeError(e, 'Code incorrect.'));
      setCode('');
      return false;
    } finally {
      setBusy(false);
    }
    return true;
  };

  const etapesVisibles: Etape[] = ['intro', 'code', 'nouveau'];
  const indexEtape = Math.min(etapesVisibles.indexOf(etape === 'succes' ? 'nouveau' : etape), 2);

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <PressableScale onPress={() => router.back()}>
                <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ChevronLeft size={20} color={colors.text} />
                </View>
              </PressableScale>
              <Text style={[displayFont(22, '800'), { color: colors.text }]}>Mot de passe</Text>
            </View>

            {etape !== 'succes' && (
              <View style={styles.progress}>
                {etapesVisibles.map((_, i) => (
                  <View key={i} style={[styles.progressSeg, { backgroundColor: i <= indexEtape ? Brand.accent : colors.border }]} />
                ))}
              </View>
            )}

            {etape === 'intro' && (
              <Reanimated.View key="intro" entering={FadeIn.duration(300)} exiting={FadeOutLeft.duration(200)}>
                <Illustration Icon={ShieldCheck} />
                <Text style={[displayFont(24, '800'), styles.titre, { color: colors.text }]}>Sécurisez votre compte</Text>
                <Text style={[bodyFont(14, '500'), styles.sousTitre, { color: colors.muted }]}>
                  Pour confirmer que c'est bien vous, nous allons envoyer un code à 6 chiffres à
                </Text>
                <View style={[styles.emailPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Mail size={15} color={Brand.accentLight} strokeWidth={2.4} />
                  <Text style={[bodyFont(14, '800'), { color: colors.text }]}>{user?.email}</Text>
                </View>
                {erreur && <ErrorNotice key={erreur.message} error={erreur} onRetry={envoyerCode} style={{ marginTop: 18 }} />}
                <BoutonPrincipal label="Recevoir le code" busy={busy} onPress={() => bloquer(envoyerCode)} />
              </Reanimated.View>
            )}

            {etape === 'code' && (
              <Reanimated.View key="code" entering={FadeInRight.duration(320)} exiting={FadeOutLeft.duration(200)}>
                <Illustration Icon={Mail} />
                <Text style={[displayFont(24, '800'), styles.titre, { color: colors.text }]}>Vérifiez vos e-mails</Text>
                <Text style={[bodyFont(14, '500'), styles.sousTitre, { color: colors.muted }]}>
                  Saisissez le code envoyé à <Text style={{ color: colors.text, fontWeight: '800' }}>{emailMasque}</Text>.
                  Pensez à regarder dans les spams.
                </Text>

                <SaisieCode
                  valeur={code} onChange={v => { setCode(v); if (erreur) setErreur(null); }} erreur={!!erreur} desactive={busy}
                  onComplet={v => { verifier(v); }}
                />

                {busy && <ActivityIndicator color={Brand.accent} style={{ marginTop: 16 }} />}
                {erreur && <ErrorNotice key={erreur.message} error={erreur} style={{ marginTop: 16 }} />}

                <View style={styles.renvoi}>
                  {renvoiDans > 0 ? (
                    <Text style={[bodyFont(13, '600'), { color: colors.faint }]}>
                      Renvoyer le code dans 0:{String(renvoiDans).padStart(2, '0')}
                    </Text>
                  ) : (
                    <PressableScale onPress={busy ? undefined : envoyerCode}>
                      <View style={styles.row}>
                        <RefreshCw size={14} color={Brand.accentLight} strokeWidth={2.5} />
                        <Text style={[bodyFont(13.5, '800'), { color: Brand.accentLight }]}>Renvoyer un code</Text>
                      </View>
                    </PressableScale>
                  )}
                </View>
              </Reanimated.View>
            )}

            {etape === 'nouveau' && (
              <Reanimated.View key="nouveau" entering={FadeInRight.duration(320)} exiting={FadeOutLeft.duration(200)}>
                <NouveauMotDePasse code={code} onSucces={() => setEtape('succes')} />
              </Reanimated.View>
            )}

            {etape === 'succes' && (
              <Reanimated.View key="succes" entering={FadeIn.duration(300)} style={{ alignItems: 'center', marginTop: 50 }}>
                <Reanimated.View entering={ZoomIn.springify().damping(11)}>
                  <LinearGradient colors={[Brand.green, Brand.greenDark]} style={[styles.succesRond, glow(Brand.green, 24)]}>
                    <Check size={52} color="#fff" strokeWidth={3} />
                  </LinearGradient>
                </Reanimated.View>
                <Text style={[displayFont(26, '800'), { color: colors.text, marginTop: 26 }]}>Mot de passe modifié</Text>
                <Text style={[bodyFont(14, '500'), styles.sousTitre, { color: colors.muted }]}>
                  Utilisez-le dès maintenant pour vous connecter. Un e-mail de confirmation vous a été envoyé.
                </Text>
                <View style={{ alignSelf: 'stretch' }}>
                  <BoutonPrincipal label="Terminé" onPress={() => router.back()} />
                </View>
              </Reanimated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBg>
  );
}

// ─── Saisie du code : 6 cases, un seul champ caché derrière ───
function SaisieCode({ valeur, onChange, onComplet, erreur, desactive }: {
  valeur: string; onChange: (v: string) => void; onComplet: (v: string) => void;
  erreur: boolean; desactive: boolean;
}) {
  const { colors } = useApp();
  const input = useRef<TextInput>(null);
  const [focus, setFocus] = useState(true);
  const secousse = useSharedValue(0);

  // Secousse quand le code est refusé
  useEffect(() => {
    if (!erreur) return;
    secousse.value = withSequence(
      withTiming(10, { duration: 50 }), withTiming(-10, { duration: 50 }),
      withTiming(8, { duration: 50 }), withTiming(-8, { duration: 50 }), withTiming(0, { duration: 50 }),
    );
  }, [erreur, secousse]);
  const secousseStyle = useAnimatedStyle(() => ({ transform: [{ translateX: secousse.value }] }));

  const changer = (texte: string) => {
    const v = texte.replace(/\D/g, '').slice(0, LONGUEUR_CODE);
    onChange(v);
    if (v.length === LONGUEUR_CODE) onComplet(v);
  };

  return (
    <Pressable onPress={() => input.current?.focus()} style={{ marginTop: 26 }}>
      <Reanimated.View style={[styles.cases, secousseStyle]}>
        {Array.from({ length: LONGUEUR_CODE }).map((_, i) => {
          const chiffre = valeur[i];
          const active = focus && i === Math.min(valeur.length, LONGUEUR_CODE - 1);
          return (
            <View
              key={i}
              style={[
                styles.case,
                { backgroundColor: colors.surface, borderColor: erreur ? Brand.danger : active ? Brand.accent : colors.border },
                active && glow(Brand.accent, 10),
              ]}
            >
              {chiffre
                ? <Reanimated.Text entering={ZoomIn.duration(140)} style={[displayFont(26, '800'), { color: colors.text }]}>{chiffre}</Reanimated.Text>
                : active && <Curseur />}
            </View>
          );
        })}
      </Reanimated.View>
      <TextInput
        ref={input}
        value={valeur}
        onChangeText={changer}
        editable={!desactive}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LONGUEUR_CODE}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={styles.inputCache}
        caretHidden
      />
    </Pressable>
  );
}

function Curseur() {
  const o = useSharedValue(1);
  useEffect(() => {
    const id = setInterval(() => { o.value = withTiming(o.value > 0.5 ? 0 : 1, { duration: 120 }); }, 530);
    return () => clearInterval(id);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Reanimated.View style={[styles.curseur, style]} />;
}

// ─── Étape 3 : nouveau mot de passe ──────────────────────────
function NouveauMotDePasse({ code, onSucces }: { code: string; onSucces: () => void }) {
  const { colors } = useApp();
  const [mdp, setMdp] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<ErrorInfo | null>(null);

  const criteres = [
    { ok: mdp.length >= 6, label: 'Au moins 6 caractères' },
    { ok: /[A-Za-z]/.test(mdp) && /\d/.test(mdp), label: 'Des lettres et des chiffres' },
    { ok: mdp.length > 0 && mdp === confirmation, label: 'Les deux saisies sont identiques' },
  ];
  const force = robustesse(mdp);
  const valide = criteres[0].ok && criteres[2].ok;

  const valider = async () => {
    if (!valide) return;
    setBusy(true); setErreur(null);
    try {
      await changerMotDePasse(code, mdp);
      onSucces();
    } catch (e) {
      setErreur(describeError(e, 'Le mot de passe n\'a pas pu être changé.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Illustration Icon={Lock} />
      <Text style={[displayFont(24, '800'), styles.titre, { color: colors.text }]}>Nouveau mot de passe</Text>
      <Text style={[bodyFont(14, '500'), styles.sousTitre, { color: colors.muted }]}>
        Code vérifié ✓ Choisissez un mot de passe que vous n'utilisez pas ailleurs.
      </Text>

      <ChampMdp valeur={mdp} onChange={setMdp} placeholder="Nouveau mot de passe" visible={visible} onBasculer={() => setVisible(v => !v)} autoFocus />
      {mdp.length > 0 && (
        <Reanimated.View entering={FadeIn} style={{ marginTop: 10 }}>
          <View style={styles.forceBarres}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.forceBarre, { backgroundColor: i < force.niveau ? force.couleur : colors.border }]} />
            ))}
          </View>
          <Text style={[bodyFont(12, '800'), { color: force.couleur, marginTop: 6 }]}>{force.libelle}</Text>
        </Reanimated.View>
      )}
      <View style={{ marginTop: 12 }}>
        <ChampMdp valeur={confirmation} onChange={setConfirmation} placeholder="Confirmer le mot de passe" visible={visible} onBasculer={() => setVisible(v => !v)} />
      </View>

      <View style={[styles.criteres, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {criteres.map(c => (
          <View key={c.label} style={[styles.row, { gap: 8 }]}>
            {c.ok
              ? <CircleCheck size={16} color={Brand.green} strokeWidth={2.4} />
              : <Circle size={16} color={colors.faint} strokeWidth={2} />}
            <Text style={[bodyFont(13, c.ok ? '700' : '500'), { color: c.ok ? colors.text : colors.muted }]}>{c.label}</Text>
          </View>
        ))}
      </View>

      {erreur && <ErrorNotice key={erreur.message} error={erreur} onRetry={valider} style={{ marginTop: 16 }} />}
      <BoutonPrincipal label="Changer le mot de passe" busy={busy} desactive={!valide} onPress={valider} />
    </>
  );
}

function robustesse(mdp: string): { niveau: number; libelle: string; couleur: string } {
  let score = 0;
  if (mdp.length >= 6) score++;
  if (mdp.length >= 10) score++;
  if (/[a-z]/.test(mdp) && /[A-Z]/.test(mdp)) score++;
  if (/\d/.test(mdp) && /[^A-Za-z0-9]/.test(mdp)) score++;
  if (mdp.length < 6) return { niveau: 1, libelle: 'Trop court', couleur: Brand.danger };
  return [
    { niveau: 1, libelle: 'Faible', couleur: Brand.danger },
    { niveau: 2, libelle: 'Moyen', couleur: Brand.yellow },
    { niveau: 3, libelle: 'Bon', couleur: '#4fc78a' },
    { niveau: 4, libelle: 'Excellent', couleur: Brand.green },
  ][Math.max(0, score - 1)];
}

function ChampMdp({ valeur, onChange, placeholder, visible, onBasculer, autoFocus }: {
  valeur: string; onChange: (v: string) => void; placeholder: string;
  visible: boolean; onBasculer: () => void; autoFocus?: boolean;
}) {
  const { colors } = useApp();
  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 18 }]}>
      <Lock size={17} color={Brand.accentLight} strokeWidth={2.2} />
      <TextInput
        value={valeur} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.faint}
        secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoFocus={autoFocus}
        textContentType="newPassword" autoComplete="password-new"
        style={[styles.fieldInput, { color: colors.text }]}
      />
      <PressableScale onPress={onBasculer} scaleTo={0.85}>
        {visible ? <EyeOff size={19} color={colors.muted} /> : <Eye size={19} color={colors.muted} />}
      </PressableScale>
    </View>
  );
}

function Illustration({ Icon }: { Icon: typeof ShieldCheck }) {
  return (
    <Reanimated.View entering={ZoomIn.springify().damping(13)} style={{ alignItems: 'center', marginTop: 30 }}>
      <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} style={[styles.illu, glow(Brand.accent, 22)]}>
        <Icon size={40} color="#fff" strokeWidth={2} />
      </LinearGradient>
    </Reanimated.View>
  );
}

function BoutonPrincipal({ label, onPress, busy, desactive }: {
  label: string; onPress: () => void; busy?: boolean; desactive?: boolean;
}) {
  return (
    <PressableScale onPress={busy || desactive ? undefined : onPress} style={{ marginTop: 26, opacity: desactive ? 0.5 : 1 }}>
      <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mainBtn, !desactive && glow(Brand.accent, 18)]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={[bodyFont(15.5, '800'), { color: '#fff' }]}>{label}</Text>}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 30, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progress: { flexDirection: 'row', gap: 6, marginTop: 20 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  illu: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  titre: { textAlign: 'center', marginTop: 22 },
  sousTitre: { textAlign: 'center', marginTop: 8, lineHeight: 21, paddingHorizontal: 6 },
  emailPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginTop: 14,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1,
  },
  cases: { flexDirection: 'row', justifyContent: 'center', gap: 9 },
  case: { width: 48, height: 60, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  curseur: { width: 2, height: 26, borderRadius: 1, backgroundColor: Brand.accent },
  inputCache: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  renvoi: { alignItems: 'center', marginTop: 24 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: 1 },
  fieldInput: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 14 },
  forceBarres: { flexDirection: 'row', gap: 5 },
  forceBarre: { flex: 1, height: 5, borderRadius: 3 },
  criteres: { marginTop: 16, padding: 14, borderRadius: 16, borderWidth: 1, gap: 9 },
  mainBtn: { paddingVertical: 16, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  succesRond: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center' },
});
