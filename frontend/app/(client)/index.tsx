import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DrawerMenu, { DrawerItem } from '../../components/DrawerMenu';
import { PressableScale, ConfettiBurst, EmojiPop, FloatingReaction, PulseRing, useButtonPress } from '../../components/Animations';
import { Colors, Typography, Spacing, Radius, glow, glowSubtle, StatutConfig } from '../../constants/theme';
import { MOCK_CLIENT, RESTAURANTS_LISTE } from '../../data/mockData';

const DRAWER_ITEMS: DrawerItem[] = [
  { key: 'accueil',       label: 'Accueil',              icon: '🏠', section: 'Découverte' },
  { key: 'carte',         label: 'Carte & Restaurants',  icon: '🗺️' },
  { key: 'scanner',       label: 'Scanner QR Code',      icon: '📷' },
  { key: 'panier',        label: 'Mon Panier',           icon: '🛒', badge: 2, section: 'Commandes' },
  { key: 'commandes',     label: 'Mes Commandes',        icon: '📦' },
  { key: 'suivi',         label: 'Suivi en cours',       icon: '📍', badge: 1 },
  { key: 'favoris',       label: 'Restaurants Favoris',  icon: '❤️', section: 'Mon Compte' },
  { key: 'adresses',      label: 'Mes Adresses',         icon: '📌' },
  { key: 'paiements',     label: 'Paiements',            icon: '💳' },
  { key: 'avis',          label: 'Mes Avis',             icon: '⭐' },
  { key: 'notifications', label: 'Notifications',        icon: '🔔', badge: 3 },
  { key: 'profil',        label: 'Mon Profil',           icon: '👤' },
  { key: 'aide',          label: 'Aide & Support',       icon: '💬', section: 'Support' },
  { key: 'deconnexion',   label: 'Se déconnecter',       icon: '🚪', danger: true },
];

