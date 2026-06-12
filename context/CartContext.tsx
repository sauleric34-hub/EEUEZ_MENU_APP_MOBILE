import React, { createContext, useContext, useState } from 'react';

export interface CartItem {
    id: string;
    nom: string;
    prix: number;
    qty: number;
    image: string;
}

interface CartContextType {
    items: CartItem[];
    addItem: (item: any) => void;
    removeItem: (id: string) => void;
    increaseQty: (id: string) => void;
    decreaseQty: (id: string) => void;
    clearCart: () => void;
    total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([
        { id: '1', nom: 'Pain au poulet pané AQ', prix: 4500, qty: 1, image: 'https://images.unsplash.com/photo-1509722747041-619f3883a627?auto=format&fit=crop&w=200&q=80' },
        { id: '2', nom: 'Noodle crevettes et épices', prix: 5200, qty: 2, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80' },
    ]);

    const addItem = (item: any) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { ...item, qty: 1 }];
        });
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const increaseQty = (id: string) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i));
    };

    const decreaseQty = (id: string) => {
        setItems(prev => prev.map(i => {
            if (i.id === id) {
                const newQty = i.qty - 1;
                return newQty > 0 ? { ...i, qty: newQty } : i;
            }
            return i;
        }));
    };

    const clearCart = () => setItems([]);

    const total = items.reduce((acc, item) => acc + item.prix * item.qty, 0);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, increaseQty, decreaseQty, clearCart, total }}>
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
