import { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import AgeGate from './components/AgeGate';
import LoginPage from './components/LoginPage';
import ProductsPage from './components/ProductsPage';
import ProductDetailPage from './components/ProductDetailPage';
import CartPage from './components/CartPage';
import CheckoutPage from './components/CheckoutPage';
import OrderConfirmationPage from './components/OrderConfirmationPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('agegate');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [orderId, setOrderId] = useState(null);

  const handleAgeVerify = (zip) => {
    console.log('Age verified with ZIP:', zip);
    setCurrentPage('products');
  };

  const handleLogin = (creds) => {
    console.log('User logged in:', creds);
    setCurrentPage('products');
  };

  const handleProductSelect = (id) => {
    setSelectedProductId(id);
    setCurrentPage('product-detail');
  };

  const handleCheckout = () => {
    setCurrentPage('checkout');
  };

  const handlePlaceOrder = async (order) => {
    console.log('Order placed:', order);
    setOrderId('ORD-' + Date.now());
    setCurrentPage('order-confirmation');
  };

  return (
    <AuthProvider>
      <CartProvider>
        {currentPage === 'agegate' && (
          <AgeGate
            onVerify={handleAgeVerify}
            onLogIn={() => setCurrentPage('login')}
          />
        )}
        {currentPage === 'login' && (
          <LoginPage
            onLogIn={handleLogin}
            onCreateAccount={() => setCurrentPage('agegate')}
            onBack={() => setCurrentPage('agegate')}
          />
        )}
        {currentPage === 'products' && (
          <ProductsPage
            onProductSelect={handleProductSelect}
            onBack={() => setCurrentPage('agegate')}
            cartCount={0}
            onCart={() => setCurrentPage('cart')}
          />
        )}
        {currentPage === 'product-detail' && selectedProductId && (
          <ProductDetailPage
            productId={selectedProductId}
            onBack={() => setCurrentPage('products')}
            cartCount={0}
            onCart={() => setCurrentPage('cart')}
          />
        )}
        {currentPage === 'cart' && (
          <CartPage
            onCheckout={handleCheckout}
            onContinueShopping={() => setCurrentPage('products')}
            onBack={() => setCurrentPage('products')}
          />
        )}
        {currentPage === 'checkout' && (
          <CheckoutPage
            onPlaceOrder={handlePlaceOrder}
            onBackToCart={() => setCurrentPage('cart')}
          />
        )}
        {currentPage === 'order-confirmation' && (
          <OrderConfirmationPage
            orderId={orderId}
            onContinueShopping={() => setCurrentPage('products')}
            total={150.00}
          />
        )}
      </CartProvider>
    </AuthProvider>
  );
}
