import { useMemo, useState } from 'react';
import { useCart } from '../hooks/useCart';

function Icon({ name, size = 20 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (name) {
    case 'check': return <svg {...p}><path d="m5 12 4 4 10-10" /></svg>;
    case 'trash': return <svg {...p}><path d="M3 6h18M8 6v12M16 6v12M5 6l1 14h12l1-14" /></svg>;
    case 'gift': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M12 3v6" /></svg>;
    default: return null;
  }
}

const money = (n) => `$${n.toFixed(2)}`;

export default function CartPage({
  onCheckout = () => console.log('checkout'),
  onContinueShopping = () => console.log('continue'),
  onBack = () => console.log('back'),
}) {
  const { items, removeFromCart, updateQty, applyPromo, calculateTotals, promo } = useCart();
  const [giftMessage, setGiftMessage] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');

  const totals = useMemo(() => calculateTotals(), [calculateTotals]);

  const handleApplyPromo = () => {
    if (promoCode.toUpperCase() === 'SAVE10') {
      applyPromo('SAVE10', { percentOff: 10 });
      setPromoError('');
    } else if (promoCode.toUpperCase() === 'SAVE5') {
      applyPromo('SAVE5', { amountOff: 5 });
      setPromoError('');
    } else {
      setPromoError('Invalid promo code');
    }
  };

  return (
    <div className="cp-page">
      <style>{css}</style>
      <header className="cp-header">
        <div className="cp-shell cp-header-in">
          <button className="cp-back" onClick={onBack}>Back</button>
          <h1 className="cp-title">Shopping Cart</h1>
          <div style={{ width: 100 }}></div>
        </div>
      </header>
      <main className="cp-shell">
        {items.length === 0 ? (
          <div className="cp-empty">
            <p>Your cart is empty</p>
            <button className="cp-continue-btn" onClick={onContinueShopping}>Continue Shopping</button>
          </div>
        ) : (
          <div className="cp-layout">
            <section className="cp-items">
              <h2>Order Items ({items.length})</h2>
              <div className="cp-item-list">
                {items.map((item) => (
                  <div key={item.id} className="cp-item">
                    <div className="cp-item-image" style={{ background: item.tile[0] }}></div>
                    <div className="cp-item-info">
                      <h3>{item.name}</h3>
                      <p className="cp-item-sub">{item.subtitle}</p>
                      <p className="cp-item-strength">{item.strength} • {item.unit}</p>
                    </div>
                    <div className="cp-item-qty">
                      <button onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                    </div>
                    <div className="cp-item-price">{money(item.price * item.qty)}</div>
                    <button className="cp-remove" onClick={() => removeFromCart(item.id)} aria-label="Remove">
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <section className="cp-gift">
                <label htmlFor="cp-gift-msg">
                  <Icon name="gift" size={18} /> Add a Gift Message
                </label>
                <textarea id="cp-gift-msg" className="cp-textarea" placeholder="Enter your message here..." value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} maxLength={200} />
                <p className="cp-char-count">{giftMessage.length}/200</p>
              </section>
            </section>
            <aside className="cp-summary">
              <h2>Order Summary</h2>
              <section className="cp-promo">
                <input type="text" placeholder="Promo code" value={promoCode} onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }} />
                <button onClick={handleApplyPromo}>Apply</button>
                {promoError && <p className="cp-error">{promoError}</p>}
                {promo && <p className="cp-success">✓ {promo.code} applied</p>}
              </section>
              <dl className="cp-totals">
                <div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
                {totals.discount > 0 && <div className="cp-discount"><dt>Discount</dt><dd>−{money(totals.discount)}</dd></div>}
                <div><dt>Taxes</dt><dd>{money(totals.taxes)}</dd></div>
                <div className="cp-total"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
              </dl>
              <button className="cp-checkout-btn" onClick={onCheckout}>Proceed to Checkout</button>
              <div className="cp-trust">
                <div className="cp-trust-item"><span>🔒</span><div><b>Secure Checkout</b><small>Your data is protected</small></div></div>
                <div className="cp-trust-item"><span>🌿</span><div><b>Quality Guaranteed</b><small>Tested. Trusted. Transparent.</small></div></div>
                <div className="cp-trust-item"><span>🚚</span><div><b>Discreet Delivery</b><small>Fast and discreet shipping</small></div></div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

const css = `
.cp-page { background: #fafafa; color: #1a1d1b; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100vh; }
.cp-header { background: #fff; border-bottom: 1px solid #e8e8e6; padding: 14px 0; position: sticky; top: 0; z-index: 10; }
.cp-shell { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
.cp-header-in { display: flex; align-items: center; justify-content: space-between; }
.cp-back { background: none; border: none; color: #2d6a3e; cursor: pointer; font-size: 1.1rem; font-weight: 600; }
.cp-title { flex: 1; margin: 0 20px; font-size: 1.5rem; }
.cp-empty { display: grid; place-items: center; min-height: 400px; text-align: center; }
.cp-empty p { margin: 0 0 20px; font-size: 1.2rem; color: #666b67; }
.cp-continue-btn { padding: 12px 28px; background: #2d6a3e; color: #fff; border: none; border-radius: 6px; font: inherit; font-size: 1rem; cursor: pointer; }
.cp-layout { display: grid; grid-template-columns: 1fr 340px; gap: 30px; margin: 30px 0; }
.cp-items h2 { margin: 0 0 20px; font-size: 1.3rem; }
.cp-item-list { display: flex; flex-direction: column; gap: 16px; }
.cp-item { display: grid; grid-template-columns: 80px 1fr 100px 100px 40px; gap: 16px; align-items: center; padding: 16px; background: #fff; border: 1px solid #e8e8e6; border-radius: 8px; }
.cp-item-image { width: 80px; height: 80px; border-radius: 6px; }
.cp-item-info h3 { margin: 0 0 4px; font-size: 1rem; }
.cp-item-sub { margin: 0 0 4px; font-size: 0.9rem; color: #666b67; }
.cp-item-strength { margin: 0; font-size: 0.85rem; color: #2d6a3e; }
.cp-item-qty { display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid #d8d8d6; border-radius: 4px; height: 32px; }
.cp-item-qty button { background: none; border: none; cursor: pointer; width: 24px; display: grid; place-items: center; }
.cp-item-qty span { width: 20px; text-align: center; font-size: 0.9rem; }
.cp-item-price { font-weight: 600; text-align: right; }
.cp-remove { background: none; border: none; cursor: pointer; color: #999; padding: 4px; }
.cp-remove:hover { color: #d9534f; }
.cp-gift { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e8e8e6; }
.cp-gift label { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-weight: 600; cursor: pointer; }
.cp-textarea { width: 100%; padding: 10px; border: 1px solid #d8d8d6; border-radius: 4px; resize: vertical; min-height: 80px; font: inherit; }
.cp-char-count { margin: 4px 0 0; font-size: 0.8rem; color: #999; }
.cp-summary { display: flex; flex-direction: column; }
.cp-summary h2 { margin: 0 0 20px; font-size: 1.2rem; }
.cp-promo { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.cp-promo input { padding: 10px; border: 1px solid #d8d8d6; border-radius: 4px; font: inherit; }
.cp-promo button { padding: 10px; background: #2d6a3e; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
.cp-error { margin: 0; font-size: 0.85rem; color: #d9534f; }
.cp-success { margin: 0; font-size: 0.85rem; color: #2d6a3e; }
.cp-totals { margin: 20px 0; padding: 20px 0; border-top: 1px solid #d8d8d6; border-bottom: 1px solid #d8d8d6; }
.cp-totals > div { display: flex; justify-content: space-between; padding: 8px 0; }
.cp-totals dd { margin: 0; }
.cp-discount dt, .cp-discount dd { color: #2d6a3e; }
.cp-total { padding-top: 10px; border-top: 1px solid #d8d8d6; font-weight: 600; font-size: 1.15rem; }
.cp-checkout-btn { width: 100%; height: 50px; background: #2d6a3e; color: #fff; border: none; border-radius: 6px; font: inherit; font-size: 1.05rem; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
.cp-checkout-btn:hover { background: #22532f; }
.cp-trust { display: flex; flex-direction: column; gap: 12px; }
.cp-trust-item { display: flex; gap: 10px; padding: 10px; background: #f1f3ef; border-radius: 6px; }
.cp-trust-item > span { font-size: 1.2rem; }
.cp-trust-item div { display: flex; flex-direction: column; }
.cp-trust-item b { font-size: 0.9rem; }
.cp-trust-item small { font-size: 0.75rem; color: #666b67; }
@media (max-width: 768px) { .cp-layout { grid-template-columns: 1fr; } .cp-item { grid-template-columns: 60px 1fr 30px; gap: 10px; } .cp-item-qty, .cp-item-price { display: none; } }
`;
