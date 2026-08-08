// ═══════════════════════════════════════════════════════════
//  AppContext — état global + accès au backend Django
//  Auth, catalogue (restos/plats/catégories), favoris,
//  abonnements, panier, commandes, suivi.
// ═══════════════════════════════════════════════════════════

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getPalette, type Palette, type ThemeMode } from '../constants/theme';
import {
  mapResto, mapPlat, mapCategory, statutToStep, DELIVERY_FEE,
  type Resto, type Dish, type Category,
} from '../data/menuData';
import * as authService from '../services/auth';
import * as menu from '../services/menu';
import { setAuthExpiredHandler } from '../services/http';
import * as addr from '../services/addresses';
import * as publications from '../services/publications';
import type { PaymentMode } from '../services/menu';
import type { UserDTO, CommandeDTO, AdresseDTO, BanniereDTO } from '../services/dto';
import { estCompteDemo } from '../constants/demo';

/** Complément retenu sur une ligne de panier (libellé figé pour l'affichage). */
export interface ComplementChoisi {
  optionId: number;
  groupeNom: string;
  optionNom: string;
  supplement: number;
}

/** Ce qui est réellement stocké dans le panier, sous une clé de ligne. */
export interface LignePanier {
  platId: number;
  qty: number;
  complements: ComplementChoisi[];
}

export interface CartLine {
  /** Identifie la ligne, pas le plat : un même plat peut figurer plusieurs
   *  fois avec des compléments différents. */
  cle: string;
  dish: Dish;
  qty: number;
  complements: ComplementChoisi[];
  /** Somme des suppléments, pour UNE unité. */
  supplement: number;
  /** Prix unitaire réellement facturé (plat + suppléments). */
  prixUnitaire: number;
}

/** Clé de ligne : « 12:3,7 ». Les identifiants sont triés pour que deux
 *  sélections identiques faites dans un ordre différent se regroupent. */
export function cleLigne(platId: number, optionIds: number[]): string {
  return `${platId}:${[...optionIds].sort((a, b) => a - b).join(',')}`;
}

/** Lieu de livraison choisi pour la commande en cours. */
export interface DeliveryTarget {
  adresse: string;
  details?: string;
  latitude: number | null;
  longitude: number | null;
  label?: string;
  savedId?: number;
}

interface AppContextValue {
  // thème
  mode: ThemeMode;
  colors: Palette;
  toggleTheme: () => void;

  // préférences (persistées)
  notifsEnabled: boolean;
  setNotifsEnabled: (v: boolean) => void;
  promoEnabled: boolean;
  setPromoEnabled: (v: boolean) => void;

  // auth
  user: UserDTO | null;
  authReady: boolean;
  /** Compte de démonstration : navigation libre, actions engageantes bloquées. */
  estDemo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (p: authService.RegisterParams) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (p: authService.ProfileUpdate) => Promise<void>;
  /** Recharge le profil serveur (points, avatar…). */
  refreshUser: () => Promise<void>;

  // adresses de livraison enregistrées
  addresses: AdresseDTO[];
  reloadAddresses: () => Promise<void>;
  addAddress: (a: addr.NewAddress) => Promise<AdresseDTO>;
  removeAddress: (id: number) => Promise<void>;
  makeDefaultAddress: (id: number) => Promise<void>;
  deliveryAddress: DeliveryTarget | null;
  setDeliveryAddress: (a: DeliveryTarget | null) => void;

  // catalogue
  categories: Category[];
  restaurants: Resto[];
  plats: Dish[];
  popular: Dish[];
  dataLoading: boolean;
  dataError: string | null;
  reloadCatalogue: () => Promise<void>;

  // bannières promo (accueil) — mises en cache en mémoire, revérifiées
  // (requête légère) à chaque arrivée sur l'accueil ; ne se re-téléchargent
  // en entier que si la version a changé côté serveur.
  bannieres: BanniereDTO[];
  checkBannieres: () => Promise<void>;

  // géolocalisation & recommandations personnalisées
  userLoc: { lat: number; lon: number } | null;
  recommended: Dish[];
  recoRestos: Resto[];
  positionUsed: boolean;
  reloadRecommendations: () => Promise<void>;
  restoById: (id: number) => Resto | undefined;
  dishById: (id: number) => Dish | undefined;
  dishesOfResto: (id: number) => Dish[];

  // favoris
  likes: Record<number, boolean>;
  toggleLike: (id: number) => void;
  favList: Dish[];

  // abonnements
  follows: Record<number, boolean>;
  toggleFollow: (id: number) => void;
  isFollowing: (id: number) => boolean;

