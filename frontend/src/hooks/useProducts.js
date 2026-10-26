import { useState, useEffect } from 'react';

const SAMPLE_PRODUCTS = [
  { id: 1, name: 'Gelato 41', subtitle: 'Premium Flower', category: 'flower', type: 'Indica', thc: 24.5, strength: 'THC 24.5%', price: 45, unit: '3.5g', effects: ['Relaxed', 'Happy'], tile: ['#d23ad0', '#8a2ccf'] },
  { id: 2, name: 'Lemon Haze', subtitle: 'THC Vape', category: 'vapes', type: 'Sativa', thc: 87, strength: 'THC 87%', price: 35, unit: '1g', effects: ['Energized', 'Focused'], tile: ['#ffc51f', '#ff9d0a'] },
  { id: 3, name: 'Watermelon Zkittlez', subtitle: 'THC Gummies', category: 'gummies', type: 'Hybrid', thc: 500, strength: '500mg', price: 30, unit: '20ct', effects: ['Happy', 'Relaxed'], tile: ['#ff5a82', '#d61f4d'] },
  { id: 4, name: 'ZYN Cool Mint', subtitle: 'Nicotine Pouches', category: 'pouches', type: 'Nicotine', thc: null, strength: '6mg', price: 6, unit: '15ct', effects: [], tile: ['#2b8cff', '#1557d6'] },
  { id: 5, name: 'Lost Mary', subtitle: 'Nicotine Vape', category: 'nic-vapes', type: 'Nicotine', thc: null, strength: '50mg', price: 14, unit: '1ct', effects: [], tile: ['#19c2d6', '#1b6fe0'] },
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
