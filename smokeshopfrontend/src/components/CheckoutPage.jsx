import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";

const SAMPLE_ITEMS = [
  { id: 101, name: "Lemon Cherry Gelato", subtitle: "Premium Flower", strength: "THC 24.7%", unit: "3.5g", price: 45, qty: 1, icon: "leaf", tile: "#eef2e9" },
  { id: 102, name: "Pulse Watermelon Ice", subtitle: "Nicotine Disposable", strength: "5% (50mg)", unit: "1 ct", price: 18, qty: 1, icon: "pen", tile: "#fbe9ef" },
  { id: 103, name: "Camino Sleep Gummies", subtitle: "Cannabis Edibles", strength: "THC 10mg", unit: "20 ct", price: 28, qty: 1, icon: "gummy", tile: "#ece7f6" },
];

const SAMPLE_VERIFICATION = [
  { title: "Age Verified", icon: "badge", badge: "21+" },
  { title: "Identity Confirmed", icon: "id" },
  { title: "Town Compliance: Checked", icon: "bank" },
  { title: "Safety Check Passed", icon: "shield-check" },
  { title: "Purchase Limits", detail: "Within legal limits", icon: "scale" },
];

function Icon({ name, size = 20, stroke = 1.7 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  switch (name) {
    case "shield-check": return <svg {...p}><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>;
    case "lock": return <svg {...p}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case "back": return <svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
    default: return null;
  }
}

const money = (n) => `$${n.toFixed(2)}`;
const digits = (s) => s.replace(/\D/g, "");
const formatPhone = (v) => { const d = digits(v).slice(0, 10); if (d.length < 4) return d; if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`; return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; };
const formatCard = (v) => digits(v).slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
const formatExp = (v) => { const d = digits(v).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d; };
const luhn = (num) => { let sum = 0, dbl = false; for (let i = num.length - 1; i >= 0; i--) { let n = +num[i]; if (dbl) { n *= 2; if (n > 9) n -= 9; } sum += n; dbl = !dbl; } return sum % 10 === 0; };

const VALIDATORS = {
  fullName: (v) => (v.trim().split(/\s+/).length >= 2 ? "" : "Enter your first and last name."),
  phone: (v) => (digits(v).length === 10 ? "" : "Enter a 10-digit phone number."),
  address: (v) => (v.trim().length >= 5 ? "" : "Enter your street address."),
  city: (v) => (v.trim() ? "" : "Enter your city."),
  zip: (v) => (/^\d{5}$/.test(v) ? "" : "Enter a 5-digit ZIP code."),
  cardNumber: (v) => { const d = digits(v); return d.length >= 13 && luhn(d) ? "" : "Enter a valid card number."; },
  expiry: (v) => { const d = digits(v); if (d.length !== 4) return "Use MM / YY."; const m = +d.slice(0, 2), y = 2000 + +d.slice(2); if (m < 1 || m > 12) return "Month must be 01-12."; const now = new Date(); return y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth() + 1) ? "" : "This card has expired."; },
  cvv: (v) => (/^\d{3,4}$/.test(v) ? "" : "Enter the 3 or 4 digit code."),
};

function Field({ id, label, icon, required, error, textarea, trailing, className = "", ...input }) {
  const Tag = textarea ? "textarea" : "input";
  return (
    <div className={`co-field ${className}`}>
      <label htmlFor={id}>{label}{required && <span className="co-req" aria-hidden="true"> *</span>}</label>
      <div className={`co-input${error ? " co-input--err" : ""}${textarea ? " co-input--area" : ""}`}>
        <Tag id={id} name={id} required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...input} />
        {trailing}
      </div>
      {error && <p id={`${id}-err`} className="co-err">{error}</p>}
    </div>
  );
}

export default function CheckoutPage({
  items = SAMPLE_ITEMS,
  totals: totalsProp,
  taxRate = 0.102,
  verification = SAMPLE_VERIFICATION,
  onPlaceOrder = async (order) => console.log("place order", order),
  onBackToCart = () => console.log("back to cart"),
  renderPayment,
}) {
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", city: "", zip: "", notes: "", cardNumber: "", expiry: "", cvv: "" });
  const { user } = useAuth();

  // Signed-in customers get their name prefilled from their account
  // profile (the checkout form has no email field, so the profile's
  // name is the piece that applies). Only fills a still-empty field —
  // never overwrites something the shopper typed.
  useEffect(() => {
    if (user && user.name) {
      setForm((s) => (s.fullName ? s : { ...s, fullName: user.name }));
    }
  }, [user]);

  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const totals = useMemo(() => { if (totalsProp) return totalsProp; const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0); const taxes = subtotal * taxRate; return { subtotal, discount: 0, taxes, total: subtotal + taxes }; }, [items, totalsProp, taxRate]);

  const fields = renderPayment ? ["fullName", "phone", "address", "city", "zip"] : ["fullName", "phone", "address", "city", "zip", "cardNumber", "expiry", "cvv"];
  const errors = Object.fromEntries(fields.map((f) => [f, VALIDATORS[f](form[f])]));
  const showErr = (f) => (touched[f] ? errors[f] : "");
  const bind = (name, format) => ({ value: form[name], onChange: (e) => { setForm((s) => ({ ...s, [name]: format ? format(e.target.value) : e.target.value })); setSubmitError(""); }, onBlur: () => setTouched((t) => ({ ...t, [name]: true })), });

  const placeOrder = async (e) => {
    e?.preventDefault();
    setTouched(Object.fromEntries(fields.map((f) => [f, true])));
    const firstBad = fields.find((f) => errors[f]);
    if (firstBad) { document.getElementById(firstBad)?.focus(); return; }
    setSubmitting(true);
    try {
      await onPlaceOrder({
        delivery: { fullName: form.fullName.trim(), phone: digits(form.phone), address: form.address.trim(), city: form.city.trim(), zip: form.zip, notes: form.notes.trim() },
        payment: renderPayment ? null : { cardNumber: digits(form.cardNumber), expiry: digits(form.expiry), cvv: form.cvv },
        items, totals,
      });
    } catch (err) {
      setSubmitError(err?.message || "We couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="co-page">
      <style>{css}</style>
      <main className="co-shell">
        <h1 className="co-title">Checkout</h1>
        <form className="co-grid" onSubmit={placeOrder} noValidate>
          <div className="co-left">
            <section className="co-section" aria-labelledby="co-delivery">
              <h2 id="co-delivery" className="co-h2">Delivery Information</h2>
              <Field id="fullName" label="Full Name" required autoComplete="name" placeholder="Enter your full name" error={showErr("fullName")} {...bind("fullName")} />
              <Field id="phone" label="Phone Number" required type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(555) 123-4567" error={showErr("phone")} {...bind("phone", formatPhone)} />
              <Field id="address" label="Delivery Address" required autoComplete="street-address" placeholder="123 Main St, Apt 4B" error={showErr("address")} {...bind("address")} />
              <div className="co-row co-row--city">
                <Field id="city" label="City" required autoComplete="address-level2" placeholder="Enter your city" error={showErr("city")} {...bind("city")} />
                <Field id="zip" label="ZIP Code" required inputMode="numeric" autoComplete="postal-code" placeholder="12345" error={showErr("zip")} {...bind("zip", (v) => digits(v).slice(0, 5))} />
              </div>
              <Field id="notes" label="Delivery Instructions (Optional)" textarea rows={3} maxLength={300} placeholder="Add any delivery notes or instructions..." {...bind("notes")} />
            </section>
            <section className="co-section" aria-labelledby="co-payment">
              <h2 id="co-payment" className="co-h2">Payment Method</h2>
              <p className="co-secure-note">All transactions are secure and encrypted.</p>
              {renderPayment ? renderPayment() : (
                <div className="co-paybox">
                  <div className="co-paybox-head">
                    <label className="co-radio"><input type="radio" name="method" defaultChecked /><span aria-hidden="true" />Credit Card</label>
                    <span className="co-brands">Visa - Mastercard - Amex - Discover</span>
                  </div>
                  <div className="co-paybox-body">
                    <Field id="cardNumber" label="Card Number" required inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" error={showErr("cardNumber")} {...bind("cardNumber", formatCard)} />
                    <div className="co-row co-row--card">
                      <Field id="expiry" label="Expiration Date" required inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" error={showErr("expiry")} {...bind("expiry", formatExp)} />
                      <Field id="cvv" label="CVV" required inputMode="numeric" autoComplete="cc-csc" placeholder="123" error={showErr("cvv")} {...bind("cvv", (v) => digits(v).slice(0, 4))} />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
          <aside className="co-right">
            <section className="co-card" aria-labelledby="co-sum">
              <h2 id="co-sum" className="co-card-title">Order Summary</h2>
              <dl className="co-totals">
                <div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
                {totals.discount > 0 && <div className="co-discount"><dt>Discount</dt><dd>-{money(totals.discount)}</dd></div>}
                <div><dt>Taxes</dt><dd>{money(totals.taxes)}</dd></div>
                <div className="co-grand"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
              </dl>
            </section>
            {submitError && <p className="co-submit-err" role="alert">{submitError}</p>}
            <button type="submit" className="co-place" disabled={submitting}><Icon name="lock" size={24} stroke={2} /> {submitting ? "Placing Order..." : "Place Order"}</button>
            <button type="button" className="co-back" onClick={onBackToCart}><Icon name="back" size={18} /> Back to Cart</button>
          </aside>
        </form>
      </main>
    </div>
  );
}

const css = `.co-page { min-height: 100vh; background: #fff; color: #1a1d1b; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 16px; } .co-shell { max-width: 1120px; margin: 0 auto; padding: 0 24px; } .co-title { margin: 28px 0 24px; color: #1f5a32; font-size: 2rem; font-weight: 800; } .co-grid { display: grid; grid-template-columns: 1fr 400px; gap: 40px; margin: 30px 0; } .co-section { padding: 20px 0; border-bottom: 1px solid #e3e6e2; } .co-h2 { margin: 0 0 20px; color: #1f5a32; font-size: 1.4rem; font-weight: 700; } .co-field { margin-bottom: 18px; } .co-field label { display: block; margin-bottom: 8px; font-weight: 500; } .co-input { display: flex; height: 44px; padding: 0 12px; background: #fff; border: 1px solid #d9ddd8; border-radius: 6px; color: #646b65; } .co-input input, .co-input textarea { flex: 1; border: 0; outline: none; background: none; font: inherit; color: #1a1d1b; } .co-input textarea { resize: vertical; min-height: 80px; padding-top: 8px; } .co-input --err { border-color: #b3261e; } .co-err { margin: 4px 0 0; color: #b3261e; font-size: 0.85rem; } .co-row { display: grid; gap: 20px; grid-template-columns: 1fr 1fr; } .co-paybox { border: 1px solid #e3e6e2; border-radius: 8px; overflow: hidden; } .co-paybox-head { padding: 16px; background: #f7f8f6; border-bottom: 1px solid #e3e6e2; } .co-radio { display: flex; align-items: center; gap: 10px; font-weight: 600; cursor: pointer; } .co-radio input { width: 18px; height: 18px; cursor: pointer; } .co-brands { font-size: 0.8rem; color: #646b65; margin-left: 16px; } .co-paybox-body { padding: 16px; } .co-right { display: flex; flex-direction: column; gap: 20px; } .co-card { padding: 18px; border: 1px solid #e3e6e2; border-radius: 8px; background: #fafafa; } .co-card-title { margin: 0 0 16px; color: #1f5a32; font-size: 1.1rem; font-weight: 700; } .co-totals { margin: 0; padding: 0; border-top: 1px solid #d9ddd8; } .co-totals > div { display: flex; justify-content: space-between; padding: 10px 0; } .co-totals dt { } .co-totals dd { margin: 0; } .co-grand { border-top: 1px solid #d9ddd8; padding-top: 12px!important; font-weight: 700; font-size: 1.15rem; } .co-place { width: 100%; height: 50px; margin-top: 20px; background: #1f5a32; color: #fff; border: none; border-radius: 6px; font: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; } .co-place:hover:not(:disabled) { background: #173f26; } .co-place:disabled { opacity: 0.6; cursor: default; } .co-back { width: 100%; height: 44px; background: none; color: #1f5a32; border: 1px solid #1f5a32; border-radius: 6px; font: inherit; font-size: 0.95rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; } .co-back:hover { background: #f7f8f6; } .co-secure-note { font-size: 0.85rem; color: #646b65; margin-top: -12px; margin-bottom: 12px; } .co-submit-err { margin: 0 0 16px; padding: 12px; border-radius: 6px; background: #fdecea; color: #b3261e; font-size: 0.9rem; } @media (max-width: 768px) { .co-grid { grid-template-columns: 1fr; } .co-row { grid-template-columns: 1fr; } }`;