  // publications (fil social)
  pubLikes: Record<number, boolean>;
  togglePubLike: (id: number) => void;
  reloadPubLikes: () => Promise<void>;

  // panier
  /** Panier indexé par clé de ligne (plat + compléments), cf. cleLigne(). */
  cart: Record<string, LignePanier>;
  addToCart: (platId: number, qty?: number, complements?: ComplementChoisi[]) => void;
  /** Les trois suivantes prennent une CLÉ DE LIGNE, pas un identifiant de plat. */
  cartInc: (cle: string) => void;
  cartDec: (cle: string) => void;
  cartRemove: (cle: string) => void;
  clearCart: () => void;
  cartLines: CartLine[];
  cartCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;

  // commandes / suivi
  orders: CommandeDTO[];
  reloadOrders: () => Promise<void>;
  checkout: (mode?: PaymentMode, utiliserPoints?: boolean) => Promise<CommandeDTO>;
  activeOrder: CommandeDTO | null;
  trackStep: number;
}

const AppContext = createContext<AppContextValue | null>(null);

const PREFS_KEY = '@menu_prefs';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [notifsEnabled, setNotifsEnabledState] = useState(true);
  const [promoEnabled, setPromoEnabledState] = useState(true);

  // Charge / persiste les préférences
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then(raw => {
      if (!raw) return;
      try {
        const p = JSON.parse(raw);
        if (p.mode === 'light' || p.mode === 'dark') setMode(p.mode);
        if (typeof p.notifs === 'boolean') setNotifsEnabledState(p.notifs);
        if (typeof p.promo === 'boolean') setPromoEnabledState(p.promo);
      } catch { /* préférences corrompues : on repart des défauts */ }
    });
  }, []);
  const persistPrefs = (patch: Record<string, unknown>) => {
    AsyncStorage.mergeItem(PREFS_KEY, JSON.stringify(patch)).catch(() => {});
  };
  const setNotifsEnabled = (v: boolean) => { setNotifsEnabledState(v); persistPrefs({ notifs: v }); };
  const setPromoEnabled = (v: boolean) => { setPromoEnabledState(v); persistPrefs({ promo: v }); };

  // auth
  const [user, setUser] = useState<UserDTO | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // Dérivé de l'e-mail : reste juste après un redémarrage de l'app.
  const estDemo = estCompteDemo(user?.email);

  // catalogue
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurants, setRestaurants] = useState<Resto[]>([]);
  const [plats, setPlats] = useState<Dish[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // bannières promo (accueil)
  const [bannieres, setBannieres] = useState<BanniereDTO[]>([]);
  // Dernière version connue : en mémoire seulement (pas de persistance disque),
  // donc redemandée au serveur au redémarrage de l'app — c'est voulu.
  const bannieresVersionRef = useRef<string | null>(null);

  // état utilisateur
  const [likes, setLikes] = useState<Record<number, boolean>>({});
  const [follows, setFollows] = useState<Record<number, boolean>>({});
  const [pubLikes, setPubLikes] = useState<Record<number, boolean>>({});
  const [cart, setCart] = useState<Record<string, LignePanier>>({});
  const [orders, setOrders] = useState<CommandeDTO[]>([]);
  const [addresses, setAddresses] = useState<AdresseDTO[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryTarget | null>(null);

  // géolocalisation & recommandations
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [recommended, setRecommended] = useState<Dish[]>([]);
  const [recoRestos, setRecoRestos] = useState<Resto[]>([]);
  const [positionUsed, setPositionUsed] = useState(false);

  /** Position de l'utilisateur (permission demandée une fois, échec silencieux). */
  const getLocation = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!pos) return null;
      const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setUserLoc(loc);
      return loc;
    } catch {
      return null;
    }
  }, []);

  /** Charge les suggestions personnalisées (proximité + popularité + fraîcheur). */
  const reloadRecommendations = useCallback(async () => {
    try {
      const loc = userLoc ?? await getLocation();
      const reco = await menu.fetchRecommendations(loc?.lat, loc?.lon);
      setPositionUsed(reco.position_utilisee);
      setRecommended(reco.plats.map(p => ({
        ...mapPlat(p), distanceKm: p.distance_km, etaMin: p.temps_estime,
      })));
      setRecoRestos(reco.restaurants.map(r => ({
        ...mapResto(r), distanceKm: r.distance_km, etaMin: r.temps_estime,
      })));
    } catch {
      // pas bloquant : l'accueil retombe sur les plats populaires
    }
  }, [userLoc, getLocation]);

  // ─── Chargement initial ────────────────────────────────────
  const reloadCatalogue = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [cats, restos, dishes] = await Promise.all([
        menu.fetchCategories(),
        menu.fetchRestaurants(),
        menu.fetchPlats(),
      ]);
      setCategories(cats.map(mapCategory));
      setRestaurants(restos.map(mapResto));
      setPlats(dishes.map(mapPlat));
    } catch (e) {
      setDataError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setDataLoading(false);
    }
  }, []);

  /** Vérifie une version légère avant de retélécharger la liste complète
   *  (images incluses) — appelée à chaque arrivée sur l'accueil. */
  const checkBannieres = useCallback(async () => {
    try {
      const { version } = await menu.fetchBannieresVersion();
      if (version === bannieresVersionRef.current) return;
      const list = await menu.fetchBannieres();
      bannieresVersionRef.current = version;
      setBannieres(list);
    } catch {
      // hors ligne ou erreur réseau : on garde la liste déjà en mémoire
    }
  }, []);

  const loadUserState = useCallback(async () => {
    try {
      const [favs, abos] = await Promise.all([menu.fetchFavoris(), menu.fetchAbonnements()]);
      setLikes(Object.fromEntries(favs.map(f => [f.plat, true])));
      setFollows(Object.fromEntries(abos.map(a => [a.restaurant, true])));
    } catch {
      // silencieux : l'utilisateur n'est peut-être pas connecté
    }
    // Les likes de publications sont chargés à part : une erreur ici ne doit
    // pas empêcher favoris et abonnements d'être hydratés.
    try {
      const liked = await publications.fetchPublicationsLikees();
      setPubLikes(Object.fromEntries(liked.map(p => [p.id, true])));
    } catch {
      // idem
    }
  }, []);

  const reloadOrders = useCallback(async () => {
    try {
      const all = await menu.fetchOrders();
      // On masque les commandes dont le paiement mobile money n'a pas abouti :
      // tant que ce n'est pas payé, ce n'est pas une commande (ça reste au panier).
      setOrders(all.filter(o => o.paiement_confirme !== false));
    } catch {
      setOrders([]);
    }
  }, []);

  // ─── Adresses de livraison ─────────────────────────────────
  const reloadAddresses = useCallback(async () => {
    try {
      const list = await addr.fetchAddresses();
      setAddresses(list);
      // Sélectionne l'adresse par défaut si aucune n'est encore choisie
      setDeliveryAddress(cur => {
        if (cur) return cur;
        const def = list.find(a => a.is_default) ?? list[0];
        return def
          ? { adresse: def.adresse, details: def.details, latitude: Number(def.latitude), longitude: Number(def.longitude), label: def.label, savedId: def.id }
          : null;
      });
    } catch {
      setAddresses([]);
    }
  }, []);

  const addAddress = useCallback(async (a: addr.NewAddress) => {
    const created = await addr.createAddress(a);
    await reloadAddresses();
    return created;
  }, [reloadAddresses]);

  const removeAddress = useCallback(async (id: number) => {
    await addr.deleteAddress(id);
    setDeliveryAddress(cur => (cur?.savedId === id ? null : cur));
    await reloadAddresses();
  }, [reloadAddresses]);

  const makeDefaultAddress = useCallback(async (id: number) => {
    await addr.setDefaultAddress(id);
    await reloadAddresses();
  }, [reloadAddresses]);

  useEffect(() => {
    (async () => {
      const stored = await authService.getStoredUser();
      if (stored) setUser(stored);
      setAuthReady(true);
      await reloadCatalogue();
      await reloadRecommendations();
      await checkBannieres();
      if (stored) {
        await loadUserState();
        await reloadOrders();
        await reloadAddresses();
        // Les points ont pu évoluer côté serveur depuis la dernière session.
        await refreshUser();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auth ──────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    const u = await authService.login(email, password);
    setUser(u);
    await loadUserState();
    await reloadOrders();
    await reloadAddresses();
  };
  const register = async (p: authService.RegisterParams) => {
    const u = await authService.registerClient(p);
    setUser(u);
    await reloadOrders();
    await reloadAddresses();
  };
  const updateUser = async (p: authService.ProfileUpdate) => {
    const u = await authService.updateProfile(p);
    setUser(u);
  };

  /** Recharge le profil depuis le serveur.
   *  Indispensable pour les points : ils évoluent côté serveur (quelqu'un
   *  aime ou commente votre publication), sans aucune action de votre part. */
  const refreshUser = useCallback(async () => {
    try {
      const frais = await authService.fetchProfile();
      setUser(frais);
      await authService.storeUser(frais);
    } catch {
      // Hors ligne ou session expirée : on garde la copie locale.
    }
  }, []);
  const signOut = async () => {
    await authService.logout();
    setUser(null);
    setLikes({});
    setFollows({});
    setPubLikes({});
    setCart({});
    setOrders([]);
    setAddresses([]);
    setDeliveryAddress(null);
  };

  // Session périmée (token invalidé / refresh échoué) : le client HTTP a déjà
  // effacé les jetons, on remet l'app dans l'état déconnecté.
  useEffect(() => {
    setAuthExpiredHandler(() => {
      setUser(null);
      setLikes({});
      setFollows({});
      setPubLikes({});
      setOrders([]);
      setAddresses([]);
      setDeliveryAddress(null);
    });
    return () => setAuthExpiredHandler(null);
  }, []);

  // ─── Thème ─────────────────────────────────────────────────
  const toggleTheme = () => setMode(m => {
    const next = m === 'dark' ? 'light' : 'dark';
    persistPrefs({ mode: next });
    return next;
  });

  // ─── Caches de lookup ──────────────────────────────────────
  const restoMap = useMemo(() => new Map(restaurants.map(r => [r.id, r])), [restaurants]);
  const dishMap = useMemo(() => new Map(plats.map(d => [d.id, d])), [plats]);
  const restoById = useCallback((id: number) => restoMap.get(id), [restoMap]);
  const dishById = useCallback((id: number) => dishMap.get(id), [dishMap]);
  const dishesOfResto = useCallback((id: number) => plats.filter(d => d.restoId === id), [plats]);
  const popular = useMemo(() => {
    const pop = plats.filter(d => d.isPopular);
    return (pop.length ? pop : plats).slice(0, 8);
  }, [plats]);
  const favList = useMemo(() => plats.filter(d => likes[d.id]), [plats, likes]);

  // ─── Favoris (optimiste puis réconcilié avec la réponse serveur) ───────
  const toggleLike = (id: number) => {
    setLikes(s => ({ ...s, [id]: !s[id] }));
    menu.toggleFavori(id)
      .then(res => setLikes(Object.fromEntries(res.favoris.map(p => [p, true]))))
      .catch(() => setLikes(s => ({ ...s, [id]: !s[id] })));
  };
  const toggleFollow = (id: number) => {
    setFollows(s => ({ ...s, [id]: !s[id] }));
    menu.toggleAbonnement(id)
      .then(res => setFollows(Object.fromEntries(res.abonnements.map(r => [r, true]))))
      .catch(() => setFollows(s => ({ ...s, [id]: !s[id] })));
  };

  // ─── Likes de publications (même schéma optimiste/réconcilié) ──────────
  const togglePubLike = (id: number) => {
    setPubLikes(s => ({ ...s, [id]: !s[id] }));
    publications.togglePublicationLike(id)
      .then(res => setPubLikes(Object.fromEntries(res.publications_likees.map(p => [p, true]))))
      .catch(() => setPubLikes(s => ({ ...s, [id]: !s[id] })));
  };

  const reloadPubLikes = useCallback(async () => {
    try {
      const liked = await publications.fetchPublicationsLikees();
      setPubLikes(Object.fromEntries(liked.map(p => [p.id, true])));
    } catch {
      // Utilisateur déconnecté : on n'écrase pas l'état existant.
    }
  }, []);

  // ─── Panier ────────────────────────────────────────────────
  // Le panier est indexé par CLÉ DE LIGNE (plat + compléments choisis), et non
  // par plat : le même Poulet DG avec des frites et avec du riz sont deux
  // lignes distinctes, à quantités et prix distincts.
  const addToCart = (
    platId: number, qty = 1, complements: ComplementChoisi[] = [],
  ) => {
    const cle = cleLigne(platId, complements.map(c => c.optionId));
    setCart(s => ({
      ...s,
      [cle]: {
        platId,
        complements,
        qty: (s[cle]?.qty || 0) + qty,
      },
    }));
  };

  const cartInc = (cle: string) => setCart(s => (
    s[cle] ? { ...s, [cle]: { ...s[cle], qty: s[cle].qty + 1 } } : s
  ));

  const cartDec = (cle: string) => setCart(s => {
    const ligne = s[cle];
    if (!ligne) return s;
    const next = { ...s };
    if (ligne.qty <= 1) delete next[cle];
    else next[cle] = { ...ligne, qty: ligne.qty - 1 };
    return next;
  });

  const cartRemove = (cle: string) => setCart(s => {
    const next = { ...s }; delete next[cle]; return next;
  });

  const cartLines = useMemo<CartLine[]>(
    () => Object.entries(cart)
      .map(([cle, ligne]) => {
        const dish = dishMap.get(ligne.platId);
        if (!dish) return null;
        const supplement = ligne.complements.reduce((a, c) => a + c.supplement, 0);
        return {
          cle, dish, qty: ligne.qty,
          complements: ligne.complements,
          supplement,
          prixUnitaire: dish.price + supplement,
        };
      })
      .filter((l): l is CartLine => l !== null),
    [cart, dishMap],
  );

  const cartCount = useMemo(
    () => Object.values(cart).reduce((a, l) => a + l.qty, 0), [cart],
  );
  // Le sous-total inclut les suppléments : c'est ce que le client voit et paie.
  const subtotal = useMemo(
    () => cartLines.reduce((a, l) => a + l.prixUnitaire * l.qty, 0), [cartLines],
  );
  const deliveryFee = useMemo(() => {
    if (!cartLines.length) return 0;
    // Frais de livraison = le plus élevé parmi les plats du panier (une seule livraison).
    // Repli sur le frais du restaurant puis la constante par défaut.
    const platFees = cartLines.map(l => l.dish.fraisLivraison).filter(f => f > 0);
    if (platFees.length) return Math.max(...platFees);
    const resto = restoMap.get(cartLines[0].dish.restoId);
    return resto?.fraisLivraison ?? DELIVERY_FEE;
  }, [cartLines, restoMap]);

  // ─── Commandes / suivi ─────────────────────────────────────
  const checkout = async (
    mode: PaymentMode = 'especes', utiliserPoints = false,
  ): Promise<CommandeDTO> => {
    if (!cartLines.length) throw new Error('Panier vide');
    if (!deliveryAddress || !deliveryAddress.adresse) {
      throw new Error('Choisissez un lieu de livraison.');
    }
    const restaurant = cartLines[0].dish.restoId;
    const items = cartLines
      .filter(l => l.dish.restoId === restaurant)
      // On n'envoie QUE les identifiants d'options : le serveur retrouve les
      // prix lui-même. Transmettre un montant depuis l'app le rendrait
      // falsifiable.
      .map(l => ({
        plat_id: l.dish.id,
        quantite: l.qty,
        complements: l.complements.map(c => c.optionId),
      }));
    const adresseText = [deliveryAddress.adresse, deliveryAddress.details].filter(Boolean).join(' — ');
    const order = await menu.createOrder({
      restaurant, adresse_livraison: adresseText, items, mode_paiement: mode,
      // Coordonnées GPS précises du lieu de livraison → carte du livreur + suivi
      latitude: deliveryAddress.latitude ?? userLoc?.lat ?? null,
      longitude: deliveryAddress.longitude ?? userLoc?.lon ?? null,
      utiliser_points: utiliserPoints,
    });
    // La dépense de points modifie le solde : on resynchronise le profil.
    if (utiliserPoints) await refreshUser();
    // On NE vide PAS le panier ici : pour le mobile money la commande n'existe
    // vraiment qu'une fois payée. Le panier est vidé par l'appelant (espèces
    // tout de suite, mobile money seulement après confirmation du paiement).
    await reloadOrders();
    return order;
  };

  const clearCart = () => setCart({});

  const activeOrder = useMemo(() => {
    const live = orders.filter(o => o.statut !== 'livree' && o.statut !== 'refusee' && o.statut !== 'annulee');
    return (live[0] ?? orders[0]) ?? null;
  }, [orders]);
  const trackStep = useMemo(
    () => (activeOrder ? statutToStep(activeOrder.livraison_statut || activeOrder.statut) : 0),
    [activeOrder],
  );

  const colors = useMemo(() => getPalette(mode), [mode]);

  const value: AppContextValue = {
    mode, colors, toggleTheme,
    notifsEnabled, setNotifsEnabled, promoEnabled, setPromoEnabled,
    user, authReady, estDemo, signIn, register, signOut, updateUser, refreshUser,
    addresses, reloadAddresses, addAddress, removeAddress, makeDefaultAddress, deliveryAddress, setDeliveryAddress,
    categories, restaurants, plats, popular, dataLoading, dataError, reloadCatalogue,
    bannieres, checkBannieres,
    userLoc, recommended, recoRestos, positionUsed, reloadRecommendations,
    restoById, dishById, dishesOfResto,
    likes, toggleLike, favList,
    follows, toggleFollow, isFollowing: (id) => !!follows[id],
    pubLikes, togglePubLike, reloadPubLikes,
    cart, addToCart, cartInc, cartDec, cartRemove, clearCart,
    cartLines, cartCount, subtotal, deliveryFee, total: subtotal + deliveryFee,
    orders, reloadOrders, checkout, activeOrder, trackStep,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé dans un AppProvider');
  return ctx;
}
