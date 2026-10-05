// ═══════════════════════════════════════════════════════════
//  Champs Pays (avec drapeau) & Ville — formulaire d'inscription
//  Chaque champ ouvre une feuille de sélection avec recherche.
//  Le champ Ville apparaît (animation) une fois le pays choisi.
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Animated, Easing, FlatList, TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Globe, MapPin, ChevronDown, Search, X, Check, Plus } from 'lucide-react-native';
import { Brand, Radius, type Palette } from '../constants/theme';
import { COUNTRIES, citiesOf, countryName, flagEmoji, normalize } from '../lib/geo';
import { PressableScale, displayFont, bodyFont } from './ui';

const ROW_H = 52;

interface Item { key: string; label: string; flag?: string }

// ─── Feuille de sélection ─────────────────────────────────────
function PickerSheet({
  visible, title, items, selected, colors, allowCustom, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  items: Item[];
  selected: string | null;
  colors: Palette;
  /** Propose « Utiliser « saisie » » quand la recherche ne trouve rien d'exact. */
  allowCustom?: boolean;
  onSelect: (item: Item) => void;
  onClose: () => void;
}) {
  const { height: winHeight } = useWindowDimensions();
  const [query, setQuery] = useState('');
  // Même principe que DishFilterModal : scrim + feuille pilotés ensemble,
  // la Modal reste montée le temps de l'animation de sortie.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setQuery('');
      setMounted(true);
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const indexed = useMemo(() => items.map(i => ({ item: i, norm: normalize(i.label) })), [items]);
  const q = normalize(query);
  const filtered = useMemo(() => {
    if (!q) return items;
    // Les noms qui commencent par la saisie d'abord, puis ceux qui la contiennent
    const starts: Item[] = [];
    const contains: Item[] = [];
    for (const { item, norm } of indexed) {
      if (norm.startsWith(q)) starts.push(item);
      else if (norm.includes(q)) contains.push(item);
    }
    return [...starts, ...contains];
  }, [q, indexed, items]);

  const exact = q && indexed.some(e => e.norm === q);
  const data: Item[] = allowCustom && q && !exact
    ? [{ key: '__custom__', label: query.trim() }, ...filtered]
    : filtered;

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[
          styles.sheet,
          { height: winHeight * 0.8, backgroundColor: colors.page, borderColor: colors.border },
          { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [winHeight, 0] }) }] },
        ]}>
          <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={[displayFont(19, '800'), { color: colors.text, flex: 1 }]}>{title}</Text>
              <PressableScale onPress={onClose}>
                <View style={[styles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <X size={18} color={colors.text} />
                </View>
              </PressableScale>
            </View>

            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={16} color={colors.faint} strokeWidth={2.3} />
              <TextInput
                value={query} onChangeText={setQuery}
                placeholder="Rechercher…" placeholderTextColor={colors.faint}
                autoCorrect={false}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>

            <FlatList
              data={data}
              keyExtractor={i => i.key}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={16}
              windowSize={7}
              getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
              ListEmptyComponent={
                <Text style={[bodyFont(13, '600'), { color: colors.muted, textAlign: 'center', marginTop: 24 }]}>
                  Aucun résultat
                </Text>
              }
              renderItem={({ item }) => {
                const custom = item.key === '__custom__';
                const on = !custom && item.key === selected;
                return (
                  <Pressable
                    onPress={() => onSelect(custom ? { key: item.label, label: item.label } : item)}
                    style={({ pressed }) => [
                      styles.row,
                      on && { backgroundColor: Brand.accent + '1f' },
                      pressed && { backgroundColor: colors.surface },
                    ]}
                  >
                    {custom ? (
                      <Plus size={18} color={Brand.accentLight} strokeWidth={2.4} />
                    ) : item.flag ? (
                      <Text style={styles.rowFlag}>{item.flag}</Text>
                    ) : (
                      <MapPin size={16} color={colors.faint} strokeWidth={2.2} />
                    )}
                    <Text
                      numberOfLines={1}
                      style={[bodyFont(14.5, on ? '800' : '600'), { color: custom ? Brand.accentLight : colors.text, flex: 1 }]}
                    >
                      {custom ? `Utiliser « ${item.label} »` : item.label}
                    </Text>
                    {on && <Check size={17} color={Brand.accentLight} strokeWidth={2.8} />}
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Champ « sélecteur » (même allure que les champs texte) ───
function SelectField({
  left, value, placeholder, invalid, colors, onPress,
}: {
  left: React.ReactNode; value: string | null; placeholder: string;
  invalid?: boolean; colors: Palette; onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98}>
      <View style={[
        styles.field,
        { backgroundColor: colors.surface, borderColor: invalid ? Brand.danger : colors.border },
        invalid && { borderWidth: 1.5 },
      ]}>
        {left}
        <Text
          numberOfLines={1}
          style={[styles.fieldText, { color: value ? colors.text : colors.faint }]}
        >
          {value ?? placeholder}
        </Text>
        <ChevronDown size={18} color={colors.faint} strokeWidth={2.2} />
      </View>
    </PressableScale>
  );
}

// ─── Pays ──────────────────────────────────────────────────────
const COUNTRY_ITEMS: Item[] = COUNTRIES.map(c => ({ key: c.code, label: c.name, flag: flagEmoji(c.code) }));

export function CountryField({ code, onChange, invalid, colors }: {
  code: string | null; onChange: (code: string) => void; invalid?: boolean; colors: Palette;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SelectField
        colors={colors} invalid={invalid}
        value={code ? countryName(code) : null}
        placeholder="Pays"
        left={code
          ? <Text style={styles.fieldFlag}>{flagEmoji(code)}</Text>
          : <Globe size={17} color={invalid ? Brand.danger : Brand.accentLight} strokeWidth={2.2} />}
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open} title="Choisir votre pays" items={COUNTRY_ITEMS} selected={code} colors={colors}
        onClose={() => setOpen(false)}
        onSelect={item => { onChange(item.key); setOpen(false); }}
      />
    </>
  );
}

// ─── Ville (apparaît avec une animation) ──────────────────────
/** À monter avec `key={countryCode}` : l'animation d'apparition rejoue
 *  à chaque changement de pays. */
export function CityField({ countryCode, city, onChange, invalid, colors }: {
  countryCode: string; city: string | null; onChange: (city: string) => void;
  invalid?: boolean; colors: Palette;
}) {
  const [open, setOpen] = useState(false);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 7 }).start();
  }, [appear]);

  const items = useMemo<Item[]>(
    () => citiesOf(countryCode).map(name => ({ key: name, label: name })),
    [countryCode],
  );

  return (
    <Animated.View style={{
      opacity: appear,
      transform: [
        { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
        { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      ],
    }}>
      <SelectField
        colors={colors} invalid={invalid}
        value={city}
        placeholder={`Ville (${countryName(countryCode)})`}
        left={<MapPin size={17} color={invalid ? Brand.danger : Brand.accentLight} strokeWidth={2.2} />}
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open} title="Choisir votre ville" items={items} selected={city} colors={colors} allowCustom
        onClose={() => setOpen(false)}
        onSelect={item => { onChange(item.label); setOpen(false); }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1,
  },
  fieldText: { flex: 1, fontSize: 15, fontWeight: '600' },
  fieldFlag: { fontSize: 18, lineHeight: 20 },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden' },
  grabber: {
    width: 42, height: 4.5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center', marginTop: 10,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, marginBottom: 8,
    paddingHorizontal: 14, borderRadius: Radius.md, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14.5, fontWeight: '600', paddingVertical: 11 },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 14 },
  rowFlag: { fontSize: 20, width: 24, textAlign: 'center' },
});
