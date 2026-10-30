import { useState, useEffect, useCallback } from 'react';

// The last-known-good catalog, kept in the bundle so the storefront always
// renders — including on the static deploy where no API server is running.
// When the product API (see ../server/) is reachable it replaces this list,
// and anything the admin adds there shows up here with no code changes.
const FALLBACK_PRODUCTS = [
  { id: 4, name: 'Raz Nicotine Vape', subtitle: 'Nicotine Vape · Blue Raz', category: 'nic-vapes', type: 'Nicotine', thc: null, strength: '12W', price: null, unit: '1ct', effects: [], tile: ['#7dd3fc', '#38bdf8'], image: '/images/products/raz-nicotine-vape.svg' },
  { id: 6, name: 'Raz Blueberry Yummy', subtitle: 'Nicotine Vape · Blueberry Yummy', category: 'nic-vapes', type: 'Nicotine', thc: null, strength: 'TBD', price: null, unit: '1ct', effects: [], tile: ['#2bff62', '#00c853'], image: '/images/products/raz-blueberry-yummy.svg' },
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
