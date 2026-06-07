import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { restaurantWorkspaceService } from '../../services/apiService';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { PressableScale } from '../../components/Animations';
import { useRouter } from 'expo-router';

export default function RestaurantWorkspace() {
  const [workspace, setWorkspace] = useState<any>(null);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ revenusJournaliers: 0, commandesEnCours: 0, noteMoyenne: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadData = () => {
    setLoading(true);
    Promise.all([
      restaurantWorkspaceService.getWorkspace().catch(() => ({ data: { nom: 'Mon Restaurant', isOuvert: true, logo: '🍽️' } })),
      restaurantWorkspaceService.getCommandes().catch(() => ({ data: [
        { id: 101, total: 4500, statut: 'en_attente', client: { prenom: 'Marc', nom: 'D.' }, tempsRestant: 20 },
        { id: 102, total: 3000, statut: 'en_preparation', client: { prenom: 'Sophie', nom: 'L.' }, tempsRestant: 10 }
      ] })),
      restaurantWorkspaceService.getStatistiques().catch(() => ({ data: { revenusJournaliers: 25000, commandesEnCours: 5, noteMoyenne: 4.8 } }))
    ]).then(([wsRes, cmdRes, statRes]) => {
      setWorkspace(wsRes.data || wsRes);
      setCommandes(cmdRes.data || cmdRes);
      setStats(statRes.data || statRes);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = () => {
    restaurantWorkspaceService.toggleStatus().then(() => {
      setWorkspace({ ...workspace, isOuvert: !workspace.isOuvert });
    }).catch(console.error);
  };

  const handleAccepter = (id: number) => {
    restaurantWorkspaceService.accepterCommande(id, 30).then(() => {
      loadData();
    }).catch(console.error);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.restaurant.primary} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={{ fontSize: 30 }}>{workspace.logo}</Text>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.greeting}>Espace Pro</Text>
              <Text style={s.restaurantName}>{workspace.nom}</Text>
            </View>
          </View>
          <PressableScale onPress={handleToggleStatus}>
            <View style={[s.statusBadge, { backgroundColor: workspace.isOuvert ? Colors.restaurant.primary : Colors.danger }]}>
              <Text style={s.statusText}>{workspace.isOuvert ? 'OUVERT' : 'FERMÉ'}</Text>
            </View>
          </PressableScale>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Statistiques */}
          <View style={s.statsContainer}>
            <View style={s.statBox}>
              <Text style={s.statValue}>{stats.commandesEnCours}</Text>
              <Text style={s.statLabel}>En cours</Text>
            </View>
            <View style={[s.statBox, s.statMiddle]}>
              <Text style={s.statValue}>{stats.revenusJournaliers} F</Text>
              <Text style={s.statLabel}>Aujourd'hui</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statValue}>⭐ {stats.noteMoyenne}</Text>
              <Text style={s.statLabel}>Note</Text>
            </View>
          </View>

          {/* Boutons Rapides */}
          <View style={s.quickActionsRow}>
            <PressableScale style={s.quickActionBtn} onPress={() => router.push('/(restaurant)/menu')}>
              <Text style={{ fontSize: 24 }}>📋</Text>
              <Text style={s.quickActionText}>Gérer le Menu</Text>
            </PressableScale>
            <PressableScale style={s.quickActionBtn}>
              <Text style={{ fontSize: 24 }}>💸</Text>
              <Text style={s.quickActionText}>Paiements</Text>
            </PressableScale>
          </View>

          {/* Commandes Actives */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Commandes en attente</Text>
            {commandes.filter(c => c.statut === 'en_attente').length > 0 ? commandes.filter(c => c.statut === 'en_attente').map(cmd => (
              <View key={cmd.id} style={s.cmdCard}>
                <View style={s.cmdHeader}>
                  <Text style={s.cmdTitle}>Commande #{cmd.id}</Text>
                  <Text style={s.cmdTotal}>{cmd.total} F</Text>
                </View>
                <Text style={s.cmdClient}>Client: {cmd.client.prenom} {cmd.client.nom}</Text>
                <View style={s.cmdActions}>
                  <PressableScale onPress={() => handleAccepter(cmd.id)} style={{ flex: 1 }}>
                    <View style={s.acceptBtn}>
                      <Text style={s.btnTextWhite}>Accepter</Text>
                    </View>
                  </PressableScale>
                  <PressableScale style={{ flex: 1 }}>
                    <View style={s.refuseBtn}>
                      <Text style={s.btnTextRed}>Refuser</Text>
                    </View>
                  </PressableScale>
                </View>
              </View>
            )) : (
              <Text style={s.emptyText}>Aucune commande en attente.</Text>
            )}
          </View>
          
          <View style={s.section}>
            <Text style={s.sectionTitle}>Commandes en cours</Text>
            {commandes.filter(c => c.statut !== 'en_attente').map(cmd => (
              <View key={cmd.id} style={s.cmdCard}>
                <View style={s.cmdHeader}>
                  <Text style={s.cmdTitle}>Commande #{cmd.id}</Text>
                  <View style={s.statusInProgress}>
                    <Text style={s.statusTextInProgress}>{cmd.statut}</Text>
                  </View>
                </View>
                <Text style={s.cmdClient}>Client: {cmd.client.prenom} {cmd.client.nom}</Text>
                <PressableScale style={{ marginTop: 10 }}>
                  <View style={s.readyBtn}>
                    <Text style={s.btnTextWhite}>Marquer comme Prête</Text>
                  </View>
                </PressableScale>
              </View>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.screen },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  greeting: { ...Typography.small, color: Colors.text.secondary },
  restaurantName: { ...Typography.h2, fontSize: 20 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
  statusText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  statsContainer: { flexDirection: 'row', marginHorizontal: 20, marginTop: 10, backgroundColor: Colors.restaurant.bg, borderRadius: Radius.xl, padding: 15, borderWidth: 1, borderColor: Colors.restaurant.primary + '33' },
  statBox: { flex: 1, alignItems: 'center' },
  statMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.restaurant.primary + '33' },
  statValue: { ...Typography.h2, fontSize: 22, color: Colors.restaurant.primary },
  statLabel: { ...Typography.small, color: Colors.restaurant.primary, opacity: 0.8, marginTop: 4 },
  quickActionsRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 20, gap: 15 },
  quickActionBtn: { flex: 1, backgroundColor: Colors.bg.surface, padding: 15, borderRadius: Radius.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  quickActionText: { ...Typography.bodyBold, fontSize: 14, marginTop: 8 },
  section: { marginTop: 25, paddingHorizontal: 20 },
  sectionTitle: { ...Typography.h3, marginBottom: 15 },
  cmdCard: { backgroundColor: Colors.bg.surface, padding: 15, borderRadius: Radius.lg, marginBottom: 15, borderWidth: 1, borderColor: Colors.border.default },
  cmdHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cmdTitle: { ...Typography.bodyBold, fontSize: 16 },
  cmdTotal: { ...Typography.bodyBold, color: Colors.restaurant.primary, fontSize: 16 },
  cmdClient: { ...Typography.body, color: Colors.text.secondary },
  cmdActions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  acceptBtn: { backgroundColor: Colors.restaurant.primary, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center' },
  refuseBtn: { backgroundColor: 'transparent', paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.danger },
  btnTextWhite: { color: '#FFF', ...Typography.bodyBold, fontSize: 14 },
  btnTextRed: { color: Colors.danger, ...Typography.bodyBold, fontSize: 14 },
  emptyText: { color: Colors.text.muted, fontStyle: 'italic' },
  statusInProgress: { backgroundColor: Colors.warning + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusTextInProgress: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
  readyBtn: { backgroundColor: Colors.success, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center' }
});
