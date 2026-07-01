import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, glow, StatutConfig } from '../../constants/theme';
import { PressableScale, ConfettiBurst, EmojiPop, useButtonPress } from '../../components/Animations';
import { commandeService } from '../../services/apiService';
import { Package, Store, MapPin } from 'lucide-react-native';

function StatutPill({ statut }: { statut: string }) {
  const cfg = StatutConfig[statut] ?? StatutConfig.en_attente;
  const Icon = cfg.icon;
  return (
    <View style={[s.pill, { backgroundColor: cfg.bg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
      {Icon && <Icon size={12} color={cfg.color} />}
      <Text style={[s.pillText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function CommandeCard({ cmd }: { cmd: any }) {
  const router = useRouter();
  const { confettiVisible, emojiVisible, emoji, triggerSuccess } = useButtonPress();
  const slideIn = useRef(new Animated.Value(40)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideIn, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.cmdCard, { opacity: fadeIn, transform: [{ translateY: slideIn }] }]}>
      <View style={{ position: 'relative' }}>
        <ConfettiBurst visible={confettiVisible} />
        <EmojiPop emoji={emoji} visible={emojiVisible} size={28} />
      </View>
      <View style={s.cmdHeader}>
        <Text style={s.cmdId}>#{cmd.id.toString().slice(0, 6)}</Text>
        <StatutPill statut={cmd.statut} />
      </View>
      <Text style={s.cmdRestoNom}>
        <Store size={11} color={Colors.text.secondary} />{' '}{cmd.restaurant_details?.nom ?? 'Restaurant inconnu'}
      </Text>
      <Text style={s.cmdPlats}>{cmd.lignes?.map((p: any) => `${p.quantite}x ${p.nom_plat}`).join(', ') ?? 'Plats variés'}</Text>
      <View style={s.cmdFooter}>
        <Text style={s.cmdMontant}>{cmd.total?.toLocaleString() ?? '8 500'} FCFA</Text>
        {(cmd.statut === 'en_livraison' || cmd.statut === 'en_preparation') && (
          <PressableScale onPress={() => { triggerSuccess('📍'); router.push(`/(client)/suivi?order_id=${cmd.id}` as any); }}>
            <View style={[s.trackBtn, glow(Colors.client.glow, 8)]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={13} color={Colors.bg.app} />
                <Text style={s.trackBtnText}>Suivre</Text>
              </View>
            </View>
          </PressableScale>
        )}
      </View>
    </Animated.View>
  );
}

export default function HistoriqueScreen() {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const [commandes, setCommandes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    
    commandeService.getHistorique()
      .then((data: any) => {
         setCommandes(data);
         setLoading(false);
      })
      .catch(e => {
         console.log(e);
         setLoading(false);
      });
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={[s.header, { opacity: fadeIn }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Package size={22} color={Colors.text.primary} />
            <Text style={s.title}>Mes Commandes</Text>
          </View>
          <Text style={s.subtitle}>{commandes.length} commande(s)</Text>
        </Animated.View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          {loading ? (
             <Text style={{ textAlign: 'center', marginTop: 40, color: Colors.text.muted }}>Chargement de l'historique...</Text>
          ) : (
            <>
              {/* Commande en cours */}
              <Text style={s.sectionLabel}>En cours</Text>
              {commandes.filter(c => c.statut !== 'livree' && c.statut !== 'annulee').length > 0 ? (
                 commandes.filter(c => c.statut !== 'livree' && c.statut !== 'annulee').map(cmd => <CommandeCard key={cmd.id} cmd={cmd} />)
              ) : (
                 <Text style={{ marginHorizontal: Spacing.md, color: Colors.text.muted }}>Aucune commande en cours.</Text>
              )}

              {/* Historique */}
              <Text style={s.sectionLabel}>Historique</Text>
              {commandes.filter(c => c.statut === 'livree' || c.statut === 'annulee').map(cmd => <CommandeCard key={cmd.id} cmd={cmd} />)}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg.app },
  header:      { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.lg, gap: 4 },
  title:       { ...Typography.h2 },
  subtitle:    { ...Typography.small },
  sectionLabel:{ ...Typography.h3, paddingHorizontal: Spacing.md, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  cmdCard:     { marginHorizontal: Spacing.md, marginBottom: 14, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border.default, gap: 8 },
  cmdHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cmdId:       { ...Typography.bodyBold },
  cmdRestoNom: { ...Typography.small, color: Colors.text.secondary },
  cmdPlats:    { ...Typography.small, color: Colors.text.muted },
  cmdFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cmdMontant:  { ...Typography.bodyBold, color: Colors.client.primary, fontSize: 16 },
  trackBtn:    { backgroundColor: Colors.client.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.lg },
  trackBtnText:{ color: Colors.bg.app, fontWeight: '800', fontSize: 13 },
  pill:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  pillText:    { fontSize: 11, fontWeight: '700' },
});
