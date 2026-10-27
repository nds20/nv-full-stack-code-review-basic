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
import {
  submitOrder,
  queuePendingOrder,
  fetchPaymentsConfig,
  createCheckoutSession,
} from './services/ordersApi';

const LAST_ORDER_KEY = 'smokeshop_last_order';

export default function App() {
  const [currentPage, setCurrentPage] = useState('agegate');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [orderTotal, setOrderTotal] = useState(null);
  const [orderAccessToken, setOrderAccessToken] = useState(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);

  // The store admin lives at #/admin so it can be bookmarked without
  // changing the shopper flow.
  useEffect(() => {
    if (window.location.hash.startsWith('#/admin')) {
      setCurrentPage(isAdminLoggedIn() ? 'admin' : 'admin-login');
    }
  }, []);

  // Does this deployment take real card payments? Asked once; when the
  // API is unreachable or Stripe is not configured the answer is simply
  // "no" and checkout runs in its original demo mode.
  useEffect(() => {
    let cancelled = false;
    fetchPaymentsConfig()
      .then((cfg) => {
        if (!cancelled && cfg && cfg.stripeEnabled) setStripeEnabled(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Returning from Stripe's hosted checkout: the success URL carries
  // ?payment=return&order=<id>&token=<accessToken>. Land back on the
  // confirmation view for that order (it polls the payment status), then
  // strip the query string so the token doesn't linger in the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'return') return;
    const id = params.get('order');
    const token = params.get('token');
    if (!id || !token) return;
    let total = null;
    try {
      const raw = sessionStorage.getItem(LAST_ORDER_KEY);
      const last = raw ? JSON.parse(raw) : null;
      if (last && String(last.id) === String(id)) total = last.total;
    } catch {
      // No backup — the confirmation still shows the order + status.
    }
    setOrderId('ORD-' + id);
    setOrderAccessToken(token);
    setOrderTotal(total);
    setCurrentPage('order-confirmation');
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
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
    let saved = null;
    try {
      saved = await submitOrder(order);
      if (saved && saved.id != null) placedId = 'ORD-' + saved.id;
      if (saved && typeof saved.total === 'number') total = saved.total;
    } catch (err) {
      queuePendingOrder(order);
    }
    setOrderId(placedId);
    setOrderTotal(total);
    setOrderAccessToken(saved && saved.accessToken ? saved.accessToken : null);

    // Stripe: when the server has payments enabled, the just-placed
    // order is paid on Stripe's hosted page instead of ending at the
    // demo confirmation. The order id + access token ride along in the
    // success URL so the return trip lands on the confirmation page
    // showing the payment state. If starting the session fails for any
    // reason, fall through to the normal confirmation — the order is
    // already saved either way.
    if (saved && saved.id != null && saved.accessToken && stripeEnabled) {
      try {
        sessionStorage.setItem(
          LAST_ORDER_KEY,
          JSON.stringify({ id: saved.id, accessToken: saved.accessToken, total })
        );
        const session = await createCheckoutSession(saved.id, saved.accessToken);
        if (session && session.url) {
          window.location.assign(session.url);
          return;
        }
      } catch (err) {
        // Fall through to the confirmation page.
      }
    }
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
            renderPayment={
              stripeEnabled
                ? () => (
                    <div
                      style={{
                        border: '1px solid #e3e6e2',
                        borderRadius: 8,
                        padding: 16,
                        background: '#f7f8f6',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Pay with card via Stripe</strong>
                      <p style={{ margin: '6px 0 0', color: '#646b65', fontSize: '0.92rem' }}>
                        No card details are entered on this page. When you place the
                        order you'll be redirected to Stripe's secure checkout to pay,
                        then brought back here for confirmation.
                      </p>
                    </div>
                  )
                : undefined
            }
          />
        )}
        {currentPage === 'order-confirmation' && (
          <OrderConfirmationPage
            orderId={orderId}
            orderAccessToken={orderAccessToken}
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
