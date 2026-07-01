import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Animated,
  ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DrawerMenu, { DrawerItem } from '../../components/DrawerMenu';
import { PressableScale, ConfettiBurst, EmojiPop, FloatingReaction, PulseRing, useButtonPress } from '../../components/Animations';
import { Colors, Typography, Spacing, Radius, glow, glowSubtle, StatutConfig } from '../../constants/theme';
import { MOCK_LIVREUR } from '../../data/mockData';

const DRAWER_ITEMS: DrawerItem[] = [
  { key: 'tableau_bord', label: 'Tableau de Bord',       icon: '🏠', section: 'Navigation' },
  { key: 'mission',      label: 'Mission en Cours',       icon: '📍', badge: 1 },
  { key: 'historique',   label: 'Historique Livraisons',  icon: '📋' },
  { key: 'gains',        label: 'Mes Gains',              icon: '💵', section: 'Finance' },
  { key: 'statistiques', label: 'Statistiques',           icon: '📊' },
  { key: 'vehicule',     label: 'Mon Véhicule',           icon: '🏍️', section: 'Mon Profil' },
  { key: 'documents',    label: 'Documents',              icon: '📄' },
  { key: 'profil',       label: 'Mon Profil',             icon: '👤' },
  { key: 'aide',         label: 'Aide & Support',         icon: '💬', section: 'Autre' },
  { key: 'deconnexion',  label: 'Se déconnecter',         icon: '🚪', danger: true },
];

