import { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

export default function App() {
  const [currentPage, setCurrentPage] = useState('agegate');

  return (
    <AuthProvider>
      <CartProvider>
        <div style={{ minHeight: '100vh', fontFamily: 'system-ui' }}>
          {currentPage === 'agegate' && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <h1>Smoke Shop</h1>
              <p>Age verification required</p>
              <button onClick={() => setCurrentPage('products')} style={{ padding: '10px 20px', fontSize: '16px' }}>Enter</button>
            </div>
          )}
          {currentPage === 'products' && (
            <div style={{ padding: '40px' }}>
              <h1>Products</h1>
              <button onClick={() => setCurrentPage('cart')}>Go to Cart</button>
            </div>
          )}
          {currentPage === 'cart' && (
            <div style={{ padding: '40px' }}>
              <h1>Shopping Cart</h1>
              <button onClick={() => setCurrentPage('checkout')}>Checkout</button>
            </div>
          )}
          {currentPage === 'checkout' && (
            <div style={{ padding: '40px' }}>
              <h1>Checkout</h1>
              <button onClick={() => setCurrentPage('confirmation')}>Place Order</button>
            </div>
          )}
          {currentPage === 'confirmation' && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <h1>✓ Order Confirmed!</h1>
              <p>Thank you for your order</p>
            </div>
          )}
        </div>
      </CartProvider>
    </AuthProvider>
  );
}