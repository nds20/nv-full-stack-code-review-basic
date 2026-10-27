# Smoke Shop — Static Mirror

A complete, self-contained static version of the Smoke Shop, built with
plain HTML, CSS, and JavaScript. It mirrors the React app in
`smokeshopfrontend/` page for page, for hosts that serve static files
directly with no build step.

## Deploy

Point your static host at this `static/` folder. That is all — there is
no build step, no bundler, and no server-side code. Every link, image,
stylesheet, and script inside the folder is referenced with a relative
path, so the site also works from a subpath or straight off disk.

## Page inventory

| Static page | Mirrors (React) |
| --- | --- |
| `index.html` | Landing/home, with the age-gate as an entry overlay (shown until a ZIP is verified) |
| `age-gate.html` | `AgeGate` — Verify Your Age & Location |
| `login.html` | `LoginPage` |
| `products.html` | `ProductsPage` — search, category filter, price range, sort, grid/list |
| `product-muha-runtz-2g.html` | `ProductDetailPage` — Muha Meds Runtz 2G |
| `product-muha-galactic-diesel-2g.html` | `ProductDetailPage` — Muha Meds Galactic Diesel 2G |
| `product-pack-man-2g-combo.html` | `ProductDetailPage` — Pack Man 2G Combo |
| `product-raz-nicotine-vape.html` | `ProductDetailPage` — Raz Nicotine Vape |
| `product-rehab-cherry-candy-gelato.html` | `ProductDetailPage` — Rehab Cherry Candy Gelato |
| `cart.html` | `CartPage` |
| `checkout.html` | `CheckoutPage` |
| `order-confirmation.html` | `OrderConfirmationPage` |

Shared assets: `css/styles.css`, `js/products.js` (the product data),
`js/main.js` (cart + age-gate behavior), and `images/products/` (the five
real product photos, copied from `smokeshopfrontend/public/images/products/`
so this folder is fully self-contained).

## How it behaves

- The cart lives in `localStorage` and works across all pages, with the
  same 10.2% tax rate and 1–10 quantity limits as the React app.
- Login and checkout are front-end demos, just like the React app: no real
  accounts, payments, or orders are processed, and nothing leaves the
  browser.

## Pricing honesty

Prices appear only where they have actually been confirmed — Muha Meds
Runtz 2G ($17.49) and Rehab Cherry Candy Gelato ($30). Muha Meds Galactic
Diesel 2G, Pack Man 2G Combo, and the Raz Nicotine Vape are listed as
**Price TBD**: they are never given an estimated price, are excluded from
every subtotal/tax/total, and checkout stays unavailable while one is in
the cart. THC potency is likewise shown as "THC TBD", matching the React
app. When a price gets confirmed, update it in `js/products.js`, the
product's detail page, and `index.html` (and in the React app's
`useProducts.js` to keep the two in sync).