// ─── TABLEAU DE BORD ─────────────────────────────────────────────────────
function TableauDeBord({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [isOnline, setIsOnline] = useState(true);
  const toggleAnim = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const missionAnim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  const [missionStatut, setMissionStatut] = useState<'en_collecte' | 'en_livraison'>('en_collecte');
  const [etaMin, setEtaMin] = useState(8);

  // UC-X4 : livraison en cours avec confetti à la fin
  const { confettiVisible: confNavig, emojiVisible: emoNavig, emoji: emNavig, triggerSuccess: trigNavig } = useButtonPress();
  const { confettiVisible: confScan,  emojiVisible: emoScan,  emoji: emScan,  triggerSuccess: trigScan  } = useButtonPress();
  const { confettiVisible: confOnline, emojiVisible: emoOnline, emoji: emOnline, triggerSuccess: trigOnline } = useButtonPress();

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.spring(missionAnim, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }).start();
    // Pulse du bouton mission
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 1200, useNativeDriver: true }),
    ])).start();

    const t1 = setTimeout(() => setMissionStatut('en_livraison'), 5000);
    const t2 = setInterval(() => setEtaMin(prev => Math.max(1, prev - 1)), 8000);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, []);

  const handleToggle = () => {
    const nv = !isOnline;
    setIsOnline(nv);
    Animated.spring(toggleAnim, { toValue: nv ? 1 : 0, tension: 150, friction: 10, useNativeDriver: false }).start();
    if (nv) trigOnline('🟢');
  };

  const handleNaviguer = () => trigNavig('🗺️');
  const handleScanner  = () => trigScan('📷');

  const toggleBg = toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [Colors.text.muted, Colors.restaurant.primary] });
  const thumbX   = toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 26] });
  const statutCfg = StatutConfig[missionStatut];

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <SafeAreaView>
        <Animated.View style={{ opacity: fadeIn }}>
          {/* Header */}
          <View style={s.topBar}>
            <PressableScale onPress={onOpenDrawer}>
              <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
            </PressableScale>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={s.greeting}>Bonjour, {MOCK_LIVREUR.prenom} 👋</Text>
              <Text style={s.subTitle}>🏍️ Yamaha · YD-5678-A</Text>
            </View>
            {/* Toggle Online + confetti */}
            <View style={{ position: 'relative', alignItems: 'center' }}>
              <EmojiPop emoji={emOnline} visible={emoOnline} size={24} />
              <ConfettiBurst visible={confOnline} />
              <PressableScale onPress={handleToggle} style={{ alignItems: 'center', gap: 3 }}>
                <Animated.View style={[s.bigToggle, { backgroundColor: toggleBg }]}>
                  <Animated.View style={[s.bigThumb, { transform: [{ translateX: thumbX }] }]} />
                </Animated.View>
                <Text style={[s.onlineLabel, { color: isOnline ? Colors.restaurant.primary : Colors.text.muted }]}>
                  {isOnline ? '🟢 En ligne' : '⚫ Hors ligne'}
                </Text>
              </PressableScale>
            </View>
          </View>

          {/* Alert UC-X9 si offline */}
          {!isOnline && (
            <View style={[s.alertBox, { borderColor: Colors.danger + '44', backgroundColor: Colors.dangerBg }]}>
              <Text style={[s.alertText, { color: Colors.danger }]}>
                ⚠️ UC-X9 — Hors ligne : les restaurants ne peuvent pas vous assigner de missions.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Carte Mission Active */}
        <Animated.View style={[
          s.missionCard, glow(Colors.livreur.glow, 18),
          { opacity: missionAnim, transform: [{ scale: missionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }
        ]}>
          <View style={s.missionBadgeRow}>
            <PulseRing color={Colors.livreur.primary} size={22}>
              <View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.livreur.primary }]} />
            </PulseRing>
            <Text style={[s.missionBadgeText, { color: Colors.livreur.primary }]}>MISSION EN COURS</Text>
            <Text style={s.missionId}>#CMD-001</Text>
          </View>

          {/* Statut qui change automatiquement */}
          <Animated.View style={[s.statutRow, { backgroundColor: statutCfg.bg, borderColor: statutCfg.color + '44' }, { transform: [{ scale: pulse }] }]}>
            {statutCfg.icon && <statutCfg.icon size={22} color={statutCfg.color} />}
            <Text style={[s.statutLabel, { color: statutCfg.color }]}>{statutCfg.label}</Text>
            <Text style={[s.etaText, { color: statutCfg.color }]}>~{etaMin} min</Text>
          </Animated.View>

          {/* Route */}
          <View style={s.routeBox}>
            <View style={s.routeRow}>
              <Text style={[s.routeDot, { color: Colors.restaurant.primary }]}>●</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.routeRoleLabel}>Restaurant</Text>
                <Text style={s.routeValue}>Le Phénix d'Or · Centre Ville</Text>
              </View>
              {missionStatut === 'en_livraison' && (
                <Text style={[s.doneTag, { color: Colors.success }]}>✓ Collecté</Text>
              )}
            </View>
            <View style={s.routeDivider} />
            <View style={s.routeRow}>
              <Text style={[s.routeDot, { color: Colors.danger }]}>●</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.routeRoleLabel}>Client</Text>
                <Text style={s.routeValue}>Sophie M. · Bastos, Rue 1.234</Text>
              </View>
            </View>
          </View>

          {/* CTA avec animations */}
          <View style={s.missionCTAs}>
            <View style={{ flex: 1, position: 'relative' }}>
              <FloatingReaction emoji={emNavig} visible={emoNavig} />
              <ConfettiBurst visible={confNavig} />
              <PressableScale onPress={handleNaviguer} style={{ flex: 1 }}>
                <View style={[s.ctaNaviguer, glow(Colors.livreur.glow, 10)]}>
                  <Text style={s.ctaNaviguerText}>🗺️  Naviguer</Text>
                </View>
              </PressableScale>
            </View>
            <View style={{ flex: 1, position: 'relative' }}>
              <EmojiPop emoji={emScan} visible={emoScan} size={28} />
              <PressableScale onPress={handleScanner} style={{ flex: 1 }}>
                <View style={s.ctaScanner}>
                  <Text style={s.ctaScannerText}>📷 Scanner QR</Text>
                </View>
              </PressableScale>
            </View>
          </View>

          <View style={s.gainMission}>
            <Text style={s.gainMissionLabel}>Gain estimé pour cette mission</Text>
            <Text style={[s.gainMissionVal, { color: Colors.livreur.primary }]}>1 200 FCFA</Text>
          </View>
        </Animated.View>

        {/* Stats du Jour */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Aujourd'hui</Text>
          <View style={s.statsRow}>
            {[
              { e: '💵', l: 'Gains',     v: `${MOCK_LIVREUR.gainJour.toLocaleString()} F`, color: Colors.livreur.primary, bg: Colors.livreur.bg },
              { e: '✅', l: 'Livraisons', v: '7', color: Colors.restaurant.primary, bg: Colors.restaurant.bg },
              { e: '⭐', l: 'Ma Note',   v: `${MOCK_LIVREUR.noteGlobale}`, color: Colors.client.primary, bg: Colors.client.bg },
            ].map(stat => (
              <PressableScale key={stat.l} style={[s.statCard, glowSubtle(stat.color)] as any} scaleDown={0.94}>
                <Text style={{ fontSize: 24, marginBottom: 4 }}>{stat.e}</Text>
                <Text style={[s.statVal, { color: stat.color }]}>{stat.v}</Text>
                <Text style={s.statLbl}>{stat.l}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {/* Livraisons récentes */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Livraisons Récentes</Text>
          {[
            { id: '#CMD-040', client: 'Marc T.',  quartier: 'Mvog-Mbi', montant: 1000, note: 5 },
            { id: '#CMD-039', client: 'Alice F.', quartier: 'Etoudi',   montant: 800,  note: 4 },
            { id: '#CMD-038', client: 'Jean K.',  quartier: 'Mendong',  montant: 1200, note: 5 },
          ].map(liv => {
            const { confettiVisible: cv, emojiVisible: ev, emoji: em, triggerSuccess: ts } = useButtonPress();
            return (
              <View key={liv.id} style={{ position: 'relative' }}>
                <EmojiPop emoji={em} visible={ev} size={22} />
                <ConfettiBurst visible={cv} />
                <PressableScale onPress={() => ts('⭐')} style={s.livCard}>
                  <View style={[s.livIcon, { backgroundColor: Colors.successBg }]}>
                    <Text style={{ fontSize: 20 }}>✅</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.livId}>{liv.id} — {liv.client}</Text>
                    <Text style={s.livQuartier}>📍 {liv.quartier}</Text>
                    <Text style={{ fontSize: 12, marginTop: 2 }}>{'⭐'.repeat(liv.note)}</Text>
                  </View>
                  <Text style={[s.livMontant, { color: Colors.livreur.primary }]}>{liv.montant} F</Text>
                </PressableScale>
              </View>
            );
          })}
        </View>

        <View style={{ height: 80 }} />
      </SafeAreaView>
    </ScrollView>
  );
}

// ─── GAINS ────────────────────────────────────────────────────────────────
function GainsScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }).start();
  }, []);
  return (
    <ScrollView style={s.screen}>
      <SafeAreaView>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>Mes Gains</Text>
        </View>
        <Animated.View style={[s.gainsHero, glow(Colors.livreur.glow, 20), { transform: [{ scale: scaleAnim }] }]}>
          <Text style={s.gainsHeroLabel}>Total ce mois</Text>
          <Text style={[s.gainsHeroVal, { color: Colors.livreur.primary }]}>{MOCK_LIVREUR.gainSemaine.toLocaleString()}</Text>
          <Text style={s.gainsHeroCur}>FCFA</Text>
          <Text style={s.gainsHeroSub}>{MOCK_LIVREUR.nombreLivraisons} livraisons · ⭐ {MOCK_LIVREUR.noteGlobale}</Text>
        </Animated.View>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Par période</Text>
          {[
            { label: "Aujourd'hui",    val: MOCK_LIVREUR.gainJour,    livs: 7 },
            { label: 'Cette semaine',  val: MOCK_LIVREUR.gainSemaine, livs: 34 },
            { label: 'Ce mois',        val: 580000,                   livs: 145 },
          ].map(p => (
            <PressableScale key={p.label} style={s.gainRow}>
              <Text style={s.gainRowLabel}>{p.label}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.gainRowVal, { color: Colors.livreur.primary }]}>{p.val.toLocaleString()} F</Text>
                <Text style={s.gainRowLiv}>{p.livs} livraisons</Text>
              </View>
            </PressableScale>
          ))}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

