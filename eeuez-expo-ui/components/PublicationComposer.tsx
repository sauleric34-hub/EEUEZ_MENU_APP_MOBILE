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
  X, ImagePlus, Send, TriangleAlert, Play, Info, UtensilsCrossed, Store, Check,
} from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { useGardeDemo } from '../hooks/useGardeDemo';
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
  const { colors, dishesOfResto, user } = useApp();
  // Publier expose du contenu aux autres : réservé aux comptes réels.
  const { bloquer } = useGardeDemo();
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

  const peutEnvoyer = texte.trim().length > 0 || uris.length > 0;
  const initiale = (user?.first_name || user?.username || 'V').charAt(0).toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={fermer}>
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

          {/* ─── Barre d'application (motif natif : fermer · titre · action) ─── */}
          <View style={[styles.appbar, { borderBottomColor: colors.border }]}>
            <PressableScale onPress={fermer}>
              <View style={styles.appbarBtn}>
                <X size={23} color={colors.text} strokeWidth={2.2} />
              </View>
            </PressableScale>
            <Text style={[displayFont(16.5, '800'), { color: colors.text }]}>Nouvelle publication</Text>
            {/* Espace symétrique à gauche pour centrer le titre */}
            <View style={styles.appbarBtn} />
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* ─── Ligne auteur : avatar + destination ─── */}
              <View style={styles.authorRow}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatar} />
                ) : (
                  <LinearGradient colors={[Brand.accentTop, Brand.accentBot]} style={styles.avatar}>
                    <Text style={[displayFont(18, '800'), { color: '#fff' }]}>{initiale}</Text>
                  </LinearGradient>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[displayFont(14.5, '800'), { color: colors.text }]}>
                    {user?.first_name || user?.username || 'Vous'}
                  </Text>
                  <View style={styles.restoTag}>
                    <Store size={12} color={Brand.accentLight} strokeWidth={2.4} />
                    <Text numberOfLines={1} style={[bodyFont(12, '600'), { color: colors.muted, flex: 1 }]}>
                      chez {restaurantNom}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ─── Saisie ample, sans bordure (façon compose social) ─── */}
              <TextInput
                value={texte}
                onChangeText={setTexte}
                placeholder="Racontez votre expérience, ce que vous avez aimé…"
                placeholderTextColor={colors.faint}
                style={[styles.texte, { color: colors.text }]}
                multiline
                autoFocus
              />
              <Text style={[bodyFont(11, '600'), styles.compteur, { color: colors.faint }]}>
                {texte.length}
              </Text>

              {/* ─── Galerie de médias ─── */}
              <Text style={[bodyFont(11.5, '800'), styles.sectionLabel, { color: colors.faint }]}>
                PHOTOS & VIDÉOS · {uris.length}/{MAX_MEDIAS}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 11, paddingRight: 4 }}>
                {/* Tuile d'ajout : première position, toujours visible tant qu'il reste de la place */}
                {uris.length < MAX_MEDIAS && (
                  <PressableScale onPress={ajouterMedias}>
                    <View style={[styles.addTile, { borderColor: Brand.accent + '66', backgroundColor: Brand.accent + '0e' }]}>
                      <ImagePlus size={24} color={Brand.accentLight} strokeWidth={2} />
                      <Text style={[bodyFont(11.5, '800'), { color: Brand.accentLight }]}>Ajouter</Text>
                    </View>
                  </PressableScale>
                )}
                {uris.map(uri => (
                  <View key={uri} style={styles.vignette}>
                    <Image source={{ uri }} style={styles.vignetteImg} />
                    {estVideo(uri) && (
                      <View style={styles.videoBadge}>
                        <Play size={11} color="#fff" fill="#fff" strokeWidth={0} />
                      </View>
                    )}
                    <PressableScale onPress={() => retirer(uri)} style={styles.retirer}>
                      <View style={styles.retirerBtn}>
                        <X size={13} color="#fff" strokeWidth={2.8} />
                      </View>
                    </PressableScale>
                  </View>
                ))}
              </ScrollView>

              {/* ─── Plat associé (facultatif) ─── */}
              {plats.length > 0 && (
                <>
                  <Text style={[bodyFont(11.5, '800'), styles.sectionLabel, { color: colors.faint }]}>
                    ASSOCIER UN PLAT · FACULTATIF
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                    {plats.map(p => {
                      const on = platId === p.id;
                      return (
                        <PressableScale key={p.id} onPress={() => setPlatId(on ? undefined : p.id)}>
                          <View style={[
                            styles.platChip,
                            on ? { backgroundColor: Brand.accent, borderColor: Brand.accent }
                               : { backgroundColor: colors.surface, borderColor: colors.border },
                          ]}>
                            {on
                              ? <Check size={13} color="#fff" strokeWidth={3} />
                              : <UtensilsCrossed size={13} color={colors.muted} strokeWidth={2.4} />}
                            <Text numberOfLines={1} style={[bodyFont(12.5, '700'), { color: on ? '#fff' : colors.text, maxWidth: 130 }]}>
                              {p.name}
                            </Text>
                          </View>
                        </PressableScale>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {/* Rappel discret du fonctionnement */}
              <View style={[styles.info, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Info size={15} color={colors.muted} strokeWidth={2.3} />
                <Text style={[bodyFont(11.5, '600'), { color: colors.muted, flex: 1, lineHeight: 16 }]}>
                  Le restaurant valide votre publication avant sa parution. Une fois envoyée, elle ne peut plus être modifiée.
                </Text>
              </View>

              {error && (
                <View style={styles.errRow}>
                  <TriangleAlert size={15} color={Brand.danger} strokeWidth={2.3} />
                  <Text style={[bodyFont(12.5, '600'), { color: '#ff6b70', flex: 1 }]}>{error}</Text>
                </View>
              )}
            </ScrollView>

            {/* ─── Barre d'action ancrée en bas (accessible au pouce) ─── */}
            <View style={[styles.dock, { borderTopColor: colors.border, backgroundColor: colors.page }]}>
              <PressableScale onPress={() => bloquer(envoyer)} disabled={!peutEnvoyer || busy}>
                {peutEnvoyer ? (
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
                ) : (
                  // État désactivé : visible mais clairement inactif tant qu'il
                  // n'y a ni texte ni média.
                  <View style={[styles.envoyer, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                    <Send size={18} color={colors.faint} strokeWidth={2.5} />
                    <Text style={[bodyFont(15, '800'), { color: colors.faint }]}>Envoyer au restaurant</Text>
                  </View>
                )}
              </PressableScale>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  appbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  appbarBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  restoTag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },

  texte: {
    fontSize: 16, fontWeight: '500', lineHeight: 23,
    marginTop: 14, minHeight: 96, textAlignVertical: 'top',
  },
  compteur: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 4 },

  sectionLabel: { letterSpacing: 0.6, marginTop: 22, marginBottom: 12 },

  addTile: {
    width: 104, height: 104, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  vignette: { width: 104, height: 104, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  vignetteImg: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute', bottom: 7, left: 7, width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#000000aa', alignItems: 'center', justifyContent: 'center',
  },
  retirer: { position: 'absolute', top: 6, right: 6 },
  retirerBtn: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#000000aa',
    alignItems: 'center', justifyContent: 'center',
  },
  platChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1,
  },
  info: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    padding: 12, borderRadius: Radius.md, borderWidth: 1, marginTop: 24,
  },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },

  dock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, borderTopWidth: 1 },
  envoyer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    paddingVertical: 16, borderRadius: Radius.pill,
  },
});
