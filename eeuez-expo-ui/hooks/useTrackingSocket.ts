// ═══════════════════════════════════════════════════════════
//  Suivi en direct — canal WebSocket (bonus) au-dessus du polling.
//  Le serveur pousse un simple signal « ça a changé » à chaque étape
//  (commande acceptée, livreur assigné, livraison démarrée, position du
//  livreur, livraison terminée) ; on réagit en rechargeant la commande.
//  Pur bonus : si la connexion échoue (WebSocket non routé côté serveur,
//  réseau instable…), on retente avec un backoff sans jamais bloquer —
//  l'appelant garde son propre polling comme filet de sécurité garanti.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_WS_URL, AUTH_TOKEN_KEY } from '../constants/api';

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

export function useTrackingSocket(orderId: number | null, active: boolean, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!active || orderId == null) return undefined;

    let stopped = false;
    let attempt = 0;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (stopped) return;
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (stopped || !token) return;
      const url = `${API_WS_URL}/topic/commande/${orderId}/tracking?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      socket = ws;
      ws.onopen = () => { attempt = 0; };
      ws.onmessage = () => onUpdateRef.current();
      // Pas de gestion d'erreur applicative ici : `onclose` suit toujours
      // `onerror` côté WebSocket et déclenche déjà la reconnexion.
      ws.onerror = () => {};
      ws.onclose = () => {
        if (stopped) return;
        const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };
    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [orderId, active]);
}
