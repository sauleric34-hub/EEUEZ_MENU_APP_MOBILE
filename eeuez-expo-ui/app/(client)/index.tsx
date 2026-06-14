import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, StatusBar, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DrawerMenu, { DrawerItem } from '../../components/DrawerMenu';
import { PressableScale, ConfettiBurst, EmojiPop, FloatingReaction, PulseRing, useButtonPress } from '../../components/Animations';
import { Colors, Typography, Spacing, Radius, glow, glowSubtle, StatutConfig } from '../../constants/theme';

const DRAWER_ITEMS: DrawerItem[] = [
  { key: 'accueil',       label: 'Accueil',              icon: '🏠', section: 'Découverte' },
  { key: 'carte',         label: 'Carte & Restaurants',  icon: '🗺️' },
  { key: 'scanner',       label: 'Scanner QR Code',      icon: '📷' },
  { key: 'panier',        label: 'Mon Panier',           icon: '🛒', badge: 2, section: 'Commandes' },
  { key: 'historique',    label: 'Historique des commandes', icon: '📜' },
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

import { restaurantService, commandeService } from '../../services/apiService';
import { useAppContext } from '../../context/AppContext';

function RestoCard({ resto }: { resto: any }) {
  const [isFav, setIsFav] = useState(false);
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

  const router = useRouter();

  return (
    <Animated.View style={{
      opacity: opacityIn,
      transform: [{ translateY: slideIn.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }]
    }}>
      <PressableScale style={s.restoCard} scaleDown={0.97} onPress={() => router.push(`/(client)/restaurant/${resto.id}` as any)}>
        <View style={[s.restoThumb, { backgroundColor: Colors.bg.elevated }]}>
          <Text style={{ fontSize: 38 }}>{resto.logo ? '🍽️' : '🏪'}</Text>
          {!resto.isOuvert && (
            <View style={s.fermeOverlay}>
              <Text style={s.fermeText}>Fermé</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.restoName}>{resto.nom || resto.nomEtablissement}</Text>
          <Text style={s.restoCat}>Restaurant · {resto.distance ? resto.distance.toFixed(1) : '1.2'} km</Text>
          <View style={[s.row, { gap: 8, marginTop: 8, flexWrap: 'wrap' }]}>
            <View style={s.metaChip}><Text style={s.metaText}>⭐ {resto.noteGlobale || resto.note || 4.5}</Text></View>
            <View style={s.metaChip}><Text style={s.metaText}>🕐 {resto.tempsLivraisonMoyen || 30} min</Text></View>
            <View style={s.metaChip}><Text style={s.metaText}>{resto.fraisLivraison || 500}F livr.</Text></View>
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
  
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeOrder, setActiveOrderLocal] = useState<any>(null);
  const [hasUnreadNotif, setHasUnreadNotif] = useState(false);
  const prevStatut = useRef<string | null>(null);
  const [locationName, setLocationName] = useState('Recherche position...');
  const [loadingRestos, setLoadingRestos] = useState(true);
  const [errorRestos, setErrorRestos] = useState(false);
  const router = useRouter();
  
  const { confettiVisible, emojiVisible, emoji: reactionEmoji, triggerSuccess } = useButtonPress();

  const filteredRestaurants = restaurants.filter(resto => {
    // 1. Search filter
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      const matchName = (resto.nom || resto.nomEtablissement || '').toLowerCase().includes(q);
      const matchCat = (resto.categorie || '').toLowerCase().includes(q);
      if (!matchName && !matchCat) return false;
    }

    // 2. Category filter
    if (!selectedCat) return true;
    const catLower = (resto.categorie || '').toLowerCase();
    
    switch (selectedCat) {
      case 'Populaire':
        return (resto.noteGlobale || resto.note || 0) >= 4.5;
      case 'Tradition':
        return catLower.includes('tradition') || catLower.includes('camerounais') || catLower.includes('africain');
      case 'Grillades':
        return catLower.includes('grill') || catLower.includes('braisé') || catLower.includes('viande');
      case 'Fast Food':
        return catLower.includes('fast') || catLower.includes('burger');
      case 'Pizza':
        return catLower.includes('pizza') || catLower.includes('pizz');
      case 'Boissons':
        return catLower.includes('boisson') || catLower.includes('jus') || catLower.includes('bar');
      case 'Desserts':
        return catLower.includes('dessert') || catLower.includes('sucr') || catLower.includes('gâteau') || catLower.includes('patiss');
      default:
        return catLower.includes(selectedCat.toLowerCase());
    }
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideIn, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    
    const initLocationAndFetch = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        let lat = 3.848;
        let lon = 11.502; // Default Yaoundé
        
        if (status === 'granted') {
          let loc = await Location.getCurrentPositionAsync({});
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
          let addr = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (addr && addr.length > 0) {
            const locName = addr[0].district || addr[0].city || addr[0].subregion || 'Inconnu';
            const locCity = addr[0].city || addr[0].region || '';
            setLocationName(`${locName}${locCity ? ', ' + locCity : ''}`);
          } else {
            setLocationName('Position inconnue');
          }
        } else {
          setLocationName('Position par défaut (Yaoundé)');
        }
        
        // Helper function for retrying the fetch
        const fetchWithRetry = async (latitude: number, longitude: number, retries = 5, delay = 2000) => {
          for (let i = 0; i < retries; i++) {
            try {
              const data: any = await restaurantService.getMapRestaurants(latitude, longitude);
              setRestaurants(data.slice(0, 5));
              setLoadingRestos(false);
              setErrorRestos(false);
              return; // Success, exit retry loop
            } catch (err) {
              console.log(`Erreur fetch restos (essai ${i + 1}/${retries})`, err);
              if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
              } else {
                throw err; // All retries failed
              }
            }
          }
        };

        await fetchWithRetry(lat, lon, 9999, 3000); // Retry infiniment toutes les 3s

      } catch (err) {
        console.log('Erreur fetch restos finale', err);
        setLoadingRestos(false);
        setErrorRestos(true);
        if (locationName === 'Recherche position...') {
          setLocationName('Erreur localisation');
        }
      }
    };

    initLocationAndFetch();
      
    const fetchOrder = async () => {
      try {
        const data: any = await commandeService.getHistorique();
        const active = data.find((c: any) => c.statut !== 'livree' && c.statut !== 'annulee');
        if (active) setActiveOrderLocal(active);
        else setActiveOrderLocal(null);
      } catch(e) {}
    };
    
    fetchOrder();
    const orderInterval = setInterval(fetchOrder, 3000); // Poll status every 3s
    
    return () => clearInterval(orderInterval);
  }, []);

  useEffect(() => {
    if (activeOrder) {
      if (prevStatut.current && prevStatut.current !== activeOrder.statut) {
         setHasUnreadNotif(true); // Statut changé = Nouvelle notification !
         
         // Enregistrer la notification en local
         const cfg = StatutConfig[activeOrder.statut as keyof typeof StatutConfig] || { label: activeOrder.statut, emoji: '🔔', color: Colors.client.primary, bg: Colors.client.bg };
         const newNotif = {
           id: Date.now().toString(),
           title: `Commande #${activeOrder.id}`,
           message: `Le statut de votre commande est maintenant : ${cfg.label} ${cfg.emoji}`,
           time: new Date().toLocaleTimeString().slice(0, 5),
           color: cfg.color,
           bg: cfg.bg,
           read: false
         };
         AsyncStorage.getItem('eeuez_notifs').then(str => {
            const arr = str ? JSON.parse(str) : [];
            AsyncStorage.setItem('eeuez_notifs', JSON.stringify([newNotif, ...arr]));
         });
      }
      prevStatut.current = activeOrder.statut;
    } else {
      prevStatut.current = null;
    }
  }, [activeOrder]);

  const handleSuivre = () => {
    triggerSuccess('🛵');
    router.push('/(client)/suivi' as any);
  };

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
              <Text style={s.greeting}>Bonjour 👋</Text>
              <Text style={s.locationText}>📍 {locationName}</Text>
            </View>
            <PressableScale scaleDown={0.85} onPress={() => {
              setHasUnreadNotif(false);
              router.push('/(client)/notifications' as any);
            }}>
              <View style={s.notifBtn}>
                {hasUnreadNotif ? (
                  <PulseRing color={Colors.danger} size={36}>
                    <Text style={{ fontSize: 20 }}>🔔</Text>
                  </PulseRing>
                ) : (
                  <Text style={{ fontSize: 20, padding: 8 }}>🔔</Text>
                )}
              </View>
            </PressableScale>
          </View>

          {/* Barre de recherche */}
          <View style={[s.searchBar, { paddingVertical: 0, paddingLeft: Spacing.md }]}>
            <Text style={{ fontSize: 18 }}>🔍</Text>
            <TextInput
              placeholder="Rechercher un plat, un restaurant…"
              placeholderTextColor={Colors.text.muted}
              style={[s.searchPlaceholder, { color: Colors.text.primary, height: 50 }]}
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity style={[s.filterBtn, { backgroundColor: Colors.client.bg }]}>
              <Text style={[s.filterText, { color: Colors.client.primary }]}>Filtres</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Commande live — statut animé */}
        {activeOrder && (
          <Animated.View style={[s.liveCard, { opacity: fadeIn }, glow(Colors.client.glow, 14)]}>
            <View style={s.liveBadgeRow}>
              <View style={s.liveDotWrap}><View style={s.liveDot} /></View>
              <Text style={[s.liveLabel, { color: Colors.danger }]}>EN COURS</Text>
            </View>
            <Text style={s.liveTitle}>Commande #{activeOrder.id}</Text>
            <Text style={s.liveSub}>{activeOrder.lignes?.length || 0} articles en préparation</Text>
            <View style={s.liveFooter}>
              <StatutPill statut={activeOrder.statut} />
              <Text style={[s.liveEta, { color: Colors.client.primary }]}>~{activeOrder.delai_estime || 25} min</Text>
            </View>
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
        )}

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
              <PressableScale
                key={cat.l}
                style={[
                  s.catPill,
                  {
                    borderColor: cat.c + '44',
                    backgroundColor: selectedCat === cat.l ? cat.c : Colors.bg.surface
                  }
                ] as any}
                scaleDown={0.9}
                onPress={() => setSelectedCat(selectedCat === cat.l ? null : cat.l)}
              >
                <Text style={{ fontSize: 22 }}>{cat.e}</Text>
                <Text style={[
                  s.catLabel,
                  { color: selectedCat === cat.l ? '#FFF' : cat.c }
                ]}>{cat.l}</Text>
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
          {filteredRestaurants.length > 0 ? (
            filteredRestaurants.map(resto => <RestoCard key={resto.id} resto={resto} />)
          ) : loadingRestos ? (
            <Text style={{ textAlign: 'center', marginVertical: 20, color: Colors.text.muted }}>
              Chargement des restaurants...
            </Text>
          ) : errorRestos ? (
            <Text style={{ textAlign: 'center', marginVertical: 20, color: Colors.danger }}>
              Erreur de connexion au serveur.
            </Text>
          ) : (
            <Text style={{ textAlign: 'center', marginVertical: 20, color: Colors.text.muted }}>
              Aucun restaurant trouvé.
            </Text>
          )}
        </View>

      </SafeAreaView>
    </ScrollView>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function ClientApp() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const router = useRouter();
  const open = () => setDrawerOpen(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const data: any = await commandeService.getHistorique();
        const active = data.some((c: any) => c.statut !== 'livree' && c.statut !== 'annulee');
        setHasActiveOrder(active);
      } catch(e) {}
    };
    fetchOrder();
    const int = setInterval(fetchOrder, 3000);
    return () => clearInterval(int);
  }, []);

  const handleNavigate = (key: string) => {
    setDrawerOpen(false);
    switch (key) {
      case 'accueil':
        break; // Déjà ici
      case 'panier':
        router.push('/(client)/cart' as any);
        break;
      case 'historique':
        router.push('/(client)/historique' as any);
        break;
      case 'carte':
        router.push('/(client)/explore' as any);
        break;
      case 'favoris':
        router.push('/(client)/favorites' as any);
        break;
      case 'profil':
        router.push('/(client)/profile' as any);
        break;
      case 'notifications':
        router.push('/(client)/notifications' as any);
        break;
      case 'suivi':
        router.push('/(client)/suivi' as any);
        break;
      default:
        console.log("Nav vers", key);
        break;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg.screen }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.app} />
      
      <AccueilScreen onOpenDrawer={open} />
      
      <DrawerMenu
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={DRAWER_ITEMS.filter(item => item.key !== 'suivi' || hasActiveOrder)}
        activeKey={'accueil'}
        onNavigate={handleNavigate}
        headerTitle={`Client`}
        headerSubtitle="Yaoundé, Cameroun"
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
