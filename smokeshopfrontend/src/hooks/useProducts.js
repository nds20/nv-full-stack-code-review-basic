import { useState, useEffect, useCallback } from 'react';

// The last-known-good catalog, kept in the bundle so the storefront always
// renders — including on the static deploy where no API server is running.
// When the product API (see ../server/) is reachable it replaces this list,
// and anything the admin adds there shows up here with no code changes.
const FALLBACK_PRODUCTS = [
  { id: 1, name: 'Muha Meds Runtz 2G', subtitle: 'THC Vape Disposable · Candy-Sweet Fruity Runtz', category: 'vapes', type: 'Hybrid', thc: null, strength: 'THC TBD', price: 17.49, unit: '2g', effects: ['Relaxed', 'Happy'], tile: ['#ff8c1a', '#f5b921'], image: '/images/products/muha-runtz-2g.svg' },
  { id: 2, name: 'Muha Meds Galactic Diesel 2G', subtitle: 'THC Vape Disposable · Pungent Earthy Diesel · Postless Ceramic, Rechargeable, LED Display', category: 'vapes', type: 'Hybrid', thc: null, strength: 'THC TBD', price: null, unit: '2g', effects: ['Heavy', 'Hazy'], tile: ['#a855f7', '#7c3aed'], image: '/images/products/muha-galactic-diesel-2g.svg' },
  { id: 3, name: 'Pack Man 2G Combo', subtitle: 'THC Vape Dual-Chamber Disposable · Watermelon Frost + Fruit Loops · LED Screen, USB-C, Draw-Activated', category: 'vapes', type: 'Indica/Hybrid', thc: null, strength: 'THC TBD', price: null, unit: '2g', effects: [], tile: ['#14532d', '#052e16'], image: '/images/products/packman-2g-combo.svg' },
  { id: 4, name: 'Raz Nicotine Vape', subtitle: 'Nicotine Vape · Baby Blue', category: 'nic-vapes', type: 'Nicotine', thc: null, strength: '12W', price: null, unit: '1ct', effects: [], tile: ['#7dd3fc', '#38bdf8'], image: '/images/products/raz-nicotine-vape.svg' },
  { id: 5, name: 'Rehab Cherry Candy Gelato', subtitle: 'Cannabis Flower · Cherry Candy Gelato', category: 'flower', type: 'Flower', thc: null, strength: 'THC TBD', price: 30, unit: null, effects: [], tile: ['#dc2626', '#171717'], image: '/images/products/rehab-cherry-candy-gelato.svg' },
];

export const useProducts = () => {
  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setProducts(data);
      }
    } catch (err) {
      // API unreachable (e.g. static hosting): keep showing the fallback
      // catalog instead of an empty shop.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const getProduct = (id) => products.find((p) => p.id === Number(id));

  return { products, loading, error, fetchProducts, getProduct };
};
