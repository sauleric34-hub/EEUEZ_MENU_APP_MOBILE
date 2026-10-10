// ═══════════════════════════════════════════════════════════
//  Envol vers le panier — au tap sur « + », une miniature du plat
//  décrit un arc jusqu'à l'onglet Panier, qui rebondit à l'arrivée.
//  Le fournisseur enveloppe les onglets client : écrans ET barre de
//  navigation partagent ainsi la même cible et le même calque.
// ═══════════════════════════════════════════════════════════

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Brand } from '../constants/theme';

interface Point { x: number; y: number }
interface FlightVisual { image?: string; grad: readonly [string, string] }
interface Flight extends FlightVisual { id: number; from: Point; to: Point }

interface FlyToCartValue {
  /** Lance un envol depuis un point de la fenêtre (centre du bouton « + »). */
  fly: (from: Point, visual: FlightVisual) => void;
  /** L'onglet Panier s'enregistre comme cible. */
  setTarget: (view: View | null) => void;
  /** S'incrémente à chaque atterrissage — l'onglet Panier rebondit dessus. */
  landings: number;
}

const FlyToCartContext = createContext<FlyToCartValue | null>(null);
const THUMB = 46;

/** Hors des onglets client (fiche resto…), pas de panier visible : renvoie null. */
export const useFlyToCart = () => useContext(FlyToCartContext);

export function FlyToCartProvider({ children }: { children: React.ReactNode }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [landings, setLandings] = useState(0);
  const targetRef = useRef<View | null>(null);
  const layerRef = useRef<View>(null);
  const idRef = useRef(0);

  const setTarget = useCallback((view: View | null) => { targetRef.current = view; }, []);

  const fly = useCallback((from: Point, visual: FlightVisual) => {
    const target = targetRef.current;
    const layer = layerRef.current;
    if (!target || !layer) return;
    // Tout est mesuré dans la fenêtre puis ramené au repère du calque
    // (sur web, l'app vit dans une colonne centrée : origine ≠ 0,0).
    layer.measureInWindow((lx, ly) => {
      target.measureInWindow((tx, ty, tw, th) => {
        if (!tw) return; // barre pas encore affichée
        idRef.current += 1;
        setFlights(list => [...list, {
          id: idRef.current, ...visual,
          from: { x: from.x - lx, y: from.y - ly },
          to: { x: tx + tw / 2 - lx, y: ty + th / 2 - ly },
        }]);
      });
    });
  }, []);

  const land = useCallback((id: number) => {
    setFlights(list => list.filter(f => f.id !== id));
    setLandings(n => n + 1);
  }, []);

  return (
    <FlyToCartContext.Provider value={{ fly, setTarget, landings }}>
      {children}
      <View ref={layerRef} pointerEvents="none" style={StyleSheet.absoluteFill}>
        {flights.map(f => <FlyingDish key={f.id} flight={f} onLand={land} />)}
      </View>
    </FlyToCartContext.Provider>
  );
}

function FlyingDish({ flight, onLand }: { flight: Flight; onLand: (id: number) => void }) {
  const p = useSharedValue(0);
  const { from, to, id } = flight;

  useEffect(() => {
    p.value = withTiming(1, { duration: 720, easing: Easing.inOut(Easing.cubic) }, finished => {
      if (finished) scheduleOnRN(onLand, id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const t = p.value;
    // Arc : monte d'abord, puis plonge vers l'onglet
    const lift = Math.sin(Math.PI * t) * 110;
    return {
      opacity: interpolate(t, [0, 0.85, 1], [1, 1, 0]),
      transform: [
        { translateX: from.x + (to.x - from.x) * t - THUMB / 2 },
        { translateY: from.y + (to.y - from.y) * t - lift - THUMB / 2 },
        { scale: interpolate(t, [0, 0.18, 1], [0.5, 1.15, 0.35]) },
        { rotate: `${interpolate(t, [0, 1], [0, 200])}deg` },
      ],
    };
  });

  return (
    <Reanimated.View style={[styles.thumb, style]}>
      <LinearGradient colors={flight.grad as [string, string]} style={StyleSheet.absoluteFill} />
      {flight.image && (
        <ExpoImage source={{ uri: flight.image }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      )}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    position: 'absolute', top: 0, left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    overflow: 'hidden', borderWidth: 2.5, borderColor: Brand.accent,
    shadowColor: Brand.accent, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
});
