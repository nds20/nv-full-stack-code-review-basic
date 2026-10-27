import { useEffect, useRef, useState } from 'react';
import { fetchOrderStatus } from '../services/ordersApi';

const PAYMENT_LABELS = {
  paid: { text: 'Paid ✓', className: 'oc-status oc-status--paid' },
  pending: { text: 'Payment pending…', className: 'oc-status' },
  unpaid: { text: 'Unpaid', className: 'oc-status' },
  payment_failed: { text: 'Payment failed', className: 'oc-status oc-status--failed' },
};

/**
 * Confirmation for a placed order. When the order lives on the server
 * (orderAccessToken present — issued by POST /api/orders), this also
 * polls the order-status endpoint so a customer returning from Stripe's
 * hosted checkout sees the payment state settle from "pending" to
 * "paid" once the webhook lands. Locally queued orders (static demo, no
 * API) render exactly as before, with no payment row.
 */
export default function OrderConfirmationPage({
  orderId = '12345',
  orderAccessToken = null,
  onContinueShopping = () => console.log('continue'),
  total = 120.50,
}) {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const attempts = useRef(0);

  useEffect(() => {
    const numericId = Number(String(orderId).replace(/^ORD-/, ''));
    if (!orderAccessToken || !Number.isFinite(numericId)) return undefined;
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      try {
        const data = await fetchOrderStatus(numericId, orderAccessToken);
        if (cancelled) return;
        if (data && data.paymentStatus) setPaymentStatus(data.paymentStatus);
        attempts.current += 1;
        // Stop once the payment resolves, or after ~30s of trying.
        const settled = data && (data.paymentStatus === 'paid' || data.paymentStatus === 'payment_failed');
        if (!settled && attempts.current < 10) {
          timer = setTimeout(poll, 3000);
        }
      } catch {
        if (!cancelled && attempts.current < 10) {
          attempts.current += 1;
          timer = setTimeout(poll, 3000);
        }
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, orderAccessToken]);

  const payment = paymentStatus ? PAYMENT_LABELS[paymentStatus] : null;

  return (
    <div className="oc-page">
      <style>{css}</style>
      <div className="oc-card">
        <div className="oc-icon">✓</div>
        <h1 className="oc-title">Order Confirmed!</h1>
        <p className="oc-subtitle">Thank you for your order.</p>
        <div className="oc-details">
          <div><strong>Order #:</strong> {orderId}</div>
          <div><strong>Total:</strong> ${total.toFixed(2)}</div>
          <div><strong>Status:</strong> <span className="oc-status">Processing</span></div>
          {orderAccessToken && (
            <div>
              <strong>Payment:</strong>{' '}
              {payment ? (
                <span className={payment.className}>{payment.text}</span>
              ) : (
                <span className="oc-status">Checking…</span>
              )}
            </div>
          )}
        </div>
        <p className="oc-message">You will receive an email confirmation shortly with tracking information.</p>
        <button className="oc-btn" onClick={onContinueShopping}>Continue Shopping</button>
      </div>
    </div>
  );
}

const css = `
.oc-page { min-height: 100vh; display: grid; place-items: center; background: #fafafa; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.oc-card { max-width: 500px; width: 100%; background: #fff; border-radius: 12px; padding: 60px 40px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.oc-icon { font-size: 80px; color: #2d6a3e; margin-bottom: 20px; }
.oc-title { margin: 0 0 10px; font-size: 2rem; color: #1a1d1b; }
.oc-subtitle { margin: 0 0 30px; font-size: 1.1rem; color: #666b67; }
.oc-details { margin: 30px 0; padding: 20px; background: #f1f3ef; border-radius: 8px; text-align: left; }
.oc-details div { margin: 10px 0; font-size: 1rem; }
.oc-status { color: #2d6a3e; font-weight: 600; }
.oc-status--paid { color: #2d6a3e; }
.oc-status--failed { color: #b3261e; }
.oc-message { margin: 20px 0; color: #666b67; line-height: 1.6; }
.oc-btn { padding: 14px 40px; background: #2d6a3e; color: #fff; border: none; border-radius: 6px; font: inherit; font-size: 1.05rem; font-weight: 600; cursor: pointer; margin-top: 20px; }
.oc-btn:hover { background: #22532f; }
`;
