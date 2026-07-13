// ═══════════════════════════════════════════════════════════
//  Modal de réservation de table
//  Nom (pré-rempli), date (calendrier), heure (horloge), places
//  → crée une réservation en attente (payable une fois acceptée).
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { X, CalendarCheck, Users, Clock, User as UserIcon, TriangleAlert, Check } from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { createReservation } from '../services/reservations';
import { formatPrice } from '../data/menuData';
import { PressableScale, displayFont, bodyFont } from './ui';

interface Props {
  visible: boolean;
  restaurantId: number;
  restaurantNom: string;
  prix: number;
  onClose: () => void;
  onDone: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

function defaultWhen(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);   // demain
  d.setHours(19, 0, 0, 0);       // 19h00
  return d;
}

export function ReservationModal({ visible, restaurantId, restaurantNom, prix, onClose, onDone }: Props) {
  const { colors, user } = useApp();
  const defaultName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || '';
  const [nom, setNom] = useState(defaultName);
  const [when, setWhen] = useState<Date>(defaultWhen);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [places, setPlaces] = useState('2');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    setPickerMode(null);   // Android : le dialog se referme
    if (event.type === 'set' && selected) setWhen(selected);
  };

  const dateLabel = when.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
  const timeLabel = when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const submit = async () => {
    if (!nom.trim()) { setError('Indiquez le nom de la réservation.'); return; }
    if (when.getTime() < Date.now()) { setError('Choisissez une date et une heure à venir.'); return; }
    const nb = Math.max(1, parseInt(places, 10) || 1);
    const iso = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
    setBusy(true); setError(null);
    try {
      await createReservation({
        restaurant: restaurantId, nom: nom.trim(),
        date_reservation: iso, nombre_personnes: nb, notes: notes.trim(),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réservation impossible. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[displayFont(21, '800'), { color: colors.text }]}>Réserver une table</Text>
                  <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 2 }]}>{restaurantNom}</Text>
                </View>
                <PressableScale onPress={onClose}>
                  <View style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <X size={20} color={colors.text} />
                  </View>
                </PressableScale>
              </View>

              <View style={[styles.priceBox, { backgroundColor: Brand.accent + '12', borderColor: Brand.accent + '44' }]}>
                <Text style={[bodyFont(13, '600'), { color: colors.muted }]}>Prix de la réservation</Text>
                <Text style={[displayFont(18, '800'), { color: prix > 0 ? Brand.accentLight : '#8fd6a8' }]}>
                  {prix > 0 ? formatPrice(prix) : 'Gratuit'}
                </Text>
              </View>
              <Text style={[bodyFont(12, '500'), { color: colors.faint, marginTop: 8, lineHeight: 17 }]}>
                {prix > 0
                  ? <>Le paiement se fera une fois la réservation <Text style={{ color: '#8fd6a8', fontWeight: '800' }}>acceptée</Text> par le restaurant.</>
                  : <>Réservation gratuite : confirmée dès qu'elle est <Text style={{ color: '#8fd6a8', fontWeight: '800' }}>acceptée</Text> par le restaurant.</>}
              </Text>

              <Field Icon={UserIcon} colors={colors} value={nom} onChangeText={setNom} placeholder="Nom de la réservation" />

              {/* Date & heure — sélecteurs natifs */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <PressableScale onPress={() => setPickerMode('date')} style={{ flex: 1.5 }}>
                  <View style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <CalendarCheck size={17} color={Brand.accentLight} strokeWidth={2.2} />
                    <View style={{ flex: 1 }}>
                      <Text style={[bodyFont(10.5, '700'), { color: colors.faint }]}>DATE</Text>
                      <Text numberOfLines={1} style={[bodyFont(13.5, '700'), { color: colors.text }]}>{dateLabel}</Text>
                    </View>
                  </View>
                </PressableScale>
                <PressableScale onPress={() => setPickerMode('time')} style={{ flex: 1 }}>
                  <View style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Clock size={17} color={Brand.accentLight} strokeWidth={2.2} />
                    <View style={{ flex: 1 }}>
                      <Text style={[bodyFont(10.5, '700'), { color: colors.faint }]}>HEURE</Text>
                      <Text style={[bodyFont(13.5, '700'), { color: colors.text }]}>{timeLabel}</Text>
                    </View>
                  </View>
                </PressableScale>
              </View>

              <Field Icon={Users} colors={colors} value={places} onChangeText={setPlaces} placeholder="Nombre de places" keyboardType="number-pad" />
              <TextInput
                value={notes} onChangeText={setNotes}
                placeholder="Note (facultatif : occasion, préférences…)" placeholderTextColor={colors.faint}
                style={[styles.notes, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                multiline
              />

              {error && (
                <View style={styles.errRow}>
                  <TriangleAlert size={15} color={Brand.danger} strokeWidth={2.3} />
                  <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', flex: 1 }]}>{error}</Text>
                </View>
              )}

              <PressableScale onPress={busy ? undefined : submit} style={{ marginTop: 18 }}>
                <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.submit, glow(Brand.accent, 20)]}>
                  {busy ? <ActivityIndicator color="#fff" /> : (
                    <><Check size={19} color="#fff" strokeWidth={2.7} /><Text style={[bodyFont(15.5, '800'), { color: '#fff' }]}>Envoyer la demande</Text></>
                  )}
                </LinearGradient>
              </PressableScale>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>

      {pickerMode && (
        <DateTimePicker
          value={when}
          mode={pickerMode}
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={pickerMode === 'date' ? new Date() : undefined}
          onChange={onPickerChange}
        />
      )}
    </Modal>
  );
}

function Field({ Icon, colors, ...inputProps }: { Icon: typeof UserIcon; colors: any } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon size={17} color={Brand.accentLight} strokeWidth={2.2} />
      <TextInput placeholderTextColor={colors.faint} style={[styles.fieldInput, { color: colors.text }]} {...inputProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  priceBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, borderWidth: 1, marginTop: 18 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, borderRadius: Radius.md, borderWidth: 1, marginTop: 12 },
  fieldInput: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 14 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1 },
  notes: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '500', marginTop: 12, minHeight: 70, textAlignVertical: 'top' },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 4 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radius.pill },
});
