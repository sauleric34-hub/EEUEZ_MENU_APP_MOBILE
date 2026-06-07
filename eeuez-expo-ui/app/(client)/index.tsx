import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  ScrollView, StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DrawerMenu, { DrawerItem } from '../../components/DrawerMenu';
import { PressableScale, ConfettiBurst, EmojiPop, FloatingReaction, PulseRing, useButtonPress } from '../../components/Animations';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, Radius, glow, glowSubtle, StatutConfig } from '../../constants/theme';
import { MOCK_CLIENT, RESTAURANTS_LISTE } from '../../data/mockData';
import { restaurantService } from '../../services/apiService';
import { useRouter } from 'expo-router';
import CarteScreen from '../../components/CarteScreen';
import ProfileScreen from '../../components/ProfileScreen';
import { useAppContext } from '../../context/AppContext';

// DRAWER_ITEMS sera généré dynamiquement dans le composant principal
// ...

function StatutPill({ statut }: { statut: string }) {
  const cfg = StatutConfig[statut] ?? StatutConfig.en_attente;
  return (
    <View style={[s.pill, { backgroundColor: cfg.bg }]}>
      <Text style={[s.pillText, { color: cfg.color }]}>{cfg.emoji} {cfg.label}</Text>
    </View>
  );
}

function RestoCard({ resto }: { resto: any }) {
  const { followedRestaurants, toggleFollowRestaurant } = useAppContext();
  const isFav = followedRestaurants.includes(resto.id);
  const { emojiVisible, triggerSuccess } = useButtonPress();
  const slideIn = useRef(new Animated.Value(0)).current;
  const opacityIn = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideIn, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(opacityIn, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleFav = () => {
    toggleFollowRestaurant(resto.id);
    if (!isFav) triggerSuccess('❤️');
  };

  return (
    <Animated.View style={{
      opacity: opacityIn,
      transform: [{ translateY: slideIn.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }]
    }}>
      <PressableScale style={s.restoCard} scaleDown={0.97} onPress={() => router.push(`/restaurant/${resto.id}`)}>
        <View style={[s.restoThumb, { backgroundColor: (resto.couleur || Colors.client.primary) + '22' }]}>
          <Text style={{ fontSize: 38 }}>{resto.logo || resto.emoji || '🍽️'}</Text>
          {!resto.isOuvert && (
            <View style={s.fermeOverlay}>
              <Text style={s.fermeText}>Fermé</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.restoName}>{resto.nom}</Text>
          <Text style={s.restoCat}>{resto.categorie} · {Math.round(resto.distance * 10) / 10 || 0} km</Text>
          <View style={[s.row, { gap: 8, marginTop: 8, flexWrap: 'wrap' }]}>
            <View style={s.metaChip}><Text style={s.metaText}>⭐ {resto.note || 0}</Text></View>
            <View style={s.metaChip}><Text style={s.metaText}>🕐 {resto.tempsLivraisonEstime || resto.temps || 0} min</Text></View>
            <View style={s.metaChip}><Text style={s.metaText}>{resto.fraisLivraison || resto.frais || 0}F livr.</Text></View>
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
function AccueilScreen({ onOpenDrawer, onNavigate }: { onOpenDrawer: () => void, onNavigate: (screen: string) => void }) {
  const { activeOrder, unreadCount } = useAppContext();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideIn = useRef(new Animated.Value(20)).current;
  const STATUTS = ['en_preparation', 'prete', 'livreur_assigne', 'en_livraison'];
  const [statutIdx, setStatutIdx] = useState(0);
  const { confettiVisible, emojiVisible, emoji: reactionEmoji, triggerSuccess } = useButtonPress();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loadingRestos, setLoadingRestos] = useState(true);
  const [address, setAddress] = useState('Recherche position...');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAddress('Localisation refusée');
        return;
      }
      try {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        let geocode = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          setAddress(`${place.street || place.name || place.subregion}, ${place.city || place.region}`);
        } else {
          setAddress('Position Inconnue');
        }
      } catch (e) {
        setAddress('Erreur localisation');
      }
    })();

    restaurantService.getMapRestaurants(3.86667, 11.51667, 50) // Mock coords Yaoundé
      .then(res => {
        if (!res.data || res.data.length === 0) {
          setRestaurants(RESTAURANTS_LISTE);
        } else {
          setRestaurants(res.data);
        }
      })
      .catch(err => {
        console.log("Info: Le backend est hors-ligne, chargement des données locales.");
        setRestaurants(RESTAURANTS_LISTE);
      })
      .finally(() => setLoadingRestos(false));
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideIn, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    const timer = setInterval(() => {
      setStatutIdx(prev => (prev < STATUTS.length - 1 ? prev + 1 : prev));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const router = useRouter();
  const handleSuivre = () => {
    triggerSuccess('🛵');
    router.push('/tracking/CMD-001');
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
              <Text style={s.greeting}>Bonjour, {MOCK_CLIENT.prenom} 👋</Text>
              <Text style={s.locationText}>📍 {address}</Text>
            </View>
            <PressableScale scaleDown={0.85} onPress={() => onNavigate('notifications')}>
              <View style={s.notifBtn}>
                {unreadCount > 0 ? (
                  <PulseRing color={Colors.danger} size={36}>
                    <Text style={{ fontSize: 20 }}>🔔</Text>
                  </PulseRing>
                ) : (
                  <Text style={{ fontSize: 20, opacity: 0.8 }}>🔔</Text>
                )}
              </View>
            </PressableScale>
          </View>
        </Animated.View>

        {/* Commande live (Uniquement s'il y a une vraie commande active) */}
        {activeOrder && (
          <Animated.View style={[s.liveCard, { opacity: fadeIn }, glow(Colors.client.glow, 14)]}>
            <View style={s.liveBadgeRow}>
              <View style={s.liveDotWrap}><View style={s.liveDot} /></View>
              <Text style={[s.liveLabel, { color: Colors.danger }]}>EN COURS</Text>
            </View>
            <Text style={s.liveTitle}>Commande #{activeOrder.id}</Text>
            <Text style={s.liveSub}>Total: {activeOrder.total} FCFA</Text>
            <View style={s.liveFooter}>
              <StatutPill statut={activeOrder.status} />
            </View>
            {/* Bouton avec FloatingReaction + confetti */}
            <View style={{ position: 'relative', alignItems: 'center' }}>
              <FloatingReaction emoji={reactionEmoji} visible={emojiVisible} />
              <ConfettiBurst visible={confettiVisible} />
              <PressableScale onPress={() => { triggerSuccess('🛵'); router.push(`/tracking/${activeOrder.id}`); }} style={{ width: '100%' }}>
                <View style={[s.liveSuiviBtn, glow(Colors.client.glow, 8)]}>
                  <Text style={s.liveSuiviBtnText}>📍 Suivre en direct</Text>
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
          {loadingRestos ? (
             <Text style={{ textAlign: 'center', padding: 20, color: Colors.text.muted }}>Recherche de restaurants...</Text>
          ) : restaurants.length > 0 ? (
             restaurants.map(resto => <RestoCard key={resto.id} resto={resto} />)
          ) : (
             <Text style={{ textAlign: 'center', padding: 20, color: Colors.text.muted }}>Aucun restaurant proche trouvé.</Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </SafeAreaView>
    </ScrollView>
  );
}

// ─── SUIVI TEMPS-RÉEL ─────────────────────────────────────────────────────
function SuiviScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { activeOrder } = useAppContext();
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

    // Simulation de l'avancée de la livraison
    const timer = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < 5) return prev + 1;
        clearInterval(timer);
        return prev;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentStep === 5) {
      setTimeout(() => triggerSuccess('🎉'), 500);
    }
  }, [currentStep]);

  const orderTime = activeOrder ? new Date(activeOrder.date) : new Date();
  const h = (offset: number) => {
    const d = new Date(orderTime.getTime() + offset * 60000);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const restoName = activeOrder?.items[0]?.nom || 'Restaurant';

  const ETAPES = [
    { label: 'Commande reçue',       heure: h(0), acteur: 'Client' },
    { label: 'Acceptée — 25 min',    heure: h(2), acteur: 'Restaurant' },
    { label: 'En préparation',       heure: h(3), acteur: restoName },
    { label: 'Livreur assigné',      heure: h(15), acteur: 'EEUEZ' },
    { label: 'En route vers vous',   heure: h(18), acteur: 'Livreur 🛵' },
    { label: 'Livraison estimée',    heure: `~${h(35)}`, acteur: '' },
  ];

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <SafeAreaView>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>
            {activeOrder ? `Suivi ${activeOrder.id}` : 'Suivi en Direct'}
          </Text>
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
          <Text style={s.sectionTitle}>{currentStep === 5 ? 'Commande Livrée !' : 'Progression de la Commande'}</Text>
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

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────
function NotificationsScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { activeOrder } = useAppContext();
  
  const notifs = [];
  if (activeOrder) {
    notifs.push({
      id: 1, type: 'info', emoji: '🛵',
      title: 'Livreur assigné !', 
      desc: `Un livreur a été assigné à votre commande ${activeOrder.id}.`,
      time: 'À l\'instant'
    });
    notifs.push({
      id: 2, type: 'success', emoji: '👨‍🍳',
      title: 'Commande en préparation', 
      desc: `Le restaurant a commencé à préparer votre commande.`,
      time: 'Il y a 10 min'
    });
  } else {
    notifs.push({
      id: 3, type: 'promo', emoji: '🎉',
      title: 'Bienvenue sur EEUEZ Menu', 
      desc: 'Découvrez nos restaurants et passez votre première commande !',
      time: 'Aujourd\'hui'
    });
  }

  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>Notifications</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {notifs.map(n => (
            <View key={n.id} style={[s.section, { flexDirection: 'row', alignItems: 'center', marginBottom: 12 }]}>
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                <Text style={{ fontSize: 24 }}>{n.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.bodyBold }}>{n.title}</Text>
                <Text style={{ ...Typography.small, color: Colors.text.secondary, marginTop: 4 }}>{n.desc}</Text>
                <Text style={{ ...Typography.small, color: Colors.text.muted, marginTop: 8 }}>{n.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── FAVORIS ──────────────────────────────────────────────────────────────
function FavorisScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { followedRestaurants } = useAppContext();
  const favoris = RESTAURANTS_LISTE.filter(r => followedRestaurants.includes(r.id.toString()));

  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>Restaurants Favoris</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {favoris.length > 0 ? (
            favoris.map(resto => <RestoCard key={resto.id} resto={resto} />)
          ) : (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ fontSize: 40 }}>❤️</Text>
              <Text style={{ ...Typography.h3, marginTop: 10 }}>Aucun favori</Text>
              <Text style={{ ...Typography.body, color: Colors.text.muted, textAlign: 'center', marginTop: 5 }}>
                Likez des restaurants pour les retrouver ici.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── COMMANDES ────────────────────────────────────────────────────────────
function CommandesScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { pastOrders, activeOrder } = useAppContext();
  
  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>Mes Commandes</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
          {activeOrder && (
            <View style={[s.section, { borderColor: Colors.client.primary, borderWidth: 1 }]}>
              <Text style={[s.sectionTitle, { color: Colors.client.primary }]}>En cours</Text>
              <Text style={Typography.bodyBold}>Commande #{activeOrder.id}</Text>
              <Text style={Typography.small}>{activeOrder.items.length} articles • {activeOrder.total} FCFA</Text>
            </View>
          )}

          {pastOrders.length > 0 ? (
            pastOrders.map(order => (
              <View key={order.id} style={[s.section, { marginBottom: 12 }]}>
                <View style={s.row}>
                  <Text style={Typography.bodyBold}>Commande #{order.id}</Text>
                  <StatutPill statut={order.status} />
                </View>
                <Text style={[Typography.small, { color: Colors.text.secondary, marginTop: 4 }]}>
                  {new Date(order.date).toLocaleString()}
                </Text>
                <Text style={[Typography.bodyBold, { color: Colors.client.primary, marginTop: 8 }]}>
                  {order.total} FCFA
                </Text>
              </View>
            ))
          ) : (
             !activeOrder && (
               <View style={{ alignItems: 'center', marginTop: 40 }}>
                 <Text style={{ fontSize: 40 }}>📦</Text>
                 <Text style={{ ...Typography.h3, marginTop: 10 }}>Aucune commande</Text>
                 <Text style={{ ...Typography.body, color: Colors.text.muted, textAlign: 'center', marginTop: 5 }}>
                   Vous n'avez pas encore passé de commande.
                 </Text>
               </View>
             )
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── DECONNEXION ──────────────────────────────────────────────────────────
function DeconnexionScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const router = useRouter();
  
  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 60, marginBottom: 20 }}>🚪</Text>
        <Text style={{ ...Typography.h2, marginBottom: 10 }}>À bientôt !</Text>
        <Text style={{ ...Typography.body, color: Colors.text.muted, marginBottom: 30 }}>
          Êtes-vous sûr de vouloir vous déconnecter ?
        </Text>
        
        <TouchableOpacity 
          style={[s.primaryBtn, { backgroundColor: Colors.danger, width: '80%', marginBottom: 15 }]}
          onPress={() => {
            // Fake logout, back to some index or close
            router.replace('/');
          }}
        >
          <Text style={s.primaryBtnText}>Oui, me déconnecter</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[s.primaryBtn, { backgroundColor: Colors.bg.surface, borderWidth: 1, borderColor: Colors.border.default, width: '80%' }]}
          onPress={() => onOpenDrawer()} // Just open drawer again or switch to accueil
        >
          <Text style={[s.primaryBtnText, { color: Colors.text.primary }]}>Annuler</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// ─── MES ADRESSES ────────────────────────────────────────────────────────
function AdressesScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [adresses, setAdresses] = useState([
    { id: '1', nom: 'Domicile', icon: '🏠', detail: 'Quartier Bastos, Yaoundé' },
    { id: '2', nom: 'Bureau', icon: '🏢', detail: 'Immeuble SNI, Yaoundé Centre' }
  ]);
  const [nouvelleAdresse, setNouvelleAdresse] = useState('');

  const ajouterAdresse = () => {
    if (nouvelleAdresse.trim() === '') return;
    setAdresses([...adresses, { id: Date.now().toString(), nom: 'Autre', icon: '📍', detail: nouvelleAdresse }]);
    setNouvelleAdresse('');
  };

  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>Mes Adresses</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {adresses.map(adr => (
            <View key={adr.id} style={[s.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 15 }]}>
              <Text style={{ fontSize: 30, marginRight: 15 }}>{adr.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.h3 }}>{adr.nom}</Text>
                <Text style={{ color: Colors.text.secondary }}>{adr.detail}</Text>
              </View>
              <Text style={{ color: Colors.danger }}>🗑️</Text>
            </View>
          ))}

          <View style={{ marginTop: 20 }}>
            <Text style={{ ...Typography.h3, marginBottom: 10 }}>Ajouter une adresse</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{ flex: 1, height: 50, backgroundColor: Colors.bg.surface, borderRadius: Radius.md, paddingHorizontal: 15, color: Colors.text.primary }}
                placeholder="Nouvelle adresse..."
                placeholderTextColor={Colors.text.muted}
                value={nouvelleAdresse}
                onChangeText={setNouvelleAdresse}
              />
              <TouchableOpacity onPress={ajouterAdresse} style={{ marginLeft: 10, backgroundColor: Colors.client.primary, width: 50, height: 50, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 24 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── MES AVIS ─────────────────────────────────────────────────────────────
function AvisScreen({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [avis, setAvis] = useState([
    { id: '1', cible: 'La Pizzeria', text: 'Très bon service et pizzas excellentes !', note: 5, date: '10 Juin 2026' }
  ]);
  const [nouveauTexte, setNouveauTexte] = useState('');

  const soumettreAvis = () => {
    if (nouveauTexte.trim() === '') return;
    setAvis([{ id: Date.now().toString(), cible: 'Commande Récente', text: nouveauTexte, note: 5, date: "À l'instant" }, ...avis]);
    setNouveauTexte('');
  };

  return (
    <View style={s.screen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.topBar}>
          <PressableScale onPress={onOpenDrawer}>
            <View style={s.hamburger}><Text style={s.hamburgerText}>☰</Text></View>
          </PressableScale>
          <Text style={[s.greeting, { fontSize: 18, flex: 1, marginLeft: 12 }]}>Mes Avis</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={[s.card, { marginBottom: 30 }]}>
            <Text style={{ ...Typography.h3, marginBottom: 10 }}>Laisser un avis</Text>
            <Text style={{ color: Colors.text.secondary, marginBottom: 10 }}>Note: ⭐⭐⭐⭐⭐</Text>
            <TextInput
              style={{ backgroundColor: Colors.bg.screen, borderRadius: Radius.md, padding: 15, color: Colors.text.primary, height: 100, textAlignVertical: 'top' }}
              placeholder="Écrivez votre avis sur votre dernière commande..."
              placeholderTextColor={Colors.text.muted}
              multiline
              value={nouveauTexte}
              onChangeText={setNouveauTexte}
            />
            <TouchableOpacity onPress={soumettreAvis} style={[s.primaryBtn, { marginTop: 15 }]}>
              <Text style={s.primaryBtnText}>Publier mon avis</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ ...Typography.h3, marginBottom: 15 }}>Historique de mes avis</Text>
          {avis.map(a => (
            <View key={a.id} style={[s.card, { marginBottom: 15 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ ...Typography.bodyBold }}>{a.cible}</Text>
                <Text style={{ color: Colors.text.muted }}>{a.date}</Text>
              </View>
              <Text style={{ color: '#FFD700', marginBottom: 5 }}>{'⭐'.repeat(a.note)}</Text>
              <Text style={{ color: Colors.text.secondary }}>"{a.text}"</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function ClientApp() {
  const { cart, activeOrder, unreadCount } = useAppContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screen, setScreen] = useState('accueil');
  const open = () => setDrawerOpen(true);

  const DRAWER_ITEMS: DrawerItem[] = [
    { key: 'accueil',       label: 'Accueil',              icon: '🏠', section: 'Découverte' },
    { key: 'carte',         label: 'Carte & Restaurants',  icon: '🗺️' },
    { key: 'scanner',       label: 'Scanner QR Code',      icon: '📷' },
    { key: 'panier',        label: 'Mon Panier',           icon: '🛒', badge: cart.length > 0 ? cart.length : undefined, section: 'Commandes' },
    { key: 'commandes',     label: 'Mes Commandes',        icon: '📦' },
    ...(activeOrder ? [{ key: 'suivi', label: 'Suivi en cours', icon: '📍' }] : []),
    { key: 'favoris',       label: 'Restaurants Favoris',  icon: '❤️', section: 'Mon Compte' },
    { key: 'adresses',      label: 'Mes Adresses',         icon: '📌' },
    { key: 'paiements',     label: 'Paiements',            icon: '💳' },
    { key: 'avis',          label: 'Mes Avis',             icon: '⭐' },
    { key: 'notifications', label: 'Notifications',        icon: '🔔', badge: unreadCount > 0 ? unreadCount : undefined },
    { key: 'profil',        label: 'Mon Profil',           icon: '👤' },
    { key: 'aide',          label: 'Aide & Support',       icon: '💬', section: 'Support' },
    { key: 'deconnexion',   label: 'Se déconnecter',       icon: '🚪', danger: true },
  ];

  const screens: Record<string, JSX.Element> = {
    accueil:       <AccueilScreen onOpenDrawer={open} onNavigate={setScreen} />,
    carte:         <CarteScreen onOpenDrawer={open} />,
    scanner:       <PlaceholderScreen title="Scanner QR Code (UC-X1)" emoji="📷" onOpenDrawer={open} />,
    panier:        <PlaceholderScreen title="Mon Panier" emoji="🛒" desc="2 articles · 8 000 FCFA" onOpenDrawer={open} />,
    commandes:     <CommandesScreen onOpenDrawer={open} />,
    suivi:         <SuiviScreen onOpenDrawer={open} />,
    favoris:       <FavorisScreen onOpenDrawer={open} />,
    adresses:      <AdressesScreen onOpenDrawer={open} />,
    paiements:     <PlaceholderScreen title="Paiements" emoji="💳" onOpenDrawer={open} />,
    avis:          <AvisScreen onOpenDrawer={open} />,
    notifications: <NotificationsScreen onOpenDrawer={open} />,
    profil:        <ProfileScreen onOpenDrawer={open} />,
    aide:          <PlaceholderScreen title="Aide & Support (UC-X8)" emoji="💬" onOpenDrawer={open} />,
    deconnexion:   <DeconnexionScreen onOpenDrawer={open} />,
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
