import { createContext } from 'react';

export const ProductsContext = createContext();

const PRODUCTS = [
  {
    id: 1,
    name: 'Lemon Cherry Gelato',
    subtitle: 'Premium Flower',
    type: 'Flower',
    strength: 'THC 24.7%',
    unit: '3.5g',
    price: 45,
    effects: ['Relaxed', 'Happy'],
  },
  {
    id: 2,
    name: 'Pulse Watermelon Ice',
    subtitle: 'Nicotine Disposable',
    type: 'Disposable',
    strength: '5% (50mg)',
    unit: '1 ct',
    price: 18,
    effects: [],
  },
  {
    id: 3,
    name: 'Camino Sleep Gummies',
    subtitle: 'Cannabis Edibles',
    type: 'Edibles',
    strength: 'THC 10mg',
    unit: '20 ct',
    price: 28,
    effects: ['Sleepy'],
  },
];

export function ProductsProvider({ children }) {
  const getProduct = (id) => PRODUCTS.find(p => p.id === id);
  const getAllProducts = () => PRODUCTS;
  const searchProducts = (query) => PRODUCTS.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <ProductsContext.Provider value={{ getProduct, getAllProducts, searchProducts }}>
      {children}
    </ProductsContext.Provider>
  );
}
