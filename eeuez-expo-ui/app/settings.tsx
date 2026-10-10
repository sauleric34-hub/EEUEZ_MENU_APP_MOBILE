// ═══════════════════════════════════════════════════════════
//  Paramètres — préférences réelles (thème, notifications…)
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Linking, Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, ChevronRight, Moon, Bell, Tag, User, Mail, Phone,
  TriangleAlert, ShieldCheck, CircleHelp, Info, LogOut, Pencil, MapPin, Trash2, KeyRound, type LucideIcon,
} from 'lucide-react-native';
import { Brand, Radius } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { ScreenBg } from '../components/ScreenBg';
import { PressableScale, displayFont, bodyFont } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useGardeDemo } from '../hooks/useGardeDemo';
import { deleteAccount } from '../services/auth';
import { WEB_BASE_URL } from '../constants/api';
import { friendlyMessage } from '../services/errors';
import { useDeconnexion } from '../hooks/useDeconnexion';
import { appleDisponible, googleDisponible, obtenirJeton, type Fournisseur } from '../services/socialAuth';

const APP_VERSION = '1.0.0';
const SUPPORT_EMAIL = 'menu@cambus.cm';
// Pages publiques déclarées dans la Play Console (voir backend/templates/legal).
const URL_CONFIDENTIALITE = `${WEB_BASE_URL}/confidentialite/`;

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={[bodyFont(12, '800'), { color: colors.faint, letterSpacing: 1, marginBottom: 10 }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({ Icon, iconColor, label, value, onPress, right, colors, last }: {
  Icon: LucideIcon; iconColor?: string; label: string; value?: string;
  onPress?: () => void; right?: React.ReactNode; colors: any; last?: boolean;
}) {
  const body = (
    <View style={[styles.rowItem, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: (iconColor ?? Brand.accent) + '1c' }]}>
        <Icon size={17} color={iconColor ?? Brand.accentLight} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[bodyFont(14, '700'), { color: colors.text }]}>{label}</Text>
        {value != null && <Text numberOfLines={1} style={[bodyFont(12, '500'), { color: colors.muted, marginTop: 2 }]}>{value}</Text>}
      </View>
      {right ?? (onPress && <ChevronRight size={18} color={colors.faint} />)}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress} scaleTo={0.98}>{body}</PressableScale> : body;
}

