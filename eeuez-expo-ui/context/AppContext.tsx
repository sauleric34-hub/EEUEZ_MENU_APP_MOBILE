import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { commandeService } from '../services/apiService';

export type CartItem = {
  id: string;
  nom: string;
  prix: number;
  quantite: number;
  restaurantId: string;
};

export type Order = {
  id: string;
  status: string; // 'en_attente', 'en_preparation', 'livreur_assigne', 'en_livraison', 'livree'
  total: number;
  items: CartItem[];
  date: string;
};

export type SimulatedDelivery = {
  id: number;
  routePath: any[];
  displayRoute?: any[] | null;
  currentIndex: number;
  detoursDone: number;
  isRecalculating: boolean;
  detourMarker: any | null;
  clientPos: any;
  rPos: any;
  currentStep: number;
};

type AppContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  
  activeOrder: Order | null;
  setActiveOrder: (order: Order | null) => void;
  
  pastOrders: Order[];
  addPastOrder: (order: Order) => void;
  
  likedDishes: string[];
  toggleLikeDish: (id: string) => void;
  
  followedRestaurants: string[];
  toggleFollowRestaurant: (id: string) => void;
  
  notifications: any[];
  unreadCount: number;
  addNotification: (notif: any) => void;
  markNotificationsAsRead: () => void;

  simulatedDeliveries: SimulatedDelivery[];
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function getDistanceToPath(point: any, path: any[]) {
    if (!path || path.length === 0) return 0;
    let minD = Infinity;
    for (const p of path) {
       const dx = p.latitude - point.latitude;
       const dy = p.longitude - point.longitude;
       const d = dx*dx + dy*dy;
       if (d < minD) minD = d;
    }
    return Math.sqrt(minD);
}

