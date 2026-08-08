// ═══════════════════════════════════════════════════════════
//  Mes réservations — statut, paiement (une fois acceptée), ticket
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, CalendarCheck, Users, Clock, CreditCard, Ticket, Hourglass, Check, X } from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { ScreenBg } from '../components/ScreenBg';
import { PressableScale, CascadeReveal, CenterMessage, displayFont, bodyFont } from '../components/ui';
import { CamerPayWebView } from '../components/CamerPayWebView';
import { fetchReservations, payReservation, openTicket } from '../services/reservations';
import { formatPrice } from '../data/menuData';
import type { ReservationDTO } from '../services/dto';

const STATUT_UI: Record<string, { label: string; color: string; Icon: typeof Check }> = {
  en_attente: { label: "En attente d'acceptation", color: Brand.yellow, Icon: Hourglass },
  acceptee:   { label: 'Acceptée — à payer', color: '#8fd6a8', Icon: Check },
  refusee:    { label: 'Refusée', color: Brand.danger, Icon: X },
  payee:      { label: 'Payée', color: Brand.green, Icon: Ticket },
  annulee:    { label: 'Annulée', color: Brand.danger, Icon: X },
};

export default function ReservationsScreen() {
  const { colors, user } = useApp();
  const router = useRouter();
  const [list, setList] = useState<ReservationDTO[] | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Distinct du chargement initial (list === null) : reflète le pull-to-refresh
  // manuel, pour que l'indicateur natif du RefreshControl s'affiche vraiment.
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setList(await fetchReservations()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.'); setList([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pay = async (r: ReservationDTO) => {
    setBusyId(r.id); setError(null);
    try {
      const data = await payReservation(r.id, user?.telephone || undefined);
      if (data.payment_url) {
        setPaymentUrl(data.payment_url);   // paiement CamerPay
      } else {
        await load();                       // réservation gratuite → confirmée directement
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paiement indisponible.');
    } finally {
      setBusyId(null);
    }
  };

  const ticket = async (r: ReservationDTO) => {
    setBusyId(r.id); setError(null);
    try { await openTicket(r.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ticket indisponible.'); }
    finally { setBusyId(null); }
  };

  return (
    <>
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()}>
            <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ChevronLeft size={20} color={colors.text} />
            </View>
          </PressableScale>
          <Text style={[displayFont(24, '800'), { color: colors.text }]}>Mes réservations</Text>
        </View>

        {list === null ? (
          <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <CenterMessage Icon={CalendarCheck} colors={colors} title="Aucune réservation" subtitle="Réservez une table depuis la page d'un restaurant." />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.accent} />}
          >
            {error && <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', marginBottom: 12 }]}>{error}</Text>}
            {list.map((r, i) => {
              const ui = STATUT_UI[r.statut] ?? STATUT_UI.en_attente;
              return (
              <CascadeReveal key={r.id} index={i}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.row}>
                    <Text style={[displayFont(16, '800'), { color: colors.text, flex: 1 }]}>{r.restaurant_nom || 'Restaurant'}</Text>
                    <View style={[styles.badge, { backgroundColor: ui.color + '22' }]}>
                      <View style={[styles.badgeDot, { backgroundColor: ui.color }]} />
                      <ui.Icon size={13} color={ui.color} strokeWidth={2.4} />
                      <Text style={[bodyFont(11.5, '800'), { color: ui.color }]}>{ui.label}</Text>
                    </View>
                  </View>

                  <View style={styles.infoGrid}>
                    <View style={styles.info}><CalendarCheck size={14} color={colors.muted} strokeWidth={2.2} /><Text style={[bodyFont(12.5, '600'), { color: colors.muted }]}>{new Date(r.date_reservation).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</Text></View>
                    <View style={styles.info}><Users size={14} color={colors.muted} strokeWidth={2.2} /><Text style={[bodyFont(12.5, '600'), { color: colors.muted }]}>{r.nombre_personnes} place(s)</Text></View>
                    <View style={styles.info}><Clock size={14} color={colors.muted} strokeWidth={2.2} /><Text style={[bodyFont(12.5, '600'), { color: colors.muted }]}>{r.nom}</Text></View>
                    <View style={styles.info}><CreditCard size={14} color={Brand.accentLight} strokeWidth={2.2} /><Text style={[bodyFont(12.5, '800'), { color: Brand.accentLight }]}>{formatPrice(r.prix)}</Text></View>
                  </View>

                  {r.statut === 'acceptee' && (
                    <PressableScale onPress={() => pay(r)} style={{ marginTop: 14 }}>
                      <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btn, glow(Brand.accent, 16)]}>
                        {busyId === r.id ? <ActivityIndicator color="#fff" /> : (
                          <>
                            {r.prix > 0 ? <CreditCard size={18} color="#fff" strokeWidth={2.4} /> : <Check size={18} color="#fff" strokeWidth={2.6} />}
                            <Text style={[bodyFont(14.5, '800'), { color: '#fff' }]}>
                              {r.prix > 0 ? `Payer ${formatPrice(r.prix)}` : 'Confirmer (gratuit)'}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </PressableScale>
                  )}
                  {r.statut === 'payee' && (
                    <PressableScale onPress={() => ticket(r)} style={{ marginTop: 14 }}>
                      <View style={[styles.btn, { backgroundColor: Brand.green + '1f', borderWidth: 1.5, borderColor: Brand.green + '66' }]}>
                        {busyId === r.id ? <ActivityIndicator color={Brand.green} /> : (
                          <><Ticket size={18} color="#8fd6a8" strokeWidth={2.4} /><Text style={[bodyFont(14, '800'), { color: '#8fd6a8' }]}>Télécharger le ticket</Text></>
                        )}
                      </View>
                    </PressableScale>
                  )}
                </View>
              </CascadeReveal>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </ScreenBg>

    {paymentUrl && (
      <CamerPayWebView
        paymentUrl={paymentUrl}
        onSuccess={() => { setPaymentUrl(null); load(); }}
        onCancel={() => { setPaymentUrl(null); setError('Paiement annulé. Vous pouvez réessayer.'); }}
      />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { padding: 16, borderRadius: 22, borderWidth: 1, marginBottom: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '45%' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.pill },
});
