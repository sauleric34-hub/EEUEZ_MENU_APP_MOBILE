import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DrawerMenu, { DrawerItem } from '../../components/DrawerMenu';
import {
  PressableScale, ConfettiBurst, EmojiPop,
  FloatingReaction, PulseRing, useButtonPress,
} from '../../components/Animations';
import { Colors, Typography, Spacing, Radius, glow, glowSubtle, StatutConfig } from '../../constants/theme';
import { MOCK_RESTAURANT_USER } from '../../data/mockData';

const DRAWER_ITEMS: DrawerItem[] = [
  { key: 'tableau_bord',  label: 'Tableau de Bord',   icon: '📊', section: 'Gestion' },
  { key: 'commandes',     label: 'Commandes',          icon: '📋', badge: 3 },
  { key: 'menu',          label: 'Gestion du Menu',    icon: '🍽️' },
  { key: 'tables',        label: 'Tables & QR Codes',  icon: '🪑' },
  { key: 'livreurs',      label: 'Livreurs Assignés',  icon: '🛵' },
  { key: 'statistiques',  label: 'Statistiques',       icon: '📈', section: 'Analyse' },
  { key: 'avis',          label: 'Avis Clients',       icon: '⭐' },
  { key: 'revenus',       label: 'Revenus',            icon: '💰' },
  { key: 'promotions',    label: 'Promotions',         icon: '🎉', section: 'Marketing' },
  { key: 'horaires',      label: 'Horaires',           icon: '🕐', section: 'Config' },
  { key: 'profil',        label: 'Profil Restaurant',  icon: '🏪' },
  { key: 'aide',          label: 'Aide & Support',     icon: '💬' },
  { key: 'deconnexion',   label: 'Se déconnecter',     icon: '🚪', danger: true },
];

// ─── TOGGLE OUVERT/FERMÉ ANIMÉ ─────────────────────────────────────────────
function OpenToggle({ isOuvert, onToggle }: { isOuvert: boolean; onToggle: () => void }) {
  const toggleAnim = useRef(new Animated.Value(isOuvert ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(toggleAnim, { toValue: isOuvert ? 1 : 0, tension: 150, friction: 10, useNativeDriver: false }).start();
  }, [isOuvert]);
  const bg  = toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [Colors.danger, Colors.restaurant.primary] });
  const tx  = toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 24] });
  return (
    <PressableScale onPress={onToggle} style={{ alignItems: 'center', gap: 2 }}>
      <Animated.View style={[s.toggleTrack, { backgroundColor: bg }]}>
        <Animated.View style={[s.toggleThumb, { transform: [{ translateX: tx }] }]} />
      </Animated.View>
      <Text style={[s.toggleLabel, { color: isOuvert ? Colors.restaurant.primary : Colors.danger }]}>
        {isOuvert ? 'Ouvert' : 'Fermé'}
      </Text>
    </PressableScale>
  );
}

