import React, { createContext, useState, useCallback, useEffect } from 'react';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [promo, setPromo] = useState(null);
  const [taxRate, setTaxRate] = useState(0.102);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addToCart = useCallback((product, qty = 1) => {
    setItems((prevItems) => {
      const existing = prevItems.find((i) => i.id === product.id);
      if (existing) {
        return prevItems.map((i) =>
          i.id === product.id ? { ...i, qty: Math.min(10, i.qty + qty) } : i
        );
      }
      return [...prevItems, { ...product, qty }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setItems((prevItems) => prevItems.filter((i) => i.id !== productId));
  }, []);

  const updateQty = useCallback((productId, qty) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((i) =>
        i.id === productId ? { ...i, qty: Math.min(10, Math.max(1, qty)) } : i
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
    setPromo(null);
  }, []);

  const applyPromo = useCallback((code, discount) => {
    setPromo({ code, ...discount });
  }, []);

  const calculateTotals = useCallback(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    let discount = 0;
    if (promo?.percentOff) discount = subtotal * (promo.percentOff / 100);
    if (promo?.amountOff) discount = Math.min(subtotal, promo.amountOff);
    const taxes = (subtotal - discount) * taxRate;
    const total = subtotal - discount + taxes;
    return { subtotal, discount, taxes, total };
  }, [items, promo, taxRate]);

  const value = {
    items,
    promo,
    taxRate,
    addToCart,
    removeFromCart,
    updateQty,
    clearCart,
    applyPromo,
    calculateTotals,
    itemCount: items.reduce((sum, i) => sum + i.qty, 0),
    isEmpty: items.length === 0
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
