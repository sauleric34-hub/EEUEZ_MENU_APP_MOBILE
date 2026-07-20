// ═══════════════════════════════════════════════════════════
//  Composeur : un client propose une publication à un restaurant.
//  La publication part en « en attente » — le restaurant la valide
//  avant qu'elle n'apparaisse dans le fil d'accueil.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, ScrollView, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  X, ImagePlus, Send, TriangleAlert, Play, Trash2, Info, UtensilsCrossed,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { contribuer, MAX_MEDIAS } from '../services/publications';
import { estVideo } from '../services/upload';
import { PressableScale, displayFont, bodyFont } from './ui';

interface Props {
  visible: boolean;
  restaurantId: number;
  restaurantNom: string;
  onClose: () => void;
  onDone: () => void;
}

export function PublicationComposer({
  visible, restaurantId, restaurantNom, onClose, onDone,
}: Props) {
  const { colors, dishesOfResto } = useApp();
  const [texte, setTexte] = useState('');
  const [uris, setUris] = useState<string[]>([]);
  const [platId, setPlatId] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plats = dishesOfResto(restaurantId);

  const ajouterMedias = async () => {
    if (busy || uris.length >= MAX_MEDIAS) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Autorisez l'accès à vos photos pour publier.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIAS - uris.length,
    });
    if (res.canceled || !res.assets?.length) return;
    setUris(prev => [...prev, ...res.assets.map(a => a.uri)].slice(0, MAX_MEDIAS));
    setError(null);
  };

  const retirer = (uri: string) => setUris(prev => prev.filter(u => u !== uri));

  const reset = () => {
    setTexte(''); setUris([]); setPlatId(undefined); setError(null);
  };

  const envoyer = async () => {
    if (busy) return;
    if (!texte.trim() && uris.length === 0) {
      setError('Ajoutez un texte ou au moins une photo.');
      return;
    }
    setBusy(true); setError(null);
    try {
      await contribuer(restaurantId, texte.trim(), uris, platId);
      reset();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'envoi a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const fermer = () => { if (!busy) { reset(); onClose(); } };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={fermer}>
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[displayFont(21, '800'), { color: colors.text }]}>Publier</Text>
                  <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 2 }]}>
                    chez {restaurantNom}
                  </Text>
                </View>
                <PressableScale onPress={fermer}>
                  <View style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <X size={20} color={colors.text} />
                  </View>
                </PressableScale>
              </View>

              {/* Rappel du fonctionnement */}
              <View style={[styles.info, { backgroundColor: Brand.accent + '12', borderColor: Brand.accent + '33' }]}>
                <Info size={16} color={Brand.accentLight} strokeWidth={2.3} />
                <Text style={[bodyFont(12, '600'), { color: colors.muted, flex: 1, lineHeight: 17 }]}>
                  Le restaurant valide votre publication avant qu'elle n'apparaisse dans l'accueil.
                  Une fois envoyée, elle ne peut plus être modifiée.
                </Text>
              </View>

              <TextInput
                value={texte}
                onChangeText={setTexte}
                placeholder="Racontez votre expérience, ce que vous avez aimé…"
                placeholderTextColor={colors.faint}
                style={[styles.texte, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                multiline
              />

              {/* Médias */}
              <View style={styles.mediaHead}>
                <Text style={[bodyFont(12.5, '800'), { color: colors.faint, flex: 1 }]}>
                  PHOTOS / VIDÉOS ({uris.length}/{MAX_MEDIAS})
                </Text>
                {uris.length < MAX_MEDIAS && (
                  <PressableScale onPress={ajouterMedias}>
                    <View style={[styles.ajouter, { borderColor: Brand.accent }]}>
                      <ImagePlus size={15} color={Brand.accentLight} strokeWidth={2.4} />
                      <Text style={[bodyFont(12.5, '800'), { color: Brand.accentLight }]}>Ajouter</Text>
                    </View>
                  </PressableScale>
                )}
              </View>

              {uris.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {uris.map(uri => (
                    <View key={uri} style={styles.vignette}>
                      <Image source={{ uri }} style={styles.vignetteImg} />
                      {estVideo(uri) && (
                        <View style={styles.videoBadge}>
                          <Play size={12} color="#fff" fill="#fff" strokeWidth={0} />
                        </View>
                      )}
                      <PressableScale onPress={() => retirer(uri)} style={styles.retirer}>
                        <View style={styles.retirerBtn}>
                          <Trash2 size={13} color="#fff" strokeWidth={2.4} />
                        </View>
                      </PressableScale>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Plat associé */}
              {plats.length > 0 && (
                <>
                  <Text style={[bodyFont(12.5, '800'), { color: colors.faint, marginTop: 20, marginBottom: 10 }]}>
                    ASSOCIER UN PLAT (FACULTATIF)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {plats.map(p => {
                      const on = platId === p.id;
                      return (
                        <PressableScale key={p.id} onPress={() => setPlatId(on ? undefined : p.id)}>
                          <View style={[
                            styles.platChip,
                            on ? { backgroundColor: Brand.accent, borderColor: Brand.accent }
                               : { backgroundColor: colors.surface, borderColor: colors.border },
                          ]}>
                            <UtensilsCrossed size={13} color={on ? '#fff' : colors.muted} strokeWidth={2.4} />
                            <Text numberOfLines={1} style={[bodyFont(12.5, '700'), { color: on ? '#fff' : colors.muted, maxWidth: 130 }]}>
                              {p.name}
                            </Text>
                          </View>
                        </PressableScale>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {error && (
                <View style={styles.errRow}>
                  <TriangleAlert size={15} color={Brand.danger} strokeWidth={2.3} />
                  <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', flex: 1 }]}>{error}</Text>
                </View>
              )}

              <PressableScale onPress={envoyer} style={{ marginTop: 20 }}>
                <LinearGradient
                  colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[styles.envoyer, glow(Brand.accent, 20)]}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Send size={18} color="#fff" strokeWidth={2.5} />
                      <Text style={[bodyFont(15, '800'), { color: '#fff' }]}>Envoyer au restaurant</Text>
                    </>
                  )}
                </LinearGradient>
              </PressableScale>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  info: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 13, borderRadius: Radius.md, borderWidth: 1, marginTop: 18,
  },
  texte: {
    borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontWeight: '500', marginTop: 16, minHeight: 110, textAlignVertical: 'top',
  },
  mediaHead: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  ajouter: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1.5,
  },
  vignette: { width: 96, height: 96, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  vignetteImg: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute', bottom: 6, left: 6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#00000099', alignItems: 'center', justifyContent: 'center',
  },
  retirer: { position: 'absolute', top: 5, right: 5 },
  retirerBtn: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  platChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1,
  },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  envoyer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    paddingVertical: 16, borderRadius: Radius.pill,
  },
});