// ─── STAT PILL (stat du toggle) ────────────────────────────────────────────
function StatutPill({ statut }: { statut: string }) {
  const cfg = StatutConfig[statut] ?? StatutConfig.en_attente;
  return (
    <View style={[s.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[s.pillText, { color: cfg.color }]}>{cfg.emoji} {cfg.label}</Text>
    </View>
  );
}

// ─── COMMANDE CARD avec animations ────────────────────────────────────────
function CommandeCard({ cmd, onAccepter, onRefuser }: {
  cmd: { id: string; client: string; montant: number; plats: string; type: string; statut: string; temps: string };
  onAccepter: () => void;
  onRefuser: () => void;
}) {
  const { confettiVisible, emojiVisible, emoji, triggerSuccess } = useButtonPress();
  const slideIn = useRef(new Animated.Value(60)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideIn, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleAccepter = () => {
    triggerSuccess('✅');
    onAccepter();
  };

  return (
    <Animated.View style={[s.commandeCard, { opacity: fadeIn, transform: [{ translateY: slideIn }] },
      cmd.statut !== 'en_attente' && { borderColor: Colors.restaurant.primary + '55' }
    ]}>
      {/* Confetti + emoji qui jaillit au dessus du bouton accepter */}
      <View style={{ position: 'relative' }}>
        <ConfettiBurst visible={confettiVisible} />
        <EmojiPop emoji={emoji} visible={emojiVisible} size={36} />
      </View>

      <View style={s.commandeHeader}>
        <View style={s.row}>
          <Text style={s.commandeId}>#{cmd.id}</Text>
          <View style={[s.typeTag,
            cmd.type === 'livraison' ? { backgroundColor: Colors.client.bg } :
            cmd.type === 'sur_place' ? { backgroundColor: Colors.restaurant.bg } :
            { backgroundColor: Colors.livreur.bg }
          ]}>
            <Text style={[s.typeText, {
              color: cmd.type === 'livraison' ? Colors.client.primary :
                     cmd.type === 'sur_place' ? Colors.restaurant.primary :
                     Colors.livreur.primary
            }]}>
              {cmd.type === 'livraison' ? '🛵 Livraison' : cmd.type === 'sur_place' ? '🪑 Sur place' : '🥡 À emporter'}
            </Text>
          </View>
        </View>
        <Text style={s.commandeTemps}>{cmd.temps}</Text>
      </View>

      <Text style={s.commandeClient}>👤 {cmd.client}</Text>
      <Text style={s.commandePlats}>{cmd.plats}</Text>

      <View style={s.commandeFooter}>
        <StatutPill statut={cmd.statut} />
        <Text style={s.commandeMontant}>{cmd.montant.toLocaleString()} FCFA</Text>
      </View>

      {cmd.statut === 'en_attente' && (
        <View style={s.commandeActions}>
          <PressableScale onPress={onRefuser} style={{ flex: 1 }}>
            <View style={s.btnRefuser}>
              <Text style={s.btnRefuserText}>✕ Refuser</Text>
            </View>
          </PressableScale>
          <PressableScale onPress={handleAccepter} style={{ flex: 2 }}>
            <View style={[s.btnAccepter, glow(Colors.restaurant.glow, 8)]}>
              <Text style={s.btnAccepterText}>✓ Accepter</Text>
            </View>
          </PressableScale>
        </View>
      )}
      {cmd.statut === 'acceptee' && (
        <View style={[s.statutInfo, { backgroundColor: Colors.client.bg }]}>
          <Text style={[s.statutInfoText, { color: Colors.client.primary }]}>
            🔍 Recherche d'un livreur… (UC-X3)
          </Text>
        </View>
      )}
      {cmd.statut === 'en_preparation' && (
        <View style={[s.statutInfo, { backgroundColor: Colors.livreur.bg }]}>
          <Text style={[s.statutInfoText, { color: Colors.livreur.primary }]}>
            👨‍🍳 En préparation en cuisine
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── PLAT TOGGLE (dispo/indispo) ───────────────────────────────────────────
function PlatToggleRow({ plat }: { plat: any }) {
  const [dispo, setDispo] = useState(plat.isDisponible);
  const { emojiVisible, triggerSuccess } = useButtonPress();
  const anim = useRef(new Animated.Value(plat.isDisponible ? 1 : 0)).current;

  const toggle = () => {
    const nv = !dispo;
    setDispo(nv);
    Animated.spring(anim, { toValue: nv ? 1 : 0, tension: 150, friction: 10, useNativeDriver: false }).start();
    if (nv) triggerSuccess('✅');
  };
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.danger, Colors.restaurant.primary] });
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  return (
    <View style={{ position: 'relative' }}>
      <EmojiPop emoji="✅" visible={emojiVisible} size={24} />
      <View style={s.platRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.platNom}>{plat.nom}</Text>
          <Text style={s.platPrix}>{plat.prix.toLocaleString()} FCFA</Text>
        </View>
        <PressableScale onPress={toggle} scaleDown={0.88}>
          <Animated.View style={[s.smallToggle, { backgroundColor: bg }]}>
            <Animated.View style={[s.smallThumb, { transform: [{ translateX: tx }] }]} />
          </Animated.View>
        </PressableScale>
      </View>
    </View>
  );
}

// ─── TABLEAU DE BORD ──────────────────────────────────────────────────────
function TableauDeBord({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [isOuvert, setIsOuvert] = useState(true);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const statsAnims = useRef([0, 0, 0, 0].map(() => new Animated.Value(0))).current;

  const [commandes, setCommandes] = useState([
    { id: 'CMD-042', client: 'Sophie M.', montant: 8500, plats: 'Poulet DG × 1, Ndolé × 1', type: 'livraison', statut: 'en_attente', temps: '2 min' },
    { id: 'CMD-041', client: 'Marc T.',   montant: 4500, plats: 'Poulet DG × 1, Jus bisap × 1', type: 'sur_place', statut: 'en_attente', temps: '5 min' },
    { id: 'CMD-040', client: 'Alice F.',  montant: 5000, plats: 'Poisson braisé × 1', type: 'a_emporter', statut: 'en_attente', temps: '9 min' },
  ]);

  const STATS = [
    { label: "C.A du Jour", value: '87 500 F', icon: '💰', color: Colors.restaurant.primary, bg: Colors.restaurant.bg, delta: '+12%' },
    { label: 'Commandes',   value: '42',       icon: '📦', color: Colors.client.primary,     bg: Colors.client.bg,     delta: '+7' },
    { label: 'Note',        value: '4.8 ⭐',   icon: '🏅', color: Colors.livreur.primary,    bg: Colors.livreur.bg,    delta: '+0.1' },
    { label: 'Acceptation', value: '94%',      icon: '✅', color: '#8B5CF6',                 bg: 'rgba(139,92,246,0.12)', delta: '+3%' },
  ];

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.stagger(120, statsAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 75, friction: 9, useNativeDriver: true })
    )).start();
  }, []);

  const accepterCommande = (id: string) => {
    setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: 'acceptee' } : c));
    setTimeout(() => {
      setCommandes(prev => prev.map(c => c.id === id ? { ...c, statut: 'en_preparation' } : c));
    }, 1200);
  };

  const refuserCommande = (id: string) => {
    setCommandes(prev => prev.filter(c => c.id !== id));
  };

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <SafeAreaView>
        {/* Header */}
        <Animated.View style={[s.topBar, { opacity: fadeIn }]}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}>
              <Text style={s.hamburgerText}>☰</Text>
            </View>
          </PressableScale>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={s.restaurantNom}>{MOCK_RESTAURANT_USER.nomEtablissement}</Text>
            <Text style={s.restaurantSub}>Manager · Dashboard</Text>
          </View>
          <OpenToggle isOuvert={isOuvert} onToggle={() => setIsOuvert(!isOuvert)} />
        </Animated.View>

        {/* Grille Stats avec PulseRing sur le premier */}
        <View style={s.statsGrid}>
          {STATS.map((stat, i) => (
            <Animated.View key={stat.label} style={[
              s.statCard, glowSubtle(stat.color),
              { opacity: statsAnims[i], transform: [{ scale: statsAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }
            ]}>
              {i === 0 ? (
                <PulseRing color={stat.color} size={42}>
                  <View style={[s.statIconBg, { backgroundColor: stat.bg, width: 42, height: 42, borderRadius: 21 }]}>
                    <Text style={{ fontSize: 20 }}>{stat.icon}</Text>
                  </View>
                </PulseRing>
              ) : (
                <View style={[s.statIconBg, { backgroundColor: stat.bg }]}>
                  <Text style={{ fontSize: 20 }}>{stat.icon}</Text>
                </View>
              )}
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
              <View style={[s.deltaPill, { backgroundColor: stat.bg }]}>
                <Text style={[s.deltaText, { color: stat.color }]}>↑ {stat.delta} vs hier</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Commandes LIVE */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Nouvelles Commandes</Text>
            <View style={[s.liveTag, { backgroundColor: Colors.danger + '22', borderColor: Colors.danger + '44' }]}>
              <View style={s.liveDot} />
              <Text style={[s.liveText, { color: Colors.danger }]}>LIVE</Text>
            </View>
          </View>
          {commandes.map(cmd => (
            <CommandeCard
              key={cmd.id}
              cmd={cmd}
              onAccepter={() => accepterCommande(cmd.id)}
              onRefuser={() => refuserCommande(cmd.id)}
            />
          ))}
        </View>

        {/* UC-X2 Disponibilité Plats */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>UC-X2 · Disponibilité Plats</Text>
          {MOCK_RESTAURANT_USER.menu.slice(0, 2).flatMap(cat =>
            cat.plats.slice(0, 2).map(plat => <PlatToggleRow key={plat.id} plat={plat} />)
          )}
        </View>

        {/* Top Ventes */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Top Ventes du Jour</Text>
          {[
            { nom: 'Poulet DG',    ventes: 18, revenus: 81000, icon: '🍗' },
            { nom: 'Ndolé',        ventes: 12, revenus: 42000, icon: '🥘' },
            { nom: 'Poisson braisé', ventes: 9, revenus: 45000, icon: '🐟' },
          ].map((plat, i) => (
            <PressableScale key={plat.nom} style={s.topPlatRow}>
              <View style={[s.rankBadge, { backgroundColor: i === 0 ? Colors.livreur.bg : Colors.bg.elevated }]}>
                <Text style={[s.rankText, { color: i === 0 ? Colors.livreur.primary : Colors.text.secondary }]}>#{i + 1}</Text>
              </View>
              <Text style={{ fontSize: 22, marginHorizontal: 10 }}>{plat.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.platNom}>{plat.nom}</Text>
                <Text style={s.platVentes}>{plat.ventes} commandes</Text>
              </View>
              <Text style={[s.platRevenu, { color: Colors.restaurant.primary }]}>{plat.revenus.toLocaleString()} F</Text>
            </PressableScale>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </SafeAreaView>
    </ScrollView>
  );
}

function PlaceholderScreen({ title, emoji, desc, onOpenDrawer }: {
  title: string; emoji: string; desc?: string; onOpenDrawer: () => void;
}) {
  const scaleIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleIn, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.restaurantNom, { flex: 1, marginLeft: 12 }]}>{title}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <Animated.Text style={[{ fontSize: 64 }, { transform: [{ scale: scaleIn }] }]}>{emoji}</Animated.Text>
          <Text style={s.restaurantNom}>{title}</Text>
          <Text style={[s.restaurantSub, { textAlign: 'center', paddingHorizontal: 40 }]}>{desc ?? 'En cours de développement'}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────
export default function RestaurantApp() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screen, setScreen] = useState('tableau_bord');
  const open = () => setDrawerOpen(true);

  const screens: Record<string, JSX.Element> = {
    tableau_bord: <TableauDeBord onOpenDrawer={open} />,
    commandes:    <PlaceholderScreen title="Toutes les Commandes" emoji="📋" onOpenDrawer={open} />,
    menu:         <PlaceholderScreen title="Gestion du Menu" emoji="🍽️" onOpenDrawer={open} />,
    tables:       <PlaceholderScreen title="Tables & QR Codes (UC-X1)" emoji="🪑" onOpenDrawer={open} />,
    livreurs:     <PlaceholderScreen title="Livreurs (UC-X3)" emoji="🛵" onOpenDrawer={open} />,
    statistiques: <PlaceholderScreen title="Statistiques" emoji="📈" onOpenDrawer={open} />,
    avis:         <PlaceholderScreen title="Avis Clients (UC-X5)" emoji="⭐" onOpenDrawer={open} />,
    revenus:      <PlaceholderScreen title="Revenus" emoji="💰" onOpenDrawer={open} />,
    promotions:   <PlaceholderScreen title="Promotions (UC-X7)" emoji="🎉" onOpenDrawer={open} />,
    horaires:     <PlaceholderScreen title="Horaires d'ouverture" emoji="🕐" onOpenDrawer={open} />,
    profil:       <PlaceholderScreen title="Profil Restaurant" emoji="🏪" onOpenDrawer={open} />,
    aide:         <PlaceholderScreen title="Support (UC-X8)" emoji="💬" onOpenDrawer={open} />,
    deconnexion:  <PlaceholderScreen title="Déconnexion" emoji="🚪" onOpenDrawer={open} />,
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg.screen }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      {screens[screen] ?? screens.tableau_bord}
      <DrawerMenu
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={DRAWER_ITEMS}
        activeKey={screen}
        onNavigate={setScreen}
        headerTitle={MOCK_RESTAURANT_USER.nomEtablissement}
        headerSubtitle="Manager · Yaoundé"
        headerEmoji="🏪"
        accentColor={Colors.restaurant.primary}
        accentBg={Colors.restaurant.bg}
      />
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.screen },
  row: { flexDirection: 'row', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  hamburger: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: Colors.glass.bg },
  hamburgerText: { fontSize: 22, color: Colors.text.primary },
  restaurantNom: { ...Typography.h3, fontSize: 17 },
  restaurantSub: { ...Typography.small, marginTop: 2 },
  toggleTrack: { width: 46, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', position: 'absolute', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  toggleLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: 12, marginVertical: Spacing.md },
  statCard: { width: '47%', backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border.default, gap: 6, alignItems: 'flex-start' },
  statIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statValue: { ...Typography.h2, fontSize: 20 },
  statLabel: { ...Typography.small, fontSize: 11 },
  deltaPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  deltaText: { fontSize: 10, fontWeight: '700' },
  section: { marginBottom: Spacing.lg },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, marginBottom: 6 },
  sectionTitle: { ...Typography.h3, paddingHorizontal: Spacing.md, marginBottom: 10 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger },
  liveText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  commandeCard: { marginHorizontal: Spacing.md, marginBottom: 12, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border.default, gap: 8, overflow: 'visible' },
  commandeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commandeId: { ...Typography.bodyBold, marginRight: 8 },
  commandeTemps: { ...Typography.small, fontSize: 12 },
  commandeClient: { ...Typography.small, color: Colors.text.secondary },
  commandePlats: { ...Typography.small, color: Colors.text.muted },
  commandeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  typeText: { fontSize: 11, fontWeight: '700' },
  commandeMontant: { ...Typography.bodyBold, color: Colors.restaurant.primary, fontSize: 17 },
  commandeActions: { flexDirection: 'row', gap: 10 },
  btnRefuser: { padding: 12, borderRadius: Radius.md, backgroundColor: Colors.dangerBg, alignItems: 'center', borderWidth: 1, borderColor: Colors.danger + '33' },
  btnRefuserText: { color: Colors.danger, fontWeight: '700', fontSize: 14 },
  btnAccepter: { padding: 12, borderRadius: Radius.md, backgroundColor: Colors.restaurant.primary, alignItems: 'center' },
  btnAccepterText: { color: Colors.bg.app, fontWeight: '800', fontSize: 14 },
  statutInfo: { padding: 10, borderRadius: Radius.md, alignItems: 'center' },
  statutInfoText: { fontSize: 13, fontWeight: '600' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  pillText: { fontSize: 11, fontWeight: '700' },
  platRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 14, backgroundColor: Colors.bg.surface, marginHorizontal: Spacing.md, marginBottom: 8, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border.default },
  platNom: { ...Typography.bodyBold, fontSize: 15 },
  platPrix: { ...Typography.small, marginTop: 2 },
  smallToggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center' },
  smallThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', position: 'absolute', elevation: 2 },
  topPlatRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.surface, marginHorizontal: Spacing.md, marginBottom: 8, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border.default },
  rankBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 13, fontWeight: '900' },
  platVentes: { ...Typography.small, marginTop: 2 },
  platRevenu: { ...Typography.bodyBold, fontSize: 16 },
  bg: { elevated: Colors.bg.elevated },
});
