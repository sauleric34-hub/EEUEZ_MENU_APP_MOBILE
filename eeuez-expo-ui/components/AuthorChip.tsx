// ═══════════════════════════════════════════════════════════
//  Pastille « @prénom nom » d'une contribution client, posée sur le média.
//  Au clic : petit popup avec la photo, le nom et le niveau du contributeur.
//
//  NOTE VIE PRIVÉE : l'email n'est volontairement pas affiché — ce popup est
//  visible par tous les utilisateurs du fil.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Image, Pressable } from 'react-native';
import { User as UserIcon, X } from 'lucide-react-native';
import { Brand, Radius } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { PressableScale, displayFont, bodyFont } from './ui';
import type { AuteurMiniDTO } from '../services/dto';

const NIVEAUX: Record<string, { label: string; couleur: string }> = {
  bronze: { label: 'Bronze', couleur: '#c08457' },
  argent: { label: 'Argent', couleur: '#b9c2cc' },
  or: { label: 'Or', couleur: '#f3c64b' },
};

export function AuthorChip({ auteur }: { auteur: AuteurMiniDTO }) {
  const { colors } = useApp();
  const [ouvert, setOuvert] = useState(false);
  const niveau = NIVEAUX[auteur.niveau] ?? NIVEAUX.bronze;

  return (
    <>
      <PressableScale onPress={() => setOuvert(true)}>
        <View style={styles.chip}>
          {auteur.avatar ? (
            <Image source={{ uri: auteur.avatar }} style={styles.chipAvatar} />
          ) : (
            <View style={[styles.chipAvatar, styles.centre, { backgroundColor: Brand.accent }]}>
              <UserIcon size={10} color="#fff" strokeWidth={2.6} />
            </View>
          )}
          <Text numberOfLines={1} style={[bodyFont(11.5, '800'), { color: '#fff', maxWidth: 130 }]}>
            @{auteur.pseudo}
          </Text>
          <View style={[styles.pastilleNiveau, { backgroundColor: niveau.couleur }]} />
        </View>
      </PressableScale>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOuvert(false)} />
        <View style={styles.centreEcran} pointerEvents="box-none">
          <View style={[styles.popup, { backgroundColor: colors.page, borderColor: colors.border }]}>
            <PressableScale onPress={() => setOuvert(false)} style={styles.fermer}>
              <View style={[styles.fermerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <X size={16} color={colors.text} />
              </View>
            </PressableScale>

            {auteur.avatar ? (
              <Image source={{ uri: auteur.avatar }} style={styles.grandAvatar} />
            ) : (
              <View style={[styles.grandAvatar, styles.centre, { backgroundColor: Brand.accent + '22' }]}>
                <UserIcon size={30} color={Brand.accentLight} strokeWidth={2} />
              </View>
            )}

            <Text style={[displayFont(18, '800'), { color: colors.text, marginTop: 12 }]}>
              {`${auteur.prenom} ${auteur.nom}`.trim() || auteur.pseudo}
            </Text>
            <Text style={[bodyFont(12.5, '600'), { color: colors.muted, marginTop: 2 }]}>
              @{auteur.pseudo}
            </Text>

            <View style={[styles.niveauRow, { backgroundColor: niveau.couleur + '1f', borderColor: niveau.couleur + '55' }]}>
              <View style={[styles.pastilleNiveau, { backgroundColor: niveau.couleur }]} />
              <Text style={[bodyFont(12.5, '800'), { color: niveau.couleur }]}>
                Niveau {niveau.label}
              </Text>
              <Text style={[bodyFont(12, '600'), { color: colors.muted }]}>· {auteur.points} pts</Text>
            </View>

            <Text style={[bodyFont(11.5, '500'), { color: colors.faint, textAlign: 'center', marginTop: 12 }]}>
              Contributeur de la communauté EEUEZ
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.62)', paddingLeft: 4, paddingRight: 10,
    paddingVertical: 4, borderRadius: Radius.pill,
  },
  chipAvatar: { width: 20, height: 20, borderRadius: 10 },
  pastilleNiveau: { width: 8, height: 8, borderRadius: 4 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  centreEcran: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  popup: {
    width: '100%', maxWidth: 320, alignItems: 'center',
    padding: 24, borderRadius: 26, borderWidth: 1,
  },
  fermer: { position: 'absolute', top: 12, right: 12, zIndex: 5 },
  fermerBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  grandAvatar: { width: 78, height: 78, borderRadius: 39 },
  niveauRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1,
  },
});
