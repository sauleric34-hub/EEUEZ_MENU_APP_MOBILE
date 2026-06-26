import React, { createContext, useContext, ReactNode } from 'react';
import { useAppContext } from './AppContext';

type CartContextType = {
  items: any[];
  addItem: (item: any) => void;
  removeItem: (id: string) => void;
  increaseQty: (id: string) => void;
  decreaseQty: (id: string) => void;
  total: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { cart, addToCart, removeFromCart } = useAppContext();

  const items = cart;
  
  const addItem = (item: any) => addToCart(item);
  
  const removeItem = (id: string) => removeFromCart(id);
  
  const increaseQty = (id: string) => {
    const item = cart.find((i: any) => i.id === id);
    if (item) {
        addToCart({ ...item, quantite: 1 });
    }
  };
  
  const decreaseQty = (id: string) => {
    // This requires a custom implementation in AppContext to truly work as decrement.
    // For now, it's just a placeholder mapping to AppContext.
    console.warn("decreaseQty needs full support in AppContext");
  };

  const total = cart.reduce((sum: number, item: any) => sum + (item.prix * item.quantite), 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, increaseQty, decreaseQty, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