function StatutPill({ statut }: { statut: string }) {
  const cfg = StatutConfig[statut] ?? StatutConfig.en_attente;
  return (
    <View style={[s.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[s.pillText, { color: cfg.color }]}>{cfg.emoji} {cfg.label}</Text>
    </View>
  );
}

// ─── CARTE RESTAURANT avec bouton Favori animé ─────────────────────────────
function RestoCard({ resto }: { resto: typeof RESTAURANTS_LISTE[0] }) {
  const [isFav, setIsFav] = useState(resto.id === 'r1');
  const { emojiVisible, triggerSuccess } = useButtonPress();
  const slideIn = useRef(new Animated.Value(0)).current;
  const opacityIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideIn, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(opacityIn, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleFav = () => {
    const nv = !isFav;
    setIsFav(nv);
    if (nv) triggerSuccess('❤️');
  };

  return (
    <Animated.View style={{
      opacity: opacityIn,
      transform: [{ translateY: slideIn.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }]
    }}>
      <PressableScale style={s.restoCard} scaleDown={0.97}>
        <View style={[s.restoThumb, { backgroundColor: resto.couleur + '22' }]}>
          <Text style={{ fontSize: 38 }}>{resto.emoji}</Text>
          {!resto.isOuvert && (
            <View style={s.fermeOverlay}>
              <Text style={s.fermeText}>Fermé</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.restoName}>{resto.nom}</Text>
          <Text style={s.restoCat}>{resto.categorie} · {resto.distance} km</Text>
          <View style={[s.row, { gap: 8, marginTop: 8, flexWrap: 'wrap' }]}>
            <View style={s.metaChip}><Text style={s.metaText}>⭐ {resto.note}</Text></View>
            <View style={s.metaChip}><Text style={s.metaText}>🕐 {resto.temps} min</Text></View>
            <View style={s.metaChip}><Text style={s.metaText}>{resto.frais}F livr.</Text></View>
          </View>
        </View>
        {/* Bouton ❤️ favori avec animation */}
        <View style={{ position: 'relative' }}>
          <EmojiPop emoji="❤️" visible={emojiVisible} size={22} />
          <PressableScale onPress={handleFav} scaleDown={0.8}>
            <View style={[s.favBtn, { backgroundColor: isFav ? Colors.danger + '22' : Colors.bg.elevated }]}>
              <Text style={{ fontSize: 18 }}>{isFav ? '❤️' : '🤍'}</Text>
            </View>
          </PressableScale>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

// ─── ACCUEIL ───────────────────────────────────────────────────────────────
function AccueilScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideIn = useRef(new Animated.Value(30)).current;
  const STATUTS = ['en_preparation', 'prete', 'livreur_assigne', 'en_livraison'];
  const [statutIdx, setStatutIdx] = useState(0);
  const { confettiVisible, emojiVisible, emoji: reactionEmoji, triggerSuccess } = useButtonPress();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideIn, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    const timer = setInterval(() => {
      setStatutIdx(prev => (prev < STATUTS.length - 1 ? prev + 1 : prev));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleSuivre = () => triggerSuccess('🛵');

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <SafeAreaView>
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideIn }] }}>
          {/* Header */}
          <View style={s.topBar}>
            <PressableScale onPress={onOpenDrawer}>
              <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
            </PressableScale>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={s.greeting}>Bonjour, {MOCK_CLIENT.prenom} 👋</Text>
              <Text style={s.locationText}>📍 Bastos, Yaoundé</Text>
            </View>
            <PressableScale scaleDown={0.85}>
              <View style={s.notifBtn}>
                <PulseRing color={Colors.danger} size={36}>
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                </PulseRing>
              </View>
            </PressableScale>
          </View>

          {/* Barre de recherche */}
          <PressableScale style={s.searchBar} scaleDown={0.98}>
            <Text style={{ fontSize: 18 }}>🔍</Text>
            <Text style={s.searchPlaceholder}>Rechercher un plat, un restaurant…</Text>
            <View style={[s.filterBtn, { backgroundColor: Colors.client.bg }]}>
              <Text style={[s.filterText, { color: Colors.client.primary }]}>Filtres</Text>
            </View>
          </PressableScale>
        </Animated.View>

        {/* Commande live — statut animé */}
        <Animated.View style={[s.liveCard, { opacity: fadeIn }, glow(Colors.client.glow, 14)]}>
          <View style={s.liveBadgeRow}>
            <View style={s.liveDotWrap}><View style={s.liveDot} /></View>
            <Text style={[s.liveLabel, { color: Colors.danger }]}>EN COURS</Text>
          </View>
          <Text style={s.liveTitle}>Commande #CMD-001</Text>
          <Text style={s.liveSub}>Le Phénix d'Or · Poulet DG × 1, Ndolé × 1</Text>
          <View style={s.liveFooter}>
            <StatutPill statut={STATUTS[statutIdx]} />
            <Text style={[s.liveEta, { color: Colors.client.primary }]}>~{12 - statutIdx * 3} min</Text>
          </View>
          {/* Bouton avec FloatingReaction + confetti */}
          <View style={{ position: 'relative', alignItems: 'center' }}>
            <FloatingReaction emoji={reactionEmoji} visible={emojiVisible} />
            <ConfettiBurst visible={confettiVisible} />
            <PressableScale onPress={handleSuivre} style={{ width: '100%' }}>
              <View style={[s.liveSuiviBtn, glow(Colors.client.glow, 8)]}>
                <Text style={s.liveSuiviBtnText}>📍  Suivre en direct</Text>
              </View>
            </PressableScale>
          </View>
        </Animated.View>

        {/* Bannière Promo */}
        <Animated.View style={[s.promoBanner, { opacity: fadeIn }]}>
          <View>
            <Text style={s.promoTag}>🎉 OFFRE DU JOUR</Text>
            <Text style={s.promoTitle}>Livraison offerte</Text>
            <Text style={s.promoSub}>Sur commande {'>'} 5 000 FCFA</Text>
          </View>
          <Text style={s.promoBig}>-100%</Text>
        </Animated.View>

        {/* Catégories */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Catégories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: 10 }}>
            {[
              { e: '⭐', l: 'Populaire',  c: Colors.livreur.primary },
              { e: '🍲', l: 'Tradition',  c: Colors.restaurant.primary },
              { e: '🔥', l: 'Grillades', c: Colors.danger },
              { e: '🍔', l: 'Fast Food', c: Colors.warning },
              { e: '🍕', l: 'Pizza',     c: Colors.client.primary },
              { e: '🍹', l: 'Boissons',  c: Colors.restaurant.light },
              { e: '🍰', l: 'Desserts',  c: Colors.livreur.light },
            ].map(cat => (
              <PressableScale key={cat.l} style={[s.catPill, { borderColor: cat.c + '44' }]} scaleDown={0.9}>
                <Text style={{ fontSize: 22 }}>{cat.e}</Text>
                <Text style={[s.catLabel, { color: cat.c }]}>{cat.l}</Text>
              </PressableScale>
            ))}
          </ScrollView>
        </View>

        {/* Restaurants */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Restaurants Populaires</Text>
            <PressableScale>
              <Text style={[s.seeAll, { color: Colors.client.primary }]}>Voir tout ›</Text>
            </PressableScale>
          </View>
          {RESTAURANTS_LISTE.map(resto => <RestoCard key={resto.id} resto={resto} />)}
        </View>

        <View style={{ height: 100 }} />
      </SafeAreaView>
    </ScrollView>
  );
}

// ─── SUIVI TEMPS-RÉEL ─────────────────────────────────────────────────────
function SuiviScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnims = useRef(Array(6).fill(0).map(() => new Animated.Value(0))).current;
  const [currentStep, setCurrentStep] = useState(3);
  const { confettiVisible, emojiVisible, emoji, triggerSuccess } = useButtonPress();

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
    Animated.stagger(80, slideAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true })
    )).start();
  }, []);

  const ETAPES = [
    { label: 'Commande reçue',       heure: '12:05', acteur: 'Client' },
    { label: 'Acceptée — 25 min',    heure: '12:07', acteur: 'Restaurant' },
    { label: 'En préparation',        heure: '12:08', acteur: 'Cuisines Phénix' },
    { label: 'Livreur Paul assigné', heure: '12:26', acteur: 'EEUEZ' },
    { label: 'En route vers vous',   heure: '12:28', acteur: 'Paul N. 🛵' },
    { label: 'Livraison estimée',    heure: '~12:43', acteur: '' },
  ];

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <SafeAreaView>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>Suivi en Direct</Text>
        </View>

        {/* Carte livreur */}
        <View style={[s.trackCard, glow(Colors.client.glow, 18)]}>
          <View style={s.mapMock}>
            <Text style={s.mapMockBg}>🗺️</Text>
            <Animated.View style={[s.livreurPin, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={{ fontSize: 32 }}>🛵</Text>
              <View style={[s.pinRipple, { borderColor: Colors.client.primary }]} />
            </Animated.View>
          </View>
          <View style={s.livreurInfoRow}>
            <View style={[s.livreurAvatar, { backgroundColor: Colors.client.bg }]}>
              <Text style={{ fontSize: 22 }}>👨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.livreurNom}>Paul Nkolo</Text>
              <Text style={s.livreurSub}>🏍️ Yamaha · YD-5678-A · ⭐ 4.7</Text>
            </View>
            <PressableScale scaleDown={0.85}>
              <View style={[s.callBtn, { backgroundColor: Colors.client.bg }, glowSubtle(Colors.client.primary)]}>
                <Text style={{ fontSize: 20 }}>📞</Text>
              </View>
            </PressableScale>
          </View>
          <View style={s.etaRow}>
            <Text style={s.etaLabel}>Arrivée estimée</Text>
            <Text style={[s.etaValue, { color: Colors.client.primary }]}>~12 minutes</Text>
          </View>
        </View>

        {/* Timeline */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Progression de la Commande</Text>
          {ETAPES.map((etape, i) => {
            const fait = i <= currentStep;
            const enCours = i === currentStep;
            const anim = slideAnims[i] ?? new Animated.Value(1);
            return (
              <Animated.View key={i} style={[s.etapeRow, {
                opacity: anim,
                transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }]
              }]}>
                <View style={s.etapeLeft}>
                  <View style={[s.etapeDot,
                    fait && s.etapeDotFait,
                    enCours && { backgroundColor: Colors.bg.elevated, borderColor: Colors.client.primary, ...glow(Colors.client.glow, 6) }
                  ]}>
                    {fait && !enCours && <Text style={{ fontSize: 9, color: '#FFF' }}>✓</Text>}
                    {enCours && <View style={s.etapeDotPulse} />}
                  </View>
                  {i < ETAPES.length - 1 && (
                    <View style={[s.etapeLine, fait && { backgroundColor: Colors.client.primary + '44' }]} />
                  )}
                </View>
                <View style={s.etapeRight}>
                  <Text style={[s.etapeLabel, !fait && { color: Colors.text.muted }]}>{etape.label}</Text>
                  <View style={s.row}>
                    {etape.acteur ? (
                      <View style={[s.acteurChip, { backgroundColor: fait ? Colors.client.bg : Colors.bg.surface }]}>
                        <Text style={[s.acteurText, { color: fait ? Colors.client.primary : Colors.text.muted }]}>{etape.acteur}</Text>
                      </View>
                    ) : null}
                    <Text style={s.etapeHeure}>{etape.heure}</Text>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>

        {/* Signaler un problème UC-X8 */}
        <View style={{ position: 'relative', alignItems: 'center' }}>
          <ConfettiBurst visible={confettiVisible} />
          <EmojiPop emoji={emoji} visible={emojiVisible} size={28} />
          <PressableScale style={{ width: '100%' }}>
            <View style={[s.signalBtn, { borderColor: Colors.danger + '44' }]}>
              <Text style={[s.signalBtnText, { color: Colors.danger }]}>⚠️  Signaler un problème (UC-X8)</Text>
            </View>
          </PressableScale>
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
          <Text style={[s.locationText, { textAlign: 'center', paddingHorizontal: 40 }]}>{desc ?? 'En cours de développement'}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function ClientApp() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screen, setScreen] = useState('accueil');
  const open = () => setDrawerOpen(true);

  const screens: Record<string, JSX.Element> = {
    accueil:       <AccueilScreen onOpenDrawer={open} />,
    carte:         <PlaceholderScreen title="Carte & Restaurants" emoji="🗺️" onOpenDrawer={open} />,
    scanner:       <PlaceholderScreen title="Scanner QR Code (UC-X1)" emoji="📷" onOpenDrawer={open} />,
    panier:        <PlaceholderScreen title="Mon Panier" emoji="🛒" desc="2 articles · 8 000 FCFA" onOpenDrawer={open} />,
    commandes:     <PlaceholderScreen title="Mes Commandes" emoji="📦" onOpenDrawer={open} />,
    suivi:         <SuiviScreen onOpenDrawer={open} />,
    favoris:       <PlaceholderScreen title="Restaurants Favoris" emoji="❤️" onOpenDrawer={open} />,
    adresses:      <PlaceholderScreen title="Mes Adresses" emoji="📌" onOpenDrawer={open} />,
    paiements:     <PlaceholderScreen title="Paiements" emoji="💳" onOpenDrawer={open} />,
    avis:          <PlaceholderScreen title="Mes Avis (UC-X5)" emoji="⭐" onOpenDrawer={open} />,
    notifications: <PlaceholderScreen title="Notifications" emoji="🔔" desc="3 nouvelles" onOpenDrawer={open} />,
    profil:        <PlaceholderScreen title="Mon Profil" emoji="👤" desc={`${MOCK_CLIENT.prenom} ${MOCK_CLIENT.nom}`} onOpenDrawer={open} />,
    aide:          <PlaceholderScreen title="Aide & Support (UC-X8)" emoji="💬" onOpenDrawer={open} />,
    deconnexion:   <PlaceholderScreen title="Déconnexion" emoji="🚪" onOpenDrawer={open} />,
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg.screen }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      {screens[screen] ?? screens.accueil}
      <DrawerMenu
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={DRAWER_ITEMS}
        activeKey={screen}
        onNavigate={setScreen}
        headerTitle={`${MOCK_CLIENT.prenom} ${MOCK_CLIENT.nom}`}
        headerSubtitle="Client · Yaoundé, Cameroun"
        headerEmoji="🛍️"
        accentColor={Colors.client.primary}
        accentBg={Colors.client.bg}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.screen },
  row: { flexDirection: 'row', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  hamburger: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: Colors.glass.bg },
  hamburgerText: { fontSize: 22, color: Colors.text.primary },
  greeting: { ...Typography.h2, fontSize: 20 },
  locationText: { ...Typography.small, marginTop: 2 },
  notifBtn: { padding: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, marginHorizontal: Spacing.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border.default },
  searchPlaceholder: { ...Typography.body, color: Colors.text.muted, flex: 1 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm },
  filterText: { ...Typography.caption, fontSize: 12, fontWeight: '700' },
  liveCard: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg, backgroundColor: Colors.bg.elevated, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.client.primary + '33', gap: 8, overflow: 'visible' },
  liveBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDotWrap: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger, overflow: 'hidden' },
  liveDot: { flex: 1, backgroundColor: Colors.danger },
  liveLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  liveTitle: { ...Typography.bodyBold, fontSize: 17 },
  liveSub: { ...Typography.small, color: Colors.text.secondary },
  liveFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveEta: { ...Typography.bodyBold },
  liveSuiviBtn: { backgroundColor: Colors.client.bg, padding: 13, borderRadius: Radius.md, alignItems: 'center' },
  liveSuiviBtnText: { ...Typography.bodyBold, color: Colors.client.primary },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  pillText: { fontSize: 12, fontWeight: '700' },
  promoBanner: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg, backgroundColor: Colors.bg.elevated, borderRadius: Radius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.restaurant.primary + '33' },
  promoTag: { ...Typography.label, color: Colors.restaurant.primary, marginBottom: 4 },
  promoTitle: { ...Typography.h3 },
  promoSub: { ...Typography.small },
  promoBig: { fontSize: 30, fontWeight: '900', color: Colors.restaurant.primary },
  section: { marginBottom: Spacing.lg },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, marginBottom: 14 },
  sectionTitle: { ...Typography.h3, paddingHorizontal: Spacing.md, marginBottom: 12 },
  seeAll: { ...Typography.bodyBold, fontSize: 13 },
  catPill: { alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.bg.surface, borderRadius: Radius.lg, borderWidth: 1 },
  catLabel: { fontSize: 11, fontWeight: '700' },
  restoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.surface, borderRadius: Radius.xl, marginHorizontal: Spacing.md, marginBottom: 12, padding: 14, borderWidth: 1, borderColor: Colors.border.default },
  restoThumb: { width: 80, height: 80, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  fermeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  fermeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  restoName: { ...Typography.bodyBold, fontSize: 16 },
  restoCat: { ...Typography.small, marginTop: 3 },
  metaChip: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.sm },
  metaText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '600' },
  favBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  // Track
  trackCard: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg, backgroundColor: Colors.bg.elevated, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.client.primary + '33' },
  mapMock: { height: 150, backgroundColor: '#080E1E', justifyContent: 'center', alignItems: 'center' },
  mapMockBg: { fontSize: 60, opacity: 0.15 },
  livreurPin: { position: 'absolute', alignItems: 'center' },
  pinRipple: { position: 'absolute', bottom: -4, width: 36, height: 18, borderRadius: 18, borderWidth: 2, opacity: 0.5 },
  livreurInfoRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.default },
  livreurAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  livreurNom: { ...Typography.bodyBold, fontSize: 16 },
  livreurSub: { ...Typography.small, marginTop: 2 },
  callBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  etaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  etaLabel: { ...Typography.small },
  etaValue: { ...Typography.h2, fontSize: 20 },
  etapeRow: { flexDirection: 'row', paddingHorizontal: Spacing.md, marginBottom: 0 },
  etapeLeft: { width: 36, alignItems: 'center' },
  etapeDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.bg.elevated, borderWidth: 2, borderColor: Colors.border.default, marginTop: 2, justifyContent: 'center', alignItems: 'center' },
  etapeDotFait: { borderColor: Colors.client.primary },
  etapeDotPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.client.primary },
  etapeLine: { width: 2, flex: 1, backgroundColor: Colors.border.default, minHeight: 30, marginBottom: -4 },
  etapeRight: { flex: 1, paddingLeft: 12, paddingBottom: 24 },
  etapeLabel: { ...Typography.bodyBold, fontSize: 15, marginBottom: 6 },
  acteurChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, marginRight: 8 },
  acteurText: { fontSize: 11, fontWeight: '700' },
  etapeHeure: { ...Typography.small, fontSize: 12 },
  signalBtn: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center' },
  signalBtnText: { ...Typography.bodyBold, fontSize: 13 },
});
