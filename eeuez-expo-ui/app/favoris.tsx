// ═══════════════════════════════════════════════════════════
//  Favoris — plats aimés et publications likées
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { HeartOff, UtensilsCrossed, Newspaper } from 'lucide-react-native';
import { Brand, Radius, glow } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { ScreenBg } from '../components/ScreenBg';
import { PressableScale, displayFont, bodyFont } from '../components/ui';
import { DishCardGrid } from '../components/cards';
import { PublicationCard } from '../components/PublicationCard';
import { fetchPublicationsLikees } from '../services/publications';
import type { PublicationDTO } from '../services/dto';

type Onglet = 'plats' | 'publications';

export default function FavorisScreen() {
  const { colors, favList, pubLikes } = useApp();
  const [onglet, setOnglet] = useState<Onglet>('plats');
  const [pubs, setPubs] = useState<PublicationDTO[]>([]);
  const [chargement, setChargement] = useState(false);

  // Rechargé à chaque affichage : un like posé ailleurs doit se refléter ici.
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      setChargement(true);
      fetchPublicationsLikees()
        .then(res => { if (vivant) setPubs(res); })
        .catch(() => { if (vivant) setPubs([]); })
        .finally(() => { if (vivant) setChargement(false); });
      return () => { vivant = false; };
    }, []),
  );

  // On retire à la volée celles que l'utilisateur vient de dé-liker.
  const pubsAffichees = pubs.filter(p => pubLikes[p.id] !== false);

  const nbPlats = favList.length;
  const nbPubs = pubsAffichees.length;
  const label = onglet === 'plats'
    ? (nbPlats > 0 ? `${nbPlats} plat${nbPlats > 1 ? 's' : ''} aimé${nbPlats > 1 ? 's' : ''}` : 'Votre liste est vide')
    : (nbPubs > 0 ? `${nbPubs} publication${nbPubs > 1 ? 's' : ''} aimée${nbPubs > 1 ? 's' : ''}` : 'Aucune publication aimée');

  return (
    <ScreenBg>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={[displayFont(26, '800'), { color: colors.text }]}>Mes favoris</Text>
          <Text style={[bodyFont(13, '500'), { color: colors.muted, marginTop: 4 }]}>{label}</Text>

          {/* Bascule Plats / Publications */}
          <View style={[styles.segment, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            {([['plats', 'Plats', UtensilsCrossed], ['publications', 'Publications', Newspaper]] as const).map(
              ([cle, texte, Icon]) => {
                const actif = onglet === cle;
                return (
                  <PressableScale key={cle} onPress={() => setOnglet(cle)} style={{ flex: 1 }} scaleTo={0.97}>
                    {actif ? (
                      <LinearGradient
                        colors={[Brand.accentTop, Brand.accentBot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[styles.segItem, glow(Brand.accent, 12)]}
                      >
                        <Icon size={17} color="#fff" strokeWidth={2.5} />
                        <Text style={[bodyFont(14, '800'), { color: '#fff' }]}>{texte}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.segItem}>
                        <Icon size={17} color={colors.muted} strokeWidth={2.3} />
                        <Text style={[bodyFont(14, '700'), { color: colors.muted }]}>{texte}</Text>
                      </View>
                    )}
                  </PressableScale>
                );
              },
            )}
          </View>

          {onglet === 'plats' ? (
            nbPlats > 0 ? (
              <View style={styles.grid}>
                {favList.map(d => (
                  <View key={d.id} style={styles.cell}><DishCardGrid dish={d} /></View>
                ))}
              </View>
            ) : (
              <Vide
                colors={colors}
                titre="Aucun favori"
                texte="Touchez le cœur sur un plat pour le retrouver ici."
              />
            )
          ) : chargement && pubs.length === 0 ? (
            <ActivityIndicator color={Brand.accent} style={{ marginTop: 40 }} />
          ) : nbPubs > 0 ? (
            <View style={{ marginTop: 20 }}>
              {/* Pas de lecture automatique ici : cette page empile les cartes
                  dans un ScrollView, toutes les vidéos se déclencheraient
                  ensemble et le son se superposerait. Une touche ouvre le
                  détail, où la vidéo est lue seule. */}
              {pubsAffichees.map(p => (
                <PublicationCard key={p.id} publication={p} actif={false} />
              ))}
            </View>
          ) : (
            <Vide
              colors={colors}
              titre="Aucune publication"
              texte="Aimez une publication dans l'accueil pour la retrouver ici."
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBg>
  );
}

function Vide({ colors, titre, texte }: { colors: any; titre: string; texte: string }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <HeartOff size={44} color={Brand.accentLight} strokeWidth={1.8} />
      </View>
      <Text style={[displayFont(18, '700'), { color: colors.text, marginTop: 16 }]}>{titre}</Text>
      <Text style={[bodyFont(13, '500'), styles.emptyTxt, { color: colors.muted }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  segment: { flexDirection: 'row', gap: 6, padding: 5, borderRadius: Radius.pill, borderWidth: 1, marginTop: 18 },
  segItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.pill },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 22, gap: 14 },
  cell: { width: '47%', flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { width: 96, height: 96, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { textAlign: 'center', maxWidth: 230, marginTop: 6, lineHeight: 19 },
});
