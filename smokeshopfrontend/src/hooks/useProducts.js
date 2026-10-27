import { useState, useEffect } from 'react';

const SAMPLE_PRODUCTS = [
  { id: 1, name: 'Muha Meds Runtz 2G', subtitle: 'THC Vape Disposable · Candy-Sweet Fruity Runtz', category: 'vapes', type: 'Hybrid', thc: null, strength: 'THC TBD', price: 17.49, unit: '2g', effects: ['Relaxed', 'Happy'], tile: ['#ff8c1a', '#f5b921'], image: '/images/products/muha-runtz-2g.svg' },
  { id: 2, name: 'Muha Meds Galactic Diesel 2G', subtitle: 'THC Vape Disposable · Pungent Earthy Diesel · Postless Ceramic, Rechargeable, LED Display', category: 'vapes', type: 'Hybrid', thc: null, strength: 'THC TBD', price: null, unit: '2g', effects: ['Heavy', 'Hazy'], tile: ['#a855f7', '#7c3aed'], image: '/images/products/muha-galactic-diesel-2g.svg' },
  { id: 3, name: 'Pack Man 2G Combo', subtitle: 'THC Vape Dual-Chamber Disposable · Watermelon Frost + Fruit Loops · LED Screen, USB-C, Draw-Activated', category: 'vapes', type: 'Indica/Hybrid', thc: null, strength: 'THC TBD', price: null, unit: '2g', effects: [], tile: ['#14532d', '#052e16'], image: '/images/products/packman-2g-combo.svg' },
  { id: 4, name: 'Raz Nicotine Vape', subtitle: 'Nicotine Vape · Baby Blue', category: 'nic-vapes', type: 'Nicotine', thc: null, strength: '12W', price: null, unit: '1ct', effects: [], tile: ['#7dd3fc', '#38bdf8'], image: '/images/products/raz-nicotine-vape.svg' },
];

export const useProducts = () => {
  const [products, setProducts] = useState(SAMPLE_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      // TODO: Call backend API
      // const response = await fetch('/api/products');
      // if (!response.ok) throw new Error('Failed to fetch products');
      // const data = await response.json();
      // setProducts(data);
      setProducts(SAMPLE_PRODUCTS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getProduct = (id) => products.find((p) => p.id === Number(id));

  return { products, loading, error, fetchProducts, getProduct };
};
