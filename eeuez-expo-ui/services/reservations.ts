// ═══════════════════════════════════════════════════════════
//  Réservations de table (création, liste, paiement, ticket PDF)
// ═══════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiGet, apiPost, ApiError } from './http';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '../constants/api';
import type { ReservationDTO, MonetbilPaymentDTO } from './dto';

export interface NewReservation {
  restaurant: number;
  nom: string;
  date_reservation: string;   // ISO « YYYY-MM-DDTHH:MM »
  nombre_personnes: number;
  notes?: string;
}

export const createReservation = (r: NewReservation) =>
  apiPost<ReservationDTO>('/client/reservations', r, { auth: true });

export const fetchReservations = () =>
  apiGet<ReservationDTO[]>('/client/reservations', { auth: true });

export const payReservation = (id: number, phone?: string) =>
  apiPost<MonetbilPaymentDTO>(`/client/reservations/${id}/payer`, { phone }, { auth: true });

/** Télécharge le ticket PDF (avec le jeton) puis ouvre le partage système. */
export async function openTicket(id: number): Promise<void> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const target = `${FileSystem.documentDirectory}ticket-reservation-${id}.pdf`;
  const res = await FileSystem.downloadAsync(
    `${API_BASE_URL}/client/reservations/${id}/ticket`,
    target,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (res.status !== 200) {
    throw new ApiError('Ticket indisponible pour le moment.', res.status);
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(res.uri, { mimeType: 'application/pdf', dialogTitle: 'Ticket de réservation' });
  }
}