export default function SettingsScreen() {
  const {
    colors, mode, toggleTheme, user,
    notifsEnabled, setNotifsEnabled, promoEnabled, setPromoEnabled,
  } = useApp();
  const toast = useToast();
  const router = useRouter();
  const { bloquer } = useGardeDemo();
  const deconnecter = useDeconnexion();

  // ─── Suppression de compte (exigence Google Play) ─────────
  const [suppressionOuverte, setSuppressionOuverte] = useState(false);
  const [motDePasse, setMotDePasse] = useState('');
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  // Compte créé via Google/Apple : pas de mot de passe à redemander, on
  // redemande à la place une connexion au fournisseur.
  const sansMotDePasse = user?.a_mot_de_passe === false;
  const [appleOk, setAppleOk] = useState(false);
  useEffect(() => { appleDisponible().then(setAppleOk); }, []);

  const fermerSuppression = () => {
    if (suppressionEnCours) return;
    setSuppressionOuverte(false);
    setMotDePasse('');
    setErreurSuppression(null);
  };

  const confirmerSuppression = async (fournisseur?: Fournisseur) => {
    if (suppressionEnCours) return;
    if (!fournisseur && !motDePasse) { setErreurSuppression('Saisissez votre mot de passe.'); return; }
    setSuppressionEnCours(true);
    setErreurSuppression(null);
    try {
      if (fournisseur) {
        const jeton = await obtenirJeton(fournisseur);
        if (!jeton) return; // fenêtre Google/Apple fermée
        await deleteAccount(jeton);
      } else {
        await deleteAccount({ password: motDePasse });
      }
      setSuppressionOuverte(false);
      await deconnecter();
      toast.success('Votre compte a été supprimé.');
    } catch (e) {
      setErreurSuppression(friendlyMessage(e, 'La suppression a échoué.'));
    } finally {
      setSuppressionEnCours(false);
      setMotDePasse('');
    }
  };

  const switchColors = {
    trackColor: { false: colors.surface2, true: Brand.accent + '88' },
    thumbColor: Brand.accent,
  };

  const logout = () => {
    // Action irréversible en un seul tap : une confirmation s'impose.
    Alert.alert(
      'Se déconnecter ?',
      'Vous devrez ressaisir vos identifiants pour retrouver votre compte.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: deconnecter,
        },
      ],
    );
  };

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <PressableScale onPress={() => router.back()}>
              <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ChevronLeft size={20} color={colors.text} />
              </View>
            </PressableScale>
            <Text style={[displayFont(24, '800'), { color: colors.text }]}>Paramètres</Text>
          </View>

          <Section title="Compte" colors={colors}>
            <Row Icon={User} label="Nom" value={user ? `${user.first_name} ${user.last_name}`.trim() || user.username : '—'} colors={colors} />
            <Row Icon={Mail} label="Email" value={user?.email || '—'} colors={colors} />
            <Row Icon={Phone} label="Téléphone" value={user?.telephone || 'Non renseigné'} colors={colors} />
            <Row Icon={TriangleAlert} iconColor={Brand.yellow} label="Allergies" value={user?.allergies || 'Aucune enregistrée'} colors={colors} />
            <Row Icon={Pencil} label="Modifier mes informations" colors={colors} onPress={() => router.push('/edit-profile')} />
            <Row Icon={MapPin} label="Mes lieux de livraison" colors={colors} onPress={() => router.push('/location-picker')} last />
          </Section>

          <Section title="Sécurité" colors={colors}>
            <Row
              Icon={KeyRound} iconColor={Brand.green}
              label={sansMotDePasse ? 'Définir un mot de passe' : 'Changer mon mot de passe'}
              value="Vérification par code envoyé par e-mail" colors={colors} last
              onPress={() => router.push('/change-password')}
            />
          </Section>

          <Section title="Préférences" colors={colors}>
            <Row
              Icon={Moon} label="Mode sombre" colors={colors}
              right={<Switch value={mode === 'dark'} onValueChange={toggleTheme} {...switchColors} />}
            />
            <Row
              Icon={Bell} label="Notifications de commande" colors={colors}
              right={<Switch value={notifsEnabled} onValueChange={setNotifsEnabled} {...switchColors} />}
            />
            <Row
              Icon={Tag} label="Offres et promotions" colors={colors} last
              right={<Switch value={promoEnabled} onValueChange={setPromoEnabled} {...switchColors} />}
            />
          </Section>

          <Section title="Assistance" colors={colors}>
            <Row
              Icon={CircleHelp} iconColor={Brand.green} label="Aide & support"
              value={SUPPORT_EMAIL} colors={colors}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => toast.error(`Aucune messagerie configurée. Écrivez-nous à ${SUPPORT_EMAIL}.`))}
            />
            <Row
              Icon={ShieldCheck} iconColor={Brand.green} label="Politique de confidentialité" colors={colors}
              onPress={() => Linking.openURL(URL_CONFIDENTIALITE).catch(() => toast.error(URL_CONFIDENTIALITE))}
            />
            <Row Icon={Info} iconColor={Brand.green} label="Version de l'application" value={APP_VERSION} colors={colors} last />
          </Section>

          <PressableScale onPress={logout} style={{ marginTop: 28 }}>
            <View style={[styles.logout, { backgroundColor: Brand.danger + '14', borderColor: Brand.danger + '33' }]}>
              <LogOut size={18} color="#ff6b70" strokeWidth={2.3} />
              <Text style={[bodyFont(14.5, '800'), { color: '#ff6b70' }]}>Se déconnecter</Text>
            </View>
          </PressableScale>

          <PressableScale onPress={() => bloquer(() => setSuppressionOuverte(true))} style={{ marginTop: 14 }}>
            <View style={styles.supprimer}>
              <Trash2 size={16} color={colors.muted} strokeWidth={2.2} />
              <Text style={[bodyFont(13, '700'), { color: colors.muted }]}>Supprimer mon compte</Text>
            </View>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={suppressionOuverte} transparent animationType="fade" onRequestClose={fermerSuppression}>
        <View style={styles.modalFond}>
          <View style={[styles.modalCarte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[displayFont(18, '800'), { color: colors.text }]}>Supprimer mon compte ?</Text>
            <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 8, lineHeight: 19 }]}>
              Cette action est définitive. Vos informations personnelles, adresses, messages, publications et
              points de fidélité seront effacés. L'historique de vos paiements est conservé de façon anonyme.
            </Text>
            {sansMotDePasse ? (
              <>
                <Text style={[bodyFont(13, '600'), { color: colors.text, marginTop: 14 }]}>
                  Pour confirmer, reconnectez-vous avec le compte utilisé pour vous inscrire.
                </Text>
                {googleDisponible && (
                  <PressableScale onPress={() => confirmerSuppression('google')} style={{ marginTop: 12 }}>
                    <View style={[styles.modalBtn, { backgroundColor: Brand.danger }]}>
                      {suppressionEnCours
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>Supprimer avec Google</Text>}
                    </View>
                  </PressableScale>
                )}
                {appleOk && (
                  <PressableScale onPress={() => confirmerSuppression('apple')} style={{ marginTop: 10 }}>
                    <View style={[styles.modalBtn, { backgroundColor: Brand.danger }]}>
                      {suppressionEnCours
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>Supprimer avec Apple</Text>}
                    </View>
                  </PressableScale>
                )}
              </>
            ) : (
              <TextInput
                value={motDePasse}
                onChangeText={setMotDePasse}
                placeholder="Mot de passe"
                placeholderTextColor={colors.faint}
                secureTextEntry
                autoCapitalize="none"
                editable={!suppressionEnCours}
                style={[styles.champ, bodyFont(14, '600'), { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface2 }]}
              />
            )}
            {erreurSuppression && (
              <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', marginTop: 8 }]}>{erreurSuppression}</Text>
            )}
            <View style={styles.modalActions}>
              <PressableScale onPress={fermerSuppression} style={{ flex: 1 }}>
                <View style={[styles.modalBtn, { backgroundColor: colors.surface2 }]}>
                  <Text style={[bodyFont(14, '700'), { color: colors.text }]}>Annuler</Text>
                </View>
              </PressableScale>
              {!sansMotDePasse && (
                <PressableScale onPress={() => confirmerSuppression()} style={{ flex: 1 }}>
                  <View style={[styles.modalBtn, { backgroundColor: Brand.danger }]}>
                    {suppressionEnCours
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>Supprimer</Text>}
                  </View>
                </PressableScale>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  section: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  supprimer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12 },
  modalFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCarte: { borderRadius: 22, borderWidth: 1, padding: 20 },
  champ: { marginTop: 16, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: Radius.pill, minHeight: 46 },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: Radius.pill, borderWidth: 1,
  },
});
