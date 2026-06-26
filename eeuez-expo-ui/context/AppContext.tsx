import React, { createContext, useContext, useState, ReactNode } from 'react';

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

type AppContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  
  activeOrders: Order[];
  addActiveOrder: (order: Order) => void;
  removeActiveOrder: (id: string) => void;
  
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
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [likedDishes, setLikedDishes] = useState<string[]>([]);
  const [followedRestaurants, setFollowedRestaurants] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addActiveOrder = (order: Order) => setActiveOrders(prev => [...prev, order]);
  const removeActiveOrder = (id: string) => setActiveOrders(prev => prev.filter(o => o.id !== id));

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
      activeOrders, addActiveOrder, removeActiveOrder,
      pastOrders, addPastOrder,
      likedDishes, toggleLikeDish,
      followedRestaurants, toggleFollowRestaurant,
      notifications, unreadCount, addNotification, markNotificationsAsRead
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
