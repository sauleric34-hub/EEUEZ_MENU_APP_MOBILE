// ═══════════════════════════════════════════════════════════
//  Livreur · Détail d'une course — pilotage complet
//  Démarrer → J'ai récupéré (QR + code) → attente confirmation
//  client. Filet de sécurité : « Livré sans confirmation ».
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Linking, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ChevronLeft, Phone, Store, MapPin, Navigation, XCircle } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, displayFont, bodyFont } from '../../components/ui';
import { LiveDeliveryMap } from '../../components/LiveDeliveryMap';
import { DeliveryQR } from '../../components/DeliveryQR';
import { useToast } from '../../context/ToastContext';
import {
  fetchMesCourses, departMission, recupererMission, livrerSansCode, abandonnerMission, pushPosition,
} from '../../services/livreur';
import type { CourseDTO, GeoPointDTO } from '../../services/dto';

export default function MissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const commandeId = Number(id);
  const { colors, mode } = useApp();
  const toast = useToast();
  const router = useRouter();

  const [course, setCourse] = useState<CourseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState<GeoPointDTO | null>(null);
  const [modal, setModal] = useState<null | 'sans_code' | 'abandon'>(null);
  const [motif, setMotif] = useState('');
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await fetchMesCourses();
      const c = all.find(x => x.id === commandeId) ?? null;
      setCourse(c);
      if (!c) toast.error('Cette course n\'est plus active.');
    } catch { /* garde l'état */ }
    finally { setLoading(false); }
  }, [commandeId, toast]);

  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [load]));

  const statut = course?.livraison.statut;

  // ─── GPS temps réel pendant la livraison (avant-plan) ──────
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (statut !== 'en_livraison') return;
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted' || cancelled) return;
      await activateKeepAwakeAsync('mission');
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 20 },
        pos => {
          const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setGps(p);
          pushPosition(commandeId, p.lat, p.lon).catch(() => {});
        },
      );
    }
    start();
    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
      deactivateKeepAwake('mission');
    };
  }, [statut, commandeId]);

  const call = (phone?: string) => {
    const n = (phone || '').replace(/[^\d+]/g, '');
    if (n) Linking.openURL(`tel:${n}`).catch(() => {});
  };
  const openMaps = (pt?: GeoPointDTO | null) => {
    if (!pt) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lon}`).catch(() => {});
  };

  const runAction = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast.success(okMsg); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Action impossible.'); }
    finally { setBusy(false); }
  };

  const confirmAbandon = () => {
    if (!motif.trim()) { toast.error('Indiquez un motif.'); return; }
    setModal(null);
    runAction(() => abandonnerMission(commandeId, motif.trim()), 'Mission rendue au pool.')
      .then(() => router.replace('/(livreur)/courses'));
  };
  const confirmSansCode = () => {
    if (!motif.trim()) { toast.error('Indiquez un motif.'); return; }
    setModal(null);
    runAction(() => livrerSansCode(commandeId, motif.trim()), 'Course clôturée — en attente de validation.');
  };

  if (loading) {
    return <ScreenBg><SafeAreaView style={s.center}><ActivityIndicator color={Brand.accent} /></SafeAreaView></ScreenBg>;
  }
  if (!course) {
    return (
      <ScreenBg><SafeAreaView style={s.center}>
        <Text style={[bodyFont(14, '600'), { color: colors.muted }]}>Course introuvable.</Text>
        <PressableScale onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={[bodyFont(14, '800'), { color: Brand.accentLight }]}>Retour</Text>
        </PressableScale>
      </SafeAreaView></ScreenBg>
    );
  }

  const suivi = course.suivi;
  const restoPos = suivi?.restaurant_position ?? null;
  const destPos = suivi?.destination ?? null;
  const client = course.client_details;
  const mapDriver = gps ?? suivi?.livreur_position ?? restoPos;
  const mapDest = statut === 'en_livraison' ? destPos : restoPos;

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <PressableScale onPress={() => router.back()}>
            <View style={[s.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ChevronLeft size={20} color={colors.text} />
            </View>
          </PressableScale>
          <Text style={[displayFont(20, '800'), { color: colors.text }]}>Course #{course.id}</Text>
        </View>

        <ScrollView contentContainerStyle={s.content}>
          <View style={[s.map, { borderColor: colors.border }]}>
            <LiveDeliveryMap driver={mapDriver} destination={mapDest} dark={mode === 'dark'} />
          </View>

          {/* Restaurant */}
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={s.row}><Store size={16} color={Brand.green} strokeWidth={2.3} />
              <Text style={[bodyFont(14.5, '700'), { color: colors.text }]}>{course.restaurant_details?.nom ?? 'Restaurant'}</Text>
            </View>
            <Text style={[bodyFont(12.5, '500'), { color: colors.muted, marginTop: 4 }]}>{course.restaurant_details?.adresse}</Text>
            {restoPos && (
              <PressableScale onPress={() => openMaps(restoPos)} style={{ marginTop: 8 }}>
                <View style={[s.linkBtn, { borderColor: colors.border }]}>
                  <Navigation size={14} color={Brand.accentLight} /><Text style={[bodyFont(12.5, '700'), { color: Brand.accentLight }]}>Y aller</Text>
                </View>
              </PressableScale>
            )}
          </View>

          {/* Client — visible seulement une fois la mission acceptée */}
          {client && (
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.row}><MapPin size={16} color={Brand.accent} strokeWidth={2.3} />
                <Text style={[bodyFont(14.5, '700'), { color: colors.text }]}>
                  {`${client.first_name} ${client.last_name}`.trim() || 'Client'}
                </Text>
              </View>
              <Text style={[bodyFont(12.5, '500'), { color: colors.muted, marginTop: 4 }]}>{course.adresse_livraison || '—'}</Text>
              <View style={[s.row, { marginTop: 10, gap: 8 }]}>
                {!!client.telephone && (
                  <PressableScale onPress={() => call(client.telephone)} style={{ flex: 1 }}>
                    <View style={[s.linkBtn, { borderColor: colors.border, justifyContent: 'center' }]}>
                      <Phone size={14} color={Brand.green} /><Text style={[bodyFont(12.5, '700'), { color: colors.text }]}>Appeler</Text>
                    </View>
                  </PressableScale>
                )}
                {destPos && (
                  <PressableScale onPress={() => openMaps(destPos)} style={{ flex: 1 }}>
                    <View style={[s.linkBtn, { borderColor: colors.border, justifyContent: 'center' }]}>
                      <Navigation size={14} color={Brand.accentLight} /><Text style={[bodyFont(12.5, '700'), { color: Brand.accentLight }]}>Itinéraire</Text>
                    </View>
                  </PressableScale>
                )}
              </View>
            </View>
          )}

          {/* Gain */}
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <Text style={[bodyFont(13, '600'), { color: colors.muted }]}>Votre gain sur cette course</Text>
            <Text style={[displayFont(18, '800'), { color: Brand.green }]}>+{Math.round(Number(course.part_livreur || 0))} F</Text>
          </View>

          {/* QR / code — dès la récupération */}
          {statut === 'en_livraison' && !!course.livraison.code_confirmation && (
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
              <Text style={[bodyFont(13, '700'), { color: colors.text, marginBottom: 12 }]}>
                À l'arrivée, faites confirmer la réception au client
              </Text>
              <DeliveryQR commandeId={course.id} code={course.livraison.code_confirmation} />
            </View>
          )}

          {statut === 'livree_sans_code' && (
            <View style={[s.card, { borderColor: Brand.yellow + '66', backgroundColor: Brand.yellow + '18' }]}>
              <Text style={[bodyFont(12.5, '700'), { color: Brand.yellow }]}>
                Course clôturée sans confirmation client. Votre paiement sera débloqué après validation par l'équipe.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Barre d'action */}
        {statut !== 'livree_sans_code' && (
          <View style={[s.actionBar, { backgroundColor: colors.nav, borderTopColor: colors.navBorder }]}>
            {statut === 'assignee' && (
              <PressableScale onPress={() => runAction(() => departMission(commandeId), 'En route vers le restaurant.')} disabled={busy} style={{ flex: 1 }}>
                <View style={[s.primary, { backgroundColor: Brand.accent }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Démarrer la course</Text>}
                </View>
              </PressableScale>
            )}
            {statut === 'en_collecte' && (
              <PressableScale onPress={() => runAction(() => recupererMission(commandeId), 'Commande récupérée — le client suit votre trajet.')} disabled={busy} style={{ flex: 1 }}>
                <View style={[s.primary, { backgroundColor: Brand.accent }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>J'ai récupéré la commande</Text>}
                </View>
              </PressableScale>
            )}
            {statut === 'en_livraison' && (
              <PressableScale onPress={() => { setMotif(''); setModal('sans_code'); }} disabled={busy} style={{ flex: 1 }}>
                <View style={[s.secondary, { borderColor: colors.border }]}>
                  <Text style={[bodyFont(13.5, '800'), { color: colors.text }]}>Livré sans confirmation</Text>
                </View>
              </PressableScale>
            )}
            {(statut === 'assignee' || statut === 'en_collecte' || statut === 'en_livraison') && (
              <PressableScale onPress={() => { setMotif(''); setModal('abandon'); }} disabled={busy}>
                <View style={[s.iconBtn, { borderColor: Brand.danger + '55' }]}>
                  <XCircle size={20} color={Brand.danger} />
                </View>
              </PressableScale>
            )}
          </View>
        )}

        <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => setModal(null)}>
          <View style={s.modalScrim}>
            <View style={[s.modalBox, { backgroundColor: colors.page, borderColor: colors.border }]}>
              <Text style={[displayFont(17, '800'), { color: colors.text }]}>
                {modal === 'abandon' ? 'Abandonner la mission ?' : 'Livrer sans confirmation ?'}
              </Text>
              <Text style={[bodyFont(12.5, '500'), { color: colors.muted, marginTop: 6 }]}>
                {modal === 'abandon'
                  ? 'La commande retourne au pool. Les abandons répétés peuvent suspendre votre compte.'
                  : 'À n\'utiliser que si le client est injoignable ou refuse de confirmer. Le paiement sera gelé jusqu\'à validation par l\'équipe.'}
              </Text>
              <TextInput
                value={motif} onChangeText={setMotif}
                placeholder="Motif" placeholderTextColor={colors.faint}
                style={[s.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                multiline
              />
              <View style={[s.row, { gap: 10, marginTop: 14 }]}>
                <PressableScale onPress={() => setModal(null)} style={{ flex: 1 }}>
                  <View style={[s.secondary, { borderColor: colors.border }]}><Text style={[bodyFont(13.5, '700'), { color: colors.muted }]}>Annuler</Text></View>
                </PressableScale>
                <PressableScale onPress={modal === 'abandon' ? confirmAbandon : confirmSansCode} style={{ flex: 1 }}>
                  <View style={[s.primary, { backgroundColor: modal === 'abandon' ? Brand.danger : Brand.accent }]}>
                    <Text style={s.primaryTxt}>Confirmer</Text>
                  </View>
                </PressableScale>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ScreenBg>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 14 },
  map: { height: 200, borderRadius: 22, overflow: 'hidden', borderWidth: 1, marginTop: 8 },
  card: { padding: 16, borderRadius: 18, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: Radius.pill, borderWidth: 1 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 28, borderTopWidth: 1 },
  primary: { paddingVertical: 15, borderRadius: Radius.pill, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
  secondary: { paddingVertical: 14, borderRadius: Radius.pill, alignItems: 'center', borderWidth: 1 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalBox: { borderRadius: 22, borderWidth: 1, padding: 22 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14, minHeight: 64, textAlignVertical: 'top' },
});
