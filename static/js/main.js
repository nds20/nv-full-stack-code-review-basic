// Smoke Shop static mirror — shared behavior:
// cart (localStorage), cart badge, price formatting, age-gate overlay.
// Mirrors the React app's cart math: tax rate 10.2%, quantities 1–10.
// Items whose price is not confirmed (price === null, "Price TBD") are
// NEVER given a price or included in any subtotal/tax/total.

(function () {
  var CART_KEY = 'ss_cart_v1';
  var AGE_KEY = 'ss_age_verified';
  var TAX_RATE = 0.102;

  // Card/listing price label, mirroring the React app: "$17.49", "$30", or "Price TBD".
  window.priceLabel = function (p) {
    return p.price != null ? '$' + p.price : 'Price TBD';
  };
  // Money for summaries: always two decimals.
  window.money = function (n) {
    return '$' + n.toFixed(2);
  };
  window.TAX_RATE = TAX_RATE;

  /* ---------------- cart ---------------- */
  window.getCart = function () {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  };
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.updateCartBadges();
  }
  window.updateCartBadges = function () {
    var count = window.getCart().reduce(function (s, i) { return s + i.qty; }, 0);
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
  };
  window.addToCart = function (slug, qty) {
    qty = Math.max(1, Math.min(10, qty || 1));
    var cart = window.getCart();
    var line = cart.find(function (i) { return i.slug === slug; });
    if (line) line.qty = Math.min(10, line.qty + qty);
    else cart.push({ slug: slug, qty: qty });
    saveCart(cart);
  };
  window.setQty = function (slug, qty) {
    var cart = window.getCart();
    var line = cart.find(function (i) { return i.slug === slug; });
    if (line) line.qty = Math.max(1, Math.min(10, qty));
    saveCart(cart);
  };
  window.removeFromCart = function (slug) {
    saveCart(window.getCart().filter(function (i) { return i.slug !== slug; }));
  };
  window.clearCart = function () {
    saveCart([]);
  };
  // Totals are computed ONLY over items with a confirmed price.
  // Returns { subtotal, discount, taxes, total, hasTbd, pricedLines, tbdLines }
  window.cartTotals = function () {
    var subtotal = 0, hasTbd = false, pricedLines = 0, tbdLines = 0;
    window.getCart().forEach(function (i) {
      var p = window.getProduct(i.slug);
      if (!p) return;
      if (p.price == null) { hasTbd = true; tbdLines++; }
      else { subtotal += p.price * i.qty; pricedLines++; }
    });
    var taxes = subtotal * TAX_RATE;
    return {
      subtotal: subtotal, discount: 0, taxes: taxes, total: subtotal + taxes,
      hasTbd: hasTbd, pricedLines: pricedLines, tbdLines: tbdLines
    };
  };
  window.cartIsEmpty = function () {
    return window.getCart().length === 0;
  };

  // Add-to-cart buttons anywhere: <button data-add-to-cart="slug">
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add-to-cart]');
    if (!btn) return;
    window.addToCart(btn.getAttribute('data-add-to-cart'), 1);
    var orig = btn.textContent;
    btn.textContent = 'Added ✓';
    btn.classList.add('added');
    setTimeout(function () { btn.textContent = orig; btn.classList.remove('added'); }, 1200);
  });

  /* ---------------- age gate overlay ---------------- */
  function wireAgeForm(formId, inputId, errorId, onSuccess) {
    var form = document.getElementById(formId);
    if (!form) return;
    var input = document.getElementById(inputId);
    var error = document.getElementById(errorId);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var zip = (input.value || '').replace(/\D/g, '').slice(0, 5);
      input.value = zip;
      if (!/^\d{5}$/.test(zip)) {
        error.textContent = 'Enter a 5-digit ZIP code.';
        error.hidden = false;
        input.focus();
        return;
      }
      error.hidden = true;
      localStorage.setItem(AGE_KEY, '1');
      onSuccess();
    });
  }
  window.wireAgeForm = wireAgeForm;

  document.addEventListener('DOMContentLoaded', function () {
    window.updateCartBadges();
    var overlay = document.getElementById('ageOverlay');
    if (overlay && localStorage.getItem(AGE_KEY) !== '1') {
      overlay.hidden = false;
      wireAgeForm('ageForm', 'ageZip', 'ageError', function () {
        overlay.hidden = true;
      });
    }
  });
})();