function PlaceholderScreen({ title, emoji, desc, onOpenDrawer }: {
  title: string; emoji: string; desc?: string; onOpenDrawer: () => void;
}) {
  const scaleIn = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(scaleIn, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }).start(); }, []);
  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>{title}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <Animated.Text style={{ fontSize: 64, transform: [{ scale: scaleIn }] }}>{emoji}</Animated.Text>
          <Text style={s.greeting}>{title}</Text>
          <Text style={[s.subTitle, { textAlign: 'center', paddingHorizontal: 40 }]}>{desc ?? 'En cours de développement'}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function LivreurApp() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screen, setScreen] = useState('tableau_bord');
  const open = () => setDrawerOpen(true);

  const screens: any = {
    tableau_bord: <TableauDeBord onOpenDrawer={open} />,
    mission:      <PlaceholderScreen title="Mission en Cours" emoji="📍" desc="Carte GPS + route optimisée" onOpenDrawer={open} />,
    historique:   <PlaceholderScreen title="Historique" emoji="📋" desc="Toutes vos livraisons (UC-X5)" onOpenDrawer={open} />,
    gains:        <GainsScreen onOpenDrawer={open} />,
    statistiques: <PlaceholderScreen title="Statistiques" emoji="📊" onOpenDrawer={open} />,
    vehicule:     <PlaceholderScreen title="Mon Véhicule" emoji="🏍️" desc="Yamaha · YD-5678-A" onOpenDrawer={open} />,
    documents:    <PlaceholderScreen title="Documents" emoji="📄" desc="CNI · Permis · Assurance ✓" onOpenDrawer={open} />,
    profil:       <PlaceholderScreen title="Mon Profil" emoji="👤" onOpenDrawer={open} />,
    aide:         <PlaceholderScreen title="Support (UC-X8, UC-X9)" emoji="💬" onOpenDrawer={open} />,
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
        headerTitle={`${MOCK_LIVREUR.prenom} ${MOCK_LIVREUR.nom}`}
        headerSubtitle="Livreur · Yamaha YD-5678-A"
        headerEmoji="🛵"
        accentColor={Colors.livreur.primary}
        accentBg={Colors.livreur.bg}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  hamburger: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: Colors.glass.bg },
  hamburgerText: { fontSize: 22, color: Colors.text.primary },
  greeting: { ...Typography.h2, fontSize: 20 },
  subTitle: { ...Typography.small, marginTop: 2 },
  bigToggle: { width: 54, height: 28, borderRadius: 14, justifyContent: 'center' },
  bigThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', position: 'absolute', elevation: 3 },
  onlineLabel: { fontSize: 11, fontWeight: '700' },
  alertBox: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  alertText: { ...Typography.small, fontWeight: '600', lineHeight: 20 },
  missionCard: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg, backgroundColor: Colors.bg.app, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.livreur.primary + '44', gap: 14, overflow: 'visible' },
  missionBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  missionBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, flex: 1 },
  missionId: { ...Typography.small },
  statutRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: Radius.md, borderWidth: 1, gap: 8 },
  statutEmoji: { fontSize: 18 },
  statutLabel: { ...Typography.bodyBold, flex: 1 },
  etaText: { ...Typography.bodyBold, fontSize: 16 },
  routeBox: { backgroundColor: Colors.bg.surface, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border.default, gap: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { fontSize: 13, width: 18 },
  routeRoleLabel: { fontSize: 10, color: Colors.text.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  routeValue: { ...Typography.bodyBold, fontSize: 14, marginTop: 1 },
  routeDivider: { height: 1, backgroundColor: Colors.border.default, marginLeft: 28 },
  doneTag: { fontSize: 12, fontWeight: '700' },
  missionCTAs: { flexDirection: 'row', gap: 10 },
  ctaNaviguer: { backgroundColor: Colors.livreur.primary, padding: 14, borderRadius: Radius.md, alignItems: 'center' },
  ctaNaviguerText: { color: Colors.bg.app, fontWeight: '800', fontSize: 15 },
  ctaScanner: { backgroundColor: Colors.bg.surface, padding: 14, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  ctaScannerText: { color: Colors.text.primary, fontWeight: '700', fontSize: 15 },
  gainMission: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border.default },
  gainMissionLabel: { ...Typography.small },
  gainMissionVal: { ...Typography.h2, fontSize: 22 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h3, paddingHorizontal: Spacing.md, marginBottom: 14 },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 12 },
  statCard: { flex: 1, backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border.default },
  statVal: { ...Typography.h2, fontSize: 18, marginBottom: 2 },
  statLbl: { ...Typography.caption },
  livCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.surface, marginHorizontal: Spacing.md, marginBottom: 10, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border.default },
  livIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  livId: { ...Typography.bodyBold, fontSize: 14 },
  livQuartier: { ...Typography.small, marginTop: 2 },
  livMontant: { ...Typography.bodyBold, fontSize: 16 },
  gainsHero: { margin: Spacing.md, backgroundColor: Colors.bg.app, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.livreur.primary + '44', gap: 4 },
  gainsHeroLabel: { ...Typography.caption },
  gainsHeroVal: { fontSize: 52, fontWeight: '900', letterSpacing: -2, marginTop: 6 },
  gainsHeroCur: { ...Typography.bodyBold, color: Colors.text.secondary },
  gainsHeroSub: { ...Typography.small, marginTop: 8 },
  gainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.bg.surface, marginHorizontal: Spacing.md, marginBottom: 8, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border.default },
  gainRowLabel: { ...Typography.bodyBold },
  gainRowVal: { ...Typography.h3, fontSize: 17 },
  gainRowLiv: { ...Typography.small, marginTop: 2 },
});
