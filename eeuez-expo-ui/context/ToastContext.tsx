// ═══════════════════════════════════════════════════════════
//  Toast global — remonte les échecs jusqu'ici silencieux
//  (réseau, géocodage, envoi…) sans que chaque écran ne réinvente
//  sa propre bannière d'erreur.
// ═══════════════════════════════════════════════════════════

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { Brand, Radius } from '../constants/theme';
import { bodyFont } from '../components/ui';

export type ToastType = 'error' | 'success' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
  error: (message: string) => void;
  success: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const DUREE_MS = 3200;

const STYLES_PAR_TYPE: Record<ToastType, { bg: string; Icon: typeof Info }> = {
  error: { bg: '#c23a3f', Icon: CircleAlert },
  success: { bg: Brand.green, Icon: CircleCheck },
  info: { bg: '#2a2a2a', Icon: Info },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    idRef.current += 1;
    setQueue(q => [...q, { id: idRef.current, message, type }]);
  }, []);
  const error = useCallback((message: string) => show(message, 'error'), [show]);
  const success = useCallback((message: string) => show(message, 'success'), [show]);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(anim, {
      toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => setCurrent(null));
  }, [anim]);

  // Fait entrer le prochain toast de la file dès que la place se libère.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...reste] = queue;
    setQueue(reste);
    setCurrent(next);
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
    timerRef.current = setTimeout(dismiss, DUREE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const { bg, Icon } = current ? STYLES_PAR_TYPE[current.type] : STYLES_PAR_TYPE.info;

  return (
    <ToastContext.Provider value={{ show, error, success }}>
      {children}
      {current && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.host,
            { bottom: insets.bottom + 78 },
            {
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            },
          ]}
        >
          <Pressable onPress={dismiss} style={[styles.toast, { backgroundColor: bg }]}>
            <Icon size={18} color="#fff" strokeWidth={2.3} />
            <Text numberOfLines={2} style={[bodyFont(13, '700'), styles.txt]}>{current.message}</Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13, borderRadius: Radius.md,
    maxWidth: 480, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 10,
  },
  txt: { color: '#fff', flex: 1 },
});
