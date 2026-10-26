import { createContext, useState } from 'react';

export const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [promo, setPromo] = useState(null);

  const addToCart = (product, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { ...product, qty }];
    });
  };

  const removeFromCart = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) removeFromCart(id);
    else setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  };

  const applyPromo = (code, discount) => {
    setPromo({ code, ...discount });
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    let discount = 0;
    if (promo?.percentOff) discount = subtotal * (promo.percentOff / 100);
    if (promo?.amountOff) discount = promo.amountOff;
    const taxes = (subtotal - discount) * 0.102;
    return { subtotal, discount, taxes, total: subtotal - discount + taxes };
  };

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQty, applyPromo, calculateTotals, promo }}>
      {children}
    </CartContext.Provider>
  );
}
