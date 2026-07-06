// ═══════════════════════════════════════════════════════════
//  AppContext — état global + accès au backend Django
//  Auth, catalogue (restos/plats/catégories), favoris,
//  abonnements, panier, commandes, suivi.
// ═══════════════════════════════════════════════════════════

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import { getPalette, type Palette, type ThemeMode } from '../constants/theme';
import {
  mapResto, mapPlat, mapCategory, statutToStep, DELIVERY_FEE,
  type Resto, type Dish, type Category,
} from '../data/menuData';
import * as authService from '../services/auth';
import * as menu from '../services/menu';
import type { PaymentMode } from '../services/menu';
import type { UserDTO, CommandeDTO } from '../services/dto';

export interface CartLine { dish: Dish; qty: number; }

interface AppContextValue {
  // thème
  mode: ThemeMode;
  colors: Palette;
  toggleTheme: () => void;

  // auth
  user: UserDTO | null;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (p: authService.RegisterParams) => Promise<void>;
  signOut: () => Promise<void>;

  // catalogue
  categories: Category[];
  restaurants: Resto[];
  plats: Dish[];
  popular: Dish[];
  dataLoading: boolean;
  dataError: string | null;
  reloadCatalogue: () => Promise<void>;

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

  // panier
  cart: Record<number, number>;
  addToCart: (id: number, qty?: number) => void;
  cartInc: (id: number) => void;
  cartDec: (id: number) => void;
  cartRemove: (id: number) => void;
  cartLines: CartLine[];
  cartCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;

  // commandes / suivi
  orders: CommandeDTO[];
  reloadOrders: () => Promise<void>;
  checkout: (adresse: string, mode?: PaymentMode) => Promise<CommandeDTO>;
  activeOrder: CommandeDTO | null;
  trackStep: number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  // auth
  const [user, setUser] = useState<UserDTO | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // catalogue
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurants, setRestaurants] = useState<Resto[]>([]);
  const [plats, setPlats] = useState<Dish[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // état utilisateur
  const [likes, setLikes] = useState<Record<number, boolean>>({});
  const [follows, setFollows] = useState<Record<number, boolean>>({});
  const [cart, setCart] = useState<Record<number, number>>({});
  const [orders, setOrders] = useState<CommandeDTO[]>([]);

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

  const loadUserState = useCallback(async () => {
    try {
      const [favs, abos] = await Promise.all([menu.fetchFavoris(), menu.fetchAbonnements()]);
      setLikes(Object.fromEntries(favs.map(f => [f.plat, true])));
      setFollows(Object.fromEntries(abos.map(a => [a.restaurant, true])));
    } catch {
      // silencieux : l'utilisateur n'est peut-être pas connecté
    }
  }, []);

  const reloadOrders = useCallback(async () => {
    try {
      setOrders(await menu.fetchOrders());
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await authService.getStoredUser();
      if (stored) setUser(stored);
      setAuthReady(true);
      await reloadCatalogue();
      await reloadRecommendations();
      if (stored) {
        await loadUserState();
        await reloadOrders();
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
  };
  const register = async (p: authService.RegisterParams) => {
    const u = await authService.registerClient(p);
    setUser(u);
    await reloadOrders();
  };
  const signOut = async () => {
    await authService.logout();
    setUser(null);
    setLikes({});
    setFollows({});
    setCart({});
    setOrders([]);
  };

  // ─── Thème ─────────────────────────────────────────────────
  const toggleTheme = () => setMode(m => (m === 'dark' ? 'light' : 'dark'));

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

  // ─── Favoris (optimiste + serveur) ─────────────────────────
  const toggleLike = (id: number) => {
    setLikes(s => ({ ...s, [id]: !s[id] }));
    menu.toggleFavori(id).catch(() => setLikes(s => ({ ...s, [id]: !s[id] })));
  };
  const toggleFollow = (id: number) => {
    setFollows(s => ({ ...s, [id]: !s[id] }));
    menu.toggleAbonnement(id).catch(() => setFollows(s => ({ ...s, [id]: !s[id] })));
  };

  // ─── Panier ────────────────────────────────────────────────
  const addToCart = (id: number, qty = 1) => setCart(s => ({ ...s, [id]: (s[id] || 0) + qty }));
  const cartInc = (id: number) => setCart(s => ({ ...s, [id]: (s[id] || 0) + 1 }));
  const cartDec = (id: number) => setCart(s => {
    const q = (s[id] || 0) - 1; const next = { ...s };
    if (q <= 0) delete next[id]; else next[id] = q;
    return next;
  });
  const cartRemove = (id: number) => setCart(s => { const next = { ...s }; delete next[id]; return next; });

  const cartLines = useMemo<CartLine[]>(
    () => Object.entries(cart)
      .map(([id, qty]) => { const dish = dishMap.get(Number(id)); return dish ? { dish, qty } : null; })
      .filter((l): l is CartLine => l !== null),
    [cart, dishMap],
  );
  const cartCount = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const subtotal = useMemo(() => cartLines.reduce((a, l) => a + l.dish.price * l.qty, 0), [cartLines]);
  const deliveryFee = useMemo(() => {
    if (!cartLines.length) return 0;
    const resto = restoMap.get(cartLines[0].dish.restoId);
    return resto?.fraisLivraison ?? DELIVERY_FEE;
  }, [cartLines, restoMap]);

  // ─── Commandes / suivi ─────────────────────────────────────
  const checkout = async (adresse: string, mode: PaymentMode = 'especes'): Promise<CommandeDTO> => {
    if (!cartLines.length) throw new Error('Panier vide');
    const restaurant = cartLines[0].dish.restoId;
    const items = cartLines
      .filter(l => l.dish.restoId === restaurant)
      .map(l => ({ plat_id: l.dish.id, quantite: l.qty }));
    const order = await menu.createOrder({ restaurant, adresse_livraison: adresse, items, mode_paiement: mode });
    setCart({});
    await reloadOrders();
    return order;
  };

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
    user, authReady, signIn, register, signOut,
    categories, restaurants, plats, popular, dataLoading, dataError, reloadCatalogue,
    userLoc, recommended, recoRestos, positionUsed, reloadRecommendations,
    restoById, dishById, dishesOfResto,
    likes, toggleLike, favList,
    follows, toggleFollow, isFollowing: (id) => !!follows[id],
    cart, addToCart, cartInc, cartDec, cartRemove,
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
