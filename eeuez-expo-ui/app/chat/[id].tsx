// ═══════════════════════════════════════════════════════════
//  Chat — discussion avec le restaurant à propos d'un plat
//  Texte + médias (photos), clavier qui remonte la saisie.
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Send, ImagePlus } from 'lucide-react-native';
import { Brand, Radius } from '../../constants/theme';
import { useApp } from '../../context/AppContext';
import { fetchConversations, fetchMessages, sendMessage, sendMessageMedia } from '../../services/menu';
import type { ConversationDTO, MessageDTO } from '../../services/dto';
import { iconForPlat, gradForId, absMedia, formatPrice } from '../../data/menuData';
import { DishTile, PressableScale, Loader, displayFont, bodyFont } from '../../components/ui';

const POLL_MS = 6000;

// Résout une URL d'image (locale = telle quelle, serveur = base média)
function resolveImage(uri: string | null): string | undefined {
  if (!uri) return undefined;
  if (/^(https?|file|content|data):/.test(uri)) return uri;
  return absMedia(uri);
}

export default function ChatScreen() {
  const { colors } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = Number(id);

  const [conv, setConv] = useState<ConversationDTO | null>(null);
  const [messages, setMessages] = useState<MessageDTO[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = useCallback(() => {
    fetchMessages(convId).then(setMessages).catch(() => {});
  }, [convId]);

  useEffect(() => {
    fetchConversations()
      .then(list => setConv(list.find(c => c.id === convId) ?? null))
      .catch(() => {});
    loadMessages();
    const timer = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(timer);
  }, [convId, loadMessages]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages?.length]);

  const submit = async () => {
    const texte = draft.trim();
    if (!texte || sending) return;
    setSending(true);
    setDraft('');
    const optimistic: MessageDTO = {
      id: -Date.now(), sender: 'client', texte, image: null, is_read: true, created_at: new Date().toISOString(),
    };
    setMessages(m => [...(m ?? []), optimistic]);
    try {
      await sendMessage(convId, texte);
      loadMessages();
    } catch {
      setMessages(m => (m ?? []).filter(x => x.id !== optimistic.id));
      setDraft(texte);
    } finally {
      setSending(false);
    }
  };

  const attachImage = async () => {
    if (sending) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (res.canceled || !res.assets?.length) return;

    const uri = res.assets[0].uri;
    setSending(true);
    const optimistic: MessageDTO = {
      id: -Date.now(), sender: 'client', texte: '', image: uri, is_read: true, created_at: new Date().toISOString(),
    };
    setMessages(m => [...(m ?? []), optimistic]);
    try {
      await sendMessageMedia(convId, uri);
      loadMessages();
    } catch {
      setMessages(m => (m ?? []).filter(x => x.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const p = conv?.plat_details;
  const Icon = p ? iconForPlat(p.nom, p.categorie_nom) : null;
  const headImage = p ? (p.images?.length ? absMedia(p.images[0]) : absMedia(p.image)) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header : plat concerné */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <PressableScale onPress={() => router.back()}>
              <View style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ChevronLeft size={20} color={colors.text} />
              </View>
            </PressableScale>
            {p && Icon ? (
              <PressableScale onPress={() => router.push(`/dish/${p.id}`)} style={{ flex: 1 }}>
                <View style={styles.headInfo}>
                  <DishTile Icon={Icon} grad={gradForId(p.categorie ?? p.id)} image={headImage} size={46} iconSize={22} radius={14} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[displayFont(16, '700'), { color: colors.text }]}>{p.nom}</Text>
                    <View style={styles.row}>
                      <Text style={[bodyFont(11.5, '700'), { color: Brand.accentLight }]}>{conv?.restaurant_nom}</Text>
                      <Text style={[bodyFont(11.5, '600'), { color: colors.faint }]}> · {formatPrice(Number(p.prix))}</Text>
                    </View>
                  </View>
                  <View style={[styles.online, { backgroundColor: Brand.green + '22', borderColor: Brand.green + '55' }]}>
                    <View style={styles.onlineDot} />
                    <Text style={[bodyFont(10.5, '700'), { color: '#8fd6a8' }]}>En ligne</Text>
                  </View>
                </View>
              </PressableScale>
            ) : (
              <Text style={[displayFont(17, '700'), { color: colors.text }]}>Discussion</Text>
            )}
          </View>

          {/* Messages */}
          {messages === null ? (
            <Loader colors={colors} />
          ) : (
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.msgList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {messages.map(m => {
                const mine = m.sender === 'client';
                const img = resolveImage(m.image);
                const bubbleStyle = [styles.bubble, mine ? styles.bubbleOut : styles.bubbleIn, img ? styles.bubbleImg : null];
                const content = (
                  <>
                    {img && <Image source={{ uri: img }} style={styles.msgImage} resizeMode="cover" />}
                    {!!m.texte && (
                      <Text style={[bodyFont(13.5, '500'), { color: mine ? '#fff' : colors.text }, img ? { padding: 10 } : null]}>
                        {m.texte}
                      </Text>
                    )}
                  </>
                );
                return mine ? (
                  <LinearGradient key={m.id} colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={bubbleStyle}>
                    {content}
                  </LinearGradient>
                ) : (
                  <View key={m.id} style={[bubbleStyle, { backgroundColor: colors.surface2 }]}>
                    {content}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Saisie */}
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PressableScale onPress={attachImage} disabled={sending}>
              <View style={[styles.attachBtn, { backgroundColor: colors.surface2 }]}>
                <ImagePlus size={20} color={Brand.accentLight} strokeWidth={2.2} />
              </View>
            </PressableScale>
            <TextInput
              value={draft} onChangeText={setDraft}
              placeholder="Écrire un message…" placeholderTextColor={colors.faint}
              style={[styles.input, { color: colors.text }]}
              multiline
              onSubmitEditing={submit}
            />
            <PressableScale onPress={submit} disabled={!draft.trim() || sending}>
              <LinearGradient
                colors={draft.trim() ? [Brand.accentTop, Brand.accentBot] : [colors.surface2, colors.surface2]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtn}
              >
                <Send size={18} color={draft.trim() ? '#fff' : colors.faint} strokeWidth={2.4} />
              </LinearGradient>
            </PressableScale>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headInfo: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  online: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.green },
  msgList: { padding: 18, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 18 },
  bubbleImg: { padding: 4, overflow: 'hidden' },
  bubbleIn: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleOut: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgImage: { width: 200, height: 200, borderRadius: 14 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    marginHorizontal: 14, marginBottom: 10, paddingLeft: 8, paddingRight: 8, paddingVertical: 8,
    borderRadius: 26, borderWidth: 1,
  },
  attachBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 14, fontWeight: '500', maxHeight: 100, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 6 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
