/**
 * EEUEZ — Composants d'animation d'interface
 *
 * • PressableScale   — Rebond scale quand on appuie sur un bouton
 * • EmojiPop         — Emoji qui jaillit vers le haut et disparaît
 * • ConfettiBurst    — Explosion de particules colorées
 * • FloatingReaction — Emoji qui monte en flottant (style réseaux sociaux)
 * • ShakeAnimation   — Secousse pour les erreurs
 * • PulseRing        — Anneau de pulsation autour d'un élément
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, Animated, TouchableWithoutFeedback,
  StyleSheet, ViewStyle,
} from 'react-native';

// ─────────────────────────────────────────────────────────────
// 1. PressableScale — Le bouton se contracte puis rebondit
// ─────────────────────────────────────────────────────────────
interface PressableScaleProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
  scaleDown?: number;   // ex: 0.90
  disabled?: boolean;
}

export function PressableScale({
  onPress, children, style, scaleDown = 0.92, disabled = false
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: scaleDown, tension: 300, friction: 10, useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1, tension: 200, friction: 7, useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : handlePressIn}
      onPressOut={disabled ? undefined : handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. EmojiPop — Un emoji surgit du point cliqué puis disparaît
// ─────────────────────────────────────────────────────────────
interface EmojiPopProps {
  emoji: string;
  visible: boolean;
  onDone?: () => void;
  size?: number;
}

export function EmojiPop({ emoji, visible, onDone, size = 40 }: EmojiPopProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    // Reset
    translateY.setValue(0);
    opacity.setValue(1);
    scale.setValue(0);

    Animated.sequence([
      // Pop in
      Animated.spring(scale, { toValue: 1.3, tension: 200, friction: 7, useNativeDriver: true }),
      // Remonte
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 0.8, tension: 80, friction: 8, useNativeDriver: true }),
      ]),
    ]).start(() => onDone?.());
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.emojiPop, {
        transform: [{ translateY }, { scale }],
        opacity,
      }]}
    >
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. ConfettiBurst — Explosion de 24 particules colorées
// ─────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#FFB224', '#4F8EF7', '#00D68F', '#FF4757', '#8B5CF6', '#FF6B9D', '#00D4FF'];
const PARTICLE_COUNT = 24;

interface ConfettiParticleProps {
  color: string;
  angle: number;   // radians
  speed: number;   // distance
  delay: number;
  shape: 'circle' | 'square' | 'star';
}

function ConfettiParticle({ color, angle, speed, delay, shape }: ConfettiParticleProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const tx = Math.cos(angle) * speed;
  const ty = Math.sin(angle) * speed;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: shape === 'star' ? 10 : 8,
        height: shape === 'square' ? 8 : 8,
        borderRadius: shape === 'circle' ? 4 : shape === 'square' ? 2 : 0,
        backgroundColor: color,
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, tx] }) },
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, ty] }) },
          { scale: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1.4, 0.5] }) },
          { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 * (Math.random() > 0.5 ? 1 : -1)}deg`] }) },
        ],
      }}
    />
  );
}

interface ConfettiBurstProps {
  visible: boolean;
  onDone?: () => void;
}

export function ConfettiBurst({ visible, onDone }: ConfettiBurstProps) {
  const [particles, setParticles] = useState<ConfettiParticleProps[]>([]);

  useEffect(() => {
    if (!visible) return;
    const shapes: ConfettiParticleProps['shape'][] = ['circle', 'square', 'star'];
    const newParticles: ConfettiParticleProps[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      speed: 50 + Math.random() * 70,
      delay: Math.random() * 80,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => { setParticles([]); onDone?.(); }, 1000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (particles.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.confettiContainer}>
      {particles.map((p, i) => <ConfettiParticle key={i} {...p} />)}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. FloatingReaction — Emoji qui monte en flottant (style Like)
// ─────────────────────────────────────────────────────────────
interface FloatingReactionProps {
  emoji: string;
  visible: boolean;
  onDone?: () => void;
}

export function FloatingReaction({ emoji, visible, onDone }: FloatingReactionProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const offsetX = (Math.random() - 0.5) * 40;
    translateY.setValue(0);
    translateX.setValue(offsetX);
    opacity.setValue(0);
    scale.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.2, tension: 300, friction: 6, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 1000, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.spring(scale, { toValue: 0.9, tension: 40, friction: 8, useNativeDriver: true }),
      ]),
    ]).start(() => onDone?.());
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.floatingReaction, { opacity, transform: [{ translateY }, { translateX }, { scale }] }]}
    >
      <Text style={{ fontSize: 32 }}>{emoji}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. ShakeAnimation — Secoue un enfant (pour les erreurs)
// ─────────────────────────────────────────────────────────────
interface ShakeAnimationRef {
  shake: () => void;
}

export function ShakeAnimation({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const shakeX = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  return (
    // Expose shake via a wrapper approach
    <Animated.View style={[style, { transform: [{ translateX: shakeX }] }]}>
      {children}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. PulseRing — Anneau pulsant autour d'un élément (activité live)
// ─────────────────────────────────────────────────────────────
interface PulseRingProps {
  color: string;
  size?: number;
  children: React.ReactNode;
}

export function PulseRing({ color, size = 50, children }: PulseRingProps) {
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const op1 = useRef(new Animated.Value(0.7)).current;
  const op2 = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring1, { toValue: 1.6, duration: 1000, useNativeDriver: true }),
          Animated.timing(op1, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring1, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(op1, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
    // Ring2 décalé de 500ms
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ring2, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
            Animated.timing(op2, { toValue: 0, duration: 1200, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ring2, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(op2, { toValue: 0.5, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, 500);
  }, []);

  return (
    <View style={[styles.pulseContainer, { width: size, height: size }]}>
      <Animated.View style={[styles.ring, {
        width: size, height: size, borderRadius: size / 2, borderColor: color,
        opacity: op1, transform: [{ scale: ring1 }],
      }]} />
      <Animated.View style={[styles.ring, {
        width: size, height: size, borderRadius: size / 2, borderColor: color,
        opacity: op2, transform: [{ scale: ring2 }],
      }]} />
      <View style={styles.pulseInner}>{children}</View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. Hook useButtonPress — Gère confetti + emoji en un seul appel
// ─────────────────────────────────────────────────────────────
export function useButtonPress() {
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [emojiVisible, setEmojiVisible] = useState(false);
  const [emoji, setEmoji] = useState('✅');

  const triggerSuccess = useCallback((e = '✅') => {
    setEmoji(e);
    setConfettiVisible(false);
    setEmojiVisible(false);
    // micro-délai pour re-trigger si déjà visible
    setTimeout(() => {
      setConfettiVisible(true);
      setEmojiVisible(true);
    }, 10);
  }, []);

  const reset = useCallback(() => {
    setConfettiVisible(false);
    setEmojiVisible(false);
  }, []);

  return { confettiVisible, emojiVisible, emoji, triggerSuccess, reset };
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  emojiPop: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '50%',
    zIndex: 9999,
  },
  confettiContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    zIndex: 9999,
  },
  floatingReaction: {
    position: 'absolute',
    bottom: '50%',
    alignSelf: 'center',
    zIndex: 9999,
  },
  pulseContainer: { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  ring: { position: 'absolute', borderWidth: 2 },
  pulseInner: { position: 'absolute' },
});
