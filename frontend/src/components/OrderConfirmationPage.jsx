export default function OrderConfirmationPage({ orderId = '12345', onContinueShopping = () => console.log('continue'), total = 120.50 }) {
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
.oc-message { margin: 20px 0; color: #666b67; line-height: 1.6; }
.oc-btn { padding: 14px 40px; background: #2d6a3e; color: #fff; border: none; border-radius: 6px; font: inherit; font-size: 1.05rem; font-weight: 600; cursor: pointer; margin-top: 20px; }
.oc-btn:hover { background: #22532f; }
`;
