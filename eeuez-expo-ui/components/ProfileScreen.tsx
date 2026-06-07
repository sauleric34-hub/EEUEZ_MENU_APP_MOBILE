import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { MOCK_CLIENT } from '../data/mockData';
import { platService, commandeService } from '../services/apiService';
import { PressableScale } from './Animations';
import { useAppContext } from '../context/AppContext';
import { RESTAURANTS_LISTE } from '../data/mockData';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MOCK_RESTAURANT_USER } from '../data/mockData';

export default function ProfileScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { pastOrders, likedDishes } = useAppContext();
  
  // Find plat details from MOCK_RESTAURANT_USER
  const likedPlatsDetails = (likedDishes || []).map(id => {
    for (const cat of MOCK_RESTAURANT_USER.menu) {
      const plat = cat.plats.find(p => p.id.toString() === id);
      if (plat) return plat;
    }
    return null;
  }).filter(Boolean);

  const commandes = pastOrders || [];
  const likedPlats = likedPlatsDetails || [];
  const loading = false;

  return (
    <View style={s.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>Mon Profil</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* En-tête Profil */}
          <View style={s.profileHeader}>
            <View style={s.avatarContainer}>
              <Text style={{ fontSize: 50 }}>👤</Text>
            </View>
            <Text style={s.userName}>{MOCK_CLIENT.prenom} {MOCK_CLIENT.nom}</Text>
            <Text style={s.userEmail}>{MOCK_CLIENT.telephone}</Text>
            <View style={s.editBtn}>
              <Text style={s.editBtnText}>Modifier le profil</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.client.primary} style={{ marginTop: 50 }} />
          ) : (
            <>
              {/* Statistiques rapides */}
              <View style={s.statsContainer}>
                <View style={s.statBox}>
                  <Text style={s.statValue}>{commandes.length}</Text>
                  <Text style={s.statLabel}>Commandes</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statValue}>{likedPlats.length}</Text>
                  <Text style={s.statLabel}>Plats Likés</Text>
                </View>
              </View>

              {/* Historique des commandes */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>Dernières commandes</Text>
                {commandes.length > 0 ? commandes.slice(0, 3).map((cmd: any) => (
                  <View key={cmd.id} style={s.card}>
                    <Text style={s.cardTitle}>Commande #{cmd.id}</Text>
                    <Text style={s.cardSub}>{cmd.date || 'Récemment'} · {cmd.total} F</Text>
                    <View style={s.statusBadge}>
                      <Text style={s.statusText}>{cmd.statut}</Text>
                    </View>
                  </View>
                )) : (
                  <Text style={s.emptyText}>Aucune commande récente.</Text>
                )}
              </View>

              {/* Plats Favoris */}
              <View style={s.section}>
                <Text style={s.sectionTitle}>Plats Favoris</Text>
                {likedPlats.length > 0 ? likedPlats.map((plat: any) => (
                  <View key={plat.id} style={s.card}>
                    <Text style={s.cardTitle}>{plat.nom}</Text>
                    <Text style={s.cardSub}>{plat.prix} F</Text>
                  </View>
                )) : (
                  <Text style={s.emptyText}>Vous n'avez pas encore de plats favoris.</Text>
                )}
              </View>
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  hamburger: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.glass.bg, justifyContent: 'center', alignItems: 'center' },
  hamburgerText: { fontSize: 22, color: Colors.text.primary },
  greeting: { ...Typography.h2 },
  profileHeader: { alignItems: 'center', marginTop: 20 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.bg.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.client.primary },
  userName: { ...Typography.h2, fontSize: 22, marginTop: 15 },
  userEmail: { ...Typography.body, color: Colors.text.secondary, marginTop: 5 },
  editBtn: { marginTop: 15, paddingHorizontal: 20, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.client.primary + '22' },
  editBtnText: { color: Colors.client.primary, fontWeight: '700' },
  statsContainer: { flexDirection: 'row', marginHorizontal: 20, marginTop: 30, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, padding: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  statBox: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: Colors.border.default },
  statValue: { ...Typography.h2, fontSize: 24, color: Colors.client.primary },
  statLabel: { ...Typography.small, color: Colors.text.secondary, marginTop: 5 },
  section: { marginTop: 30, paddingHorizontal: 20 },
  sectionTitle: { ...Typography.h3, marginBottom: 15 },
  card: { backgroundColor: Colors.bg.surface, padding: 15, borderRadius: Radius.lg, marginBottom: 10, borderWidth: 1, borderColor: Colors.border.default },
  cardTitle: { ...Typography.bodyBold, fontSize: 16 },
  cardSub: { ...Typography.small, color: Colors.text.secondary, marginTop: 5 },
  statusBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: Colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  statusText: { fontSize: 12, fontWeight: '700', color: Colors.text.primary },
  emptyText: { color: Colors.text.muted, fontStyle: 'italic' }
});
