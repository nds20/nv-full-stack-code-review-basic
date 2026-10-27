import { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import AgeGate from './components/AgeGate';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import ProductsPage from './components/ProductsPage';
import ProductDetailPage from './components/ProductDetailPage';
import CartPage from './components/CartPage';
import CheckoutPage from './components/CheckoutPage';
import OrderConfirmationPage from './components/OrderConfirmationPage';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import { isAdminLoggedIn } from './services/adminApi';
import { submitOrder, queuePendingOrder } from './services/ordersApi';

export default function App() {
  const [currentPage, setCurrentPage] = useState('agegate');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [orderTotal, setOrderTotal] = useState(null);

  // The store admin lives at #/admin so it can be bookmarked without
  // changing the shopper flow.
  useEffect(() => {
    if (window.location.hash.startsWith('#/admin')) {
      setCurrentPage(isAdminLoggedIn() ? 'admin' : 'admin-login');
    }
  }, []);

  const goAdmin = () => {
    window.location.hash = '#/admin';
    setCurrentPage(isAdminLoggedIn() ? 'admin' : 'admin-login');
  };

  const exitAdmin = () => {
    window.location.hash = '';
    setCurrentPage('products');
  };

  const handleAgeVerify = (zip) => {
    console.log('Age verified with ZIP:', zip);
    setCurrentPage('products');
  };

  const handleLogin = (creds) => {
    // Never log credentials — just note that a sign-in happened.
    console.log('User logged in:', creds && creds.identifier);
    setCurrentPage('products');
  };

  const handleSignUp = () => {
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
    // Send the order to the API so it lands in the admin's order inbox.
    // If the API is unreachable (e.g. the static Cloudflare demo has no
    // server behind it) or rejects it, the order is kept in a local
    // pending list instead and checkout completes exactly as before —
    // the customer always gets their confirmation.
    let placedId = 'ORD-' + Date.now();
    let total = order && order.totals ? order.totals.total : null;
    try {
      const saved = await submitOrder(order);
      if (saved && saved.id != null) placedId = 'ORD-' + saved.id;
      if (saved && typeof saved.total === 'number') total = saved.total;
    } catch (err) {
      queuePendingOrder(order);
    }
    setOrderId(placedId);
    setOrderTotal(total);
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
            onCreateAccount={() => setCurrentPage('signup')}
            onBack={() => setCurrentPage('agegate')}
          />
        )}
        {currentPage === 'signup' && (
          <SignupPage
            onSignUp={handleSignUp}
            onLogIn={() => setCurrentPage('login')}
            onBack={() => setCurrentPage('agegate')}
          />
        )}
        {currentPage === 'products' && (
          <ProductsPage
            onProductSelect={handleProductSelect}
            onBack={() => setCurrentPage('agegate')}
            cartCount={0}
            onCart={() => setCurrentPage('cart')}
            onAdmin={goAdmin}
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
            total={orderTotal != null ? orderTotal : 150.00}
          />
        )}
        {currentPage === 'admin-login' && (
          <AdminLogin
            onSuccess={() => setCurrentPage('admin')}
            onBack={exitAdmin}
          />
        )}
        {currentPage === 'admin' && (
          <AdminDashboard
            onExit={exitAdmin}
            onUnauthorized={() => setCurrentPage('admin-login')}
          />
        )}
      </CartProvider>
    </AuthProvider>
  );
}