// Fonction OSRM globale
async function getRouteFromOSRM(start: any, end: any) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?geometries=geojson&overview=full`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates;
      return coords.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    }
  } catch (err) { }
  return [start, { latitude: (start.latitude + end.latitude) / 2, longitude: start.longitude }, end];
}

async function getDetourRouteFromOSRM(start: any, detour: any, end: any) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${detour.longitude},${detour.latitude};${end.longitude},${end.latitude}?geometries=geojson&overview=full`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates;
      return coords.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
    }
  } catch (err) { }
  return [start, detour, end];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [likedDishes, setLikedDishes] = useState<string[]>([]);
  const [followedRestaurants, setFollowedRestaurants] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [simulatedDeliveries, setSimulatedDeliveries] = useState<SimulatedDelivery[]>([]);
  const knownOrderIds = useRef<Set<number>>(new Set());

  // Charger le panier depuis le stockage local au démarrage
  useEffect(() => {
    AsyncStorage.getItem('eeuez_cart').then(str => {
      if (str) setCart(JSON.parse(str));
    }).catch(e => console.log(e));
  }, []);

  // Sauvegarder le panier à chaque modification
  useEffect(() => {
    AsyncStorage.setItem('eeuez_cart', JSON.stringify(cart)).catch(e => console.log(e));
  }, [cart]);

  // GLOBAL SIMULATION ENGINE
  useEffect(() => {
    let clientPos = { latitude: 3.848, longitude: 11.502 }; // Default Yaoundé
    let locationFetched = false;
    
    // 1. Polling for new orders
    const fetchOrders = async () => {
      if (!locationFetched) {
        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            let loc = await Location.getCurrentPositionAsync({});
            clientPos = loc.coords;
          }
        } catch(e) {}
        locationFetched = true;
      }
      try {
        const hist: any = await commandeService.getHistorique();
        const activeList = hist.filter((c: any) => c.statut !== 'livree' && c.statut !== 'annulee');
        
        // Remove ended orders
        const activeIds = new Set(activeList.map((o: any) => o.id));
        setSimulatedDeliveries(prev => prev.filter(d => activeIds.has(d.id)));
        
        for (const order of activeList) {
          if (!knownOrderIds.current.has(order.id)) {
             knownOrderIds.current.add(order.id);
             try {
               const detail: any = await commandeService.getDetail(order.id);
               let rPos = { latitude: 3.85, longitude: 11.51 };
               if (detail.restaurant_details && detail.restaurant_details.latitude) {
                 rPos = {
                   latitude: parseFloat(detail.restaurant_details.latitude),
                   longitude: parseFloat(detail.restaurant_details.longitude)
                 };
               }
               
               let step = 0;
               if (order.statut === 'acceptee') step = 1;
               else if (order.statut === 'en_preparation') step = 2;
               else if (order.statut === 'prete') step = 3;
               else if (order.statut === 'en_livraison') step = 4;
               
               const path = await getRouteFromOSRM(rPos, clientPos);
                 setSimulatedDeliveries(prev => {
                 if (prev.find(d => d.id === order.id)) return prev;
                 return [...prev, { 
                   id: order.id, routePath: path, displayRoute: path, currentIndex: 0, 
                   detoursDone: 0, isRecalculating: false, detourMarker: null,
                   clientPos, rPos, currentStep: step
                 }];
               });
             } catch(e) {}
          }
        }
      } catch(e) {}
    };

    fetchOrders();
    const pollTimer = setInterval(fetchOrders, 3000);

    // 2. Animation & Detour Loop
    const animTimer = setInterval(() => {
      setSimulatedDeliveries(prev => {
        const next = [...prev];
        let changed = false;

        for (let i = 0; i < next.length; i++) {
          const d = next[i];
          
          if (d.currentStep >= 4 && d.routePath.length > 0 && !d.isRecalculating) {
            if (d.currentIndex < d.routePath.length - 1) {
               const nextIndex = d.currentIndex + 1;
               
               // DETOUR LOGIC (3 detours)
               // On divise la route restante estimée (ou totale) pour placer les détours
               // Si on veut 3 détours, on le fait à 1/4, 2/4, 3/4 du trajet
               const fraction = d.routePath.length / 4;
                const expectedDetours = Math.floor(nextIndex / fraction);
               
                // 1) TRIGGER DETOUR: Modifies the driver's secret routePath but DOES NOT touch displayRoute
                if (expectedDetours > d.detoursDone && d.detoursDone < 3 && nextIndex > 2) {
                   const futureIndex = Math.min(nextIndex + 3, d.routePath.length - 1);
                   const futurePos = d.routePath[futureIndex];
                   
                   const latOffset = d.detoursDone % 2 === 0 ? 0.003 : -0.003;
                   const lonOffset = d.detoursDone === 1 ? 0.003 : -0.003;
                   const detourPos = { latitude: futurePos.latitude + latOffset, longitude: futurePos.longitude + lonOffset };
                   
                   next[i] = { ...d, detoursDone: d.detoursDone + 1, detourMarker: detourPos, currentIndex: nextIndex };
                   changed = true;
                   
                   getDetourRouteFromOSRM(futurePos, detourPos, d.clientPos).then(newPath => {
                      setSimulatedDeliveries(current => {
                         return current.map(cd => {
                            if (cd.id === d.id) {
                               return { ...cd, routePath: [...cd.routePath.slice(0, futureIndex), ...newPath] };
                            }
                            return cd;
                         });
                      });
                   }).catch(()=>{});
                } else {
                   next[i] = { ...d, currentIndex: nextIndex };
                   changed = true;
                }
                
                // 2) GPS RECALCULATION: Triggered naturally if driver is far from the displayRoute
                const currentPos = next[i].routePath[next[i].currentIndex];
                const activeDisplay = next[i].displayRoute || next[i].routePath;
                const distanceToGPS = getDistanceToPath(currentPos, activeDisplay.slice(next[i].currentIndex));
                
                if (distanceToGPS > 0.0005 && !next[i].isRecalculating) {
                   next[i].isRecalculating = true;
                   changed = true;
                   
                   getRouteFromOSRM(currentPos, next[i].clientPos).then(newPath => {
                      setSimulatedDeliveries(curr => curr.map(cd => {
                         if (cd.id === d.id) {
                            return { ...cd, displayRoute: newPath, isRecalculating: false };
                         }
                         return cd;
                      }));
                   }).catch(()=>{});
                }
             } else {
               // Arrivé !
               if (d.currentStep !== 5) {
                  next[i] = { ...d, currentStep: 5 };
                  commandeService.updateStatus(d.id, 'livree').catch(e=>{});
                  changed = true;
               }
            }
          }
        }
        return changed ? next : prev;
      });
    }, 200); // vitesse de la moto (accélérée)

    // 3. Status progression simulation (simuler la cuisine)
    const statusTimer = setInterval(() => {
       setSimulatedDeliveries(prev => {
          const next = [...prev];
          let changed = false;
          for (let i = 0; i < next.length; i++) {
             if (next[i].currentStep < 4) {
                const ns = next[i].currentStep + 1;
                next[i] = { ...next[i], currentStep: ns };
                changed = true;
                const statuts = ['en_attente', 'acceptee', 'en_preparation', 'prete', 'en_livraison'];
                if (ns <= 4) {
                   commandeService.updateStatus(next[i].id, statuts[ns]).catch(e => {});
                }
             }
          }
          return changed ? next : prev;
       });
    }, 1000); // Avance d'une étape toutes les 1 seconde (accéléré)

    return () => {
       clearInterval(pollTimer);
       clearInterval(animTimer);
       clearInterval(statusTimer);
    };
  }, []);

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantite: i.quantite + item.quantite } : i);
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const clearCart = () => setCart([]);

  const toggleLikeDish = (id: string) => {
    setLikedDishes(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleFollowRestaurant = (id: string) => {
    setFollowedRestaurants(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const addNotification = (notif: any) => {
    setNotifications(prev => [notif, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  const markNotificationsAsRead = () => {
    setUnreadCount(0);
  };

  const addPastOrder = (order: Order) => {
    setPastOrders(prev => [order, ...prev]);
  };

  return (
    <AppContext.Provider value={{
      cart, addToCart, removeFromCart, clearCart,
      activeOrder, setActiveOrder,
      pastOrders, addPastOrder,
      likedDishes, toggleLikeDish,
      followedRestaurants, toggleFollowRestaurant,
      notifications, unreadCount, addNotification, markNotificationsAsRead,
      simulatedDeliveries
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
