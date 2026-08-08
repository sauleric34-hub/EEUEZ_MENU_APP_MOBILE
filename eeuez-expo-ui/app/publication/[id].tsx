// ═══════════════════════════════════════════════════════════
//  Détail d'une publication + commentaires
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send, Trash2, User as UserIcon, MessageSquare } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { ScreenBg } from '../../components/ScreenBg';
import { PressableScale, FadeSlideIn, Loader, CenterMessage, displayFont, bodyFont } from '../../components/ui';
import { PublicationCard } from '../../components/PublicationCard';
import { fetchPublication, postCommentaire } from '../../services/publications';
import { apiRequest } from '../../services/http';
import { animateListChange } from '../../lib/layoutAnimation';
import type { PublicationDTO, CommentaireDTO } from '../../services/dto';

function tempsEcoule(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export default function PublicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pubId = Number(id);
  const { colors, user } = useApp();
  const router = useRouter();

  const [pub, setPub] = useState<PublicationDTO | null>(null);
  const [commentaires, setCommentaires] = useState<CommentaireDTO[]>([]);
  const [chargement, setChargement] = useState(true);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const charger = useCallback(async () => {
    try {
      const data = await fetchPublication(pubId);
      setPub(data);
      setCommentaires(data.commentaires ?? []);
    } catch {
      setPub(null);
    } finally {
      setChargement(false);
    }
  }, [pubId]);

  useEffect(() => { charger(); }, [charger]);

  const envoyer = async () => {
    const contenu = texte.trim();
    if (!contenu || envoi) return;
    if (!user) { Alert.alert('Connexion requise', 'Connectez-vous pour commenter.'); return; }
    setEnvoi(true);
    try {
      const nouveau = await postCommentaire(pubId, contenu);
      animateListChange();
      setCommentaires(prev => [...prev, nouveau]);
      setTexte('');
      setPub(p => (p ? { ...p, nombre_commentaires: p.nombre_commentaires + 1 } : p));
      // Le nouveau commentaire arrive en bas de liste : on l'amène à l'écran.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'envoyer le commentaire.");
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = (commentaire: CommentaireDTO) => {
    Alert.alert('Supprimer', 'Supprimer ce commentaire ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/client/commentaires/${commentaire.id}`, { method: 'DELETE', auth: true });
            animateListChange();
            setCommentaires(prev => prev.filter(c => c.id !== commentaire.id));
            setPub(p => (p ? { ...p, nombre_commentaires: Math.max(0, p.nombre_commentaires - 1) } : p));
          } catch {
            Alert.alert('Erreur', 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()}>
            <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ChevronLeft size={20} color={colors.text} />
            </View>
          </PressableScale>
          <Text style={[displayFont(19, '800'), { color: colors.text }]}>Publication</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {chargement ? (
            <Loader colors={colors} />
          ) : !pub ? (
            <CenterMessage
              Icon={MessageSquare} colors={colors}
              title="Publication introuvable"
              subtitle="Elle a peut-être été retirée par son auteur."
            />
          ) : (
            <>
              <ScrollView ref={scrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <PublicationCard publication={pub} onOpenComments={() => {}} />

                <Text style={[displayFont(15.5, '700'), { color: colors.text, marginBottom: 12 }]}>
                  Commentaires ({commentaires.length})
                </Text>

                {commentaires.length === 0 ? (
                  <Text style={[bodyFont(13, '500'), { color: colors.faint }]}>
                    Aucun commentaire. Soyez le premier à réagir.
                  </Text>
                ) : (
                  commentaires.map(c => (
                    <FadeSlideIn key={c.id} style={styles.commentaire}>
                      {c.auteur_details.avatar ? (
                        <Image source={{ uri: c.auteur_details.avatar }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarVide, { backgroundColor: Brand.accent + '22' }]}>
                          <UserIcon size={15} color={Brand.accentLight} strokeWidth={2.3} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[bodyFont(13, '700'), { color: colors.text }]}>
                          {c.auteur_details.pseudo}
                          <Text style={[bodyFont(11, '500'), { color: colors.faint }]}>
                            {'  '}{tempsEcoule(c.created_at)}
                          </Text>
                        </Text>
                        <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 2, lineHeight: 18 }]}>
                          {c.texte}
                        </Text>
                      </View>
                      {c.peut_supprimer && (
                        <PressableScale onPress={() => supprimer(c)}>
                          <Trash2 size={15} color={Brand.danger} strokeWidth={2.2} />
                        </PressableScale>
                      )}
                    </FadeSlideIn>
                  ))
                )}
              </ScrollView>

              {/* Champ de saisie */}
              <View style={[styles.saisie, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <TextInput
                  value={texte}
                  onChangeText={setTexte}
                  placeholder="Ajouter un commentaire…"
                  placeholderTextColor={colors.faint}
                  style={[bodyFont(13.5, '500'), styles.input, { color: colors.text }]}
                  multiline
                />
                <PressableScale onPress={envoyer}>
                  <View style={[styles.envoyer, { backgroundColor: texte.trim() ? Brand.accent : colors.surface2 }]}>
                    {envoi
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Send size={17} color={texte.trim() ? '#fff' : colors.faint} strokeWidth={2.4} />}
                  </View>
                </PressableScale>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenBg>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  commentaire: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarVide: { alignItems: 'center', justifyContent: 'center' },
  saisie: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 90, paddingVertical: 8, paddingHorizontal: 4 },
  envoyer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
