# Smoke Shop Server — product API + admin backend

A small Node/Express service that lives **inside `smokeshopfrontend/`**, next
to the React app it feeds. It replaces the hardcoded product list with a real
backend store and a login-gated admin area for managing the catalog, and it
receives the shop's orders so the admin page can alert on new ones.

## Why this exists (and why Node, here)

The repo's other backend (`SmokeShopAppApi/`) is still the default ASP.NET
Core template (WeatherForecast) — it has no product model, database, or auth
to build on. The React app, on the other hand, already anticipated this API:
`src/hooks/useProducts.js` had a `TODO: Call backend API` pointing at
`/api/products`. So the least invasive coherent step is a small Node service
in the frontend's own folder, speaking exactly that contract.

## Two runtimes, one API contract

This Node server is one of **two implementations of the same API**:

- **Node (this folder)** — for local development and any host that runs
  Node. Data lives in JSON files under `data/`; uploaded photos are
  files in `../public/images/products/`.
- **Cloudflare Pages Functions** (`../functions/`, setup guide in
  [`../cloudflare/README.md`](../cloudflare/README.md)) — the port that
  runs on Cloudflare Pages, where this shop is deployed. Same endpoints,
  same validation, same auth precedence and setup semantics; data lives
  in a **D1** database and uploaded photos in an **R2** bucket.

The React frontend talks to relative `/api/*` URLs and does not know or
care which runtime answers. If you change a rule in one implementation,
change it in the other. One intentional difference: stored-account
password hashes use scrypt here and PBKDF2 in the Workers runtime
(scrypt is unavailable there), so accounts created against one runtime
must be re-created — or env credentials used — on the other.

## Run it

```bash
# from smokeshopfrontend/
npm run install:server        # installs this server's dependencies
cp server/.env.example server/.env   # then edit the admin credentials!
npm run start:server          # API on http://localhost:4000
```

Then run the shop as usual (`npm start`) — the CRA dev server proxies
`/api` to this service (see `"proxy"` in `../package.json`). Or build the
frontend (`npm run build`) and let this server serve everything — API,
product photos, and the built storefront — from one port.

## Configure

All configuration is via environment variables (see `.env.example`).
**No real credentials are hardcoded anywhere** (the built-in demo login
below is a labeled fallback, not a credential).

| Variable                   | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `PORT`                     | Port to listen on (default `4000`)                             |
| `SMOKESHOP_ADMIN_USER`     | Admin username (optional sign-in method — see below).          |
| `SMOKESHOP_ADMIN_PASSWORD` | Admin password (optional sign-in method — see below).          |
| `SMOKESHOP_ADMIN_SECRET`   | Recommended. Signs admin session tokens (HMAC-SHA256, 8h TTL). |

## Admin sign-in: env vars, setup account, or demo login

There are three ways to sign in to the admin area, checked in this order:

1. **Environment variables** — if `SMOKESHOP_ADMIN_USER` /
   `SMOKESHOP_ADMIN_PASSWORD` are set and match, you're in.
2. **A stored account** — created once via the setup flow below; the
   password is kept server-side as a scrypt hash (`crypto.scrypt`, random
   per-account salt) in `data/admin-accounts.json`. Never plaintext.
3. **The demo login** — **DEMO ONLY**: username `admin`, password
   `admin123`. It is accepted *only while neither of the above exists*, so
   the admin area can be tried immediately on a fresh checkout. The server
   logs a loud startup warning while it is active, and it **stops working
   the moment a real account is created or env credentials are set**. Do
   not rely on it for anything real.

### First-run setup (creating the first admin account)

Open the admin login screen (`/#/admin`). If no stored account exists yet,
it offers **"Create admin account"**: pick a username and a password of at
least 8 characters and you are signed in with a real account (which also
switches the demo login off). The backing endpoints are
`GET /api/admin/setup-status` and `POST /api/admin/setup`; setup only ever
creates the **first** account — once one exists, `POST /api/admin/setup`
responds `409`.

## Data

- The catalog lives in `data/products.json` (git-ignored runtime file).
- On first run it is seeded from `data/products.seed.json` — the exact five
  products that used to be hardcoded in the React app.
- Admin changes (create / edit / delete) are written through to that file,
  so they survive restarts.
- Orders live in `data/orders.json` and admin accounts in
  `data/admin-accounts.json` (both git-ignored runtime files, same
  write-through pattern).
- Data honesty: **price and THC stay `null` ("TBD") unless the admin enters
  real values.** The API rejects negative prices and THC outside 0–100.

## API

| Method   | Route                        | Auth  | Notes                                                 |
| -------- | ---------------------------- | ----- | ----------------------------------------------------- |
| `GET`    | `/api/health`                | —     | Liveness check                                        |
| `GET`    | `/api/products`              | —     | Full catalog                                          |
| `GET`    | `/api/products/:id`          | —     | One product                                           |
| `POST`   | `/api/orders`                | —     | Place an order (validated, totals recomputed)         |
| `POST`   | `/api/admin/login`           | —     | `{ username, password }` → `{ token, expiresAt, authSource }` |
| `GET`    | `/api/admin/setup-status`    | —     | `{ setupRequired, envConfigured, dummyActive }`       |
| `POST`   | `/api/admin/setup`           | —     | Create the FIRST admin account (409 after that)       |
| `POST`   | `/api/products`              | Admin | JSON, or multipart with a `photo` file                |
| `PUT`    | `/api/products/:id`          | Admin | JSON, or multipart with a `photo` file                |
| `DELETE` | `/api/products/:id`          | Admin | Removes the product from the catalog                  |
| `GET`    | `/api/admin/orders`          | Admin | `{ orders, newCount }`, newest first                  |
| `GET`    | `/api/admin/orders/:id`      | Admin | One order                                             |
| `PATCH`  | `/api/admin/orders/:id/seen` | Admin | Acknowledge an order (`new` → `seen`)                 |

## Orders and admin alerts

- The storefront checkout posts each placed order to `POST /api/orders`.
  The server validates it against the catalog, **recomputes subtotal, tax
  (10.2%), and total itself**, and stores it with status `new`. The shop's
  Price-TBD rule is enforced here as well: an order containing a product
  whose price is `null` is rejected with `400`.
- Only the delivery details the checkout form collects are stored, plus —
  for card payments — the card's **last four digits only**. Full card
  numbers, expiry, and CVV are never stored or logged.
- Order lifecycle: `new` → `seen` (via the "Mark seen" button, which calls
  `PATCH /api/admin/orders/:id/seen`). Acknowledging is idempotent and
  stamps `seenAt`.
- **Alerts are in-admin**: the dashboard has an **Orders** tab listing
  orders newest-first, and a badge on that tab shows how many orders are
  still `new`. While the dashboard is open it polls the orders endpoint
  every 15 seconds, so new orders appear (and bump the badge) without a
  refresh. Optionally, the Orders tab can enable **browser notifications**
  (Notification API, permission-based) so a genuinely new order pops up
  while the admin page is open; the initial backlog never triggers popups.
- If the API is unreachable at checkout time (e.g. the static Cloudflare
  demo), checkout completes exactly as before and the order is kept in a
  local pending list (`localStorage`) instead of being sent — customers
  are never blocked by a missing server. The `static/` mirror's checkout
  remains local-only by design.
- **Not included:** email/SMS/push alerts to a phone. Those need an
  external provider (and credentials) and are deliberately out of scope;
  alerts here mean the admin page itself.

## Photos

Uploaded photos are stored in `../public/images/products/` and served from
`/images/products/<file>` — the same place and URL scheme as the existing
product photos, so nothing about how the storefront displays images changes.
Photos are **not** deleted when a product is deleted or its photo is
replaced (a file may be referenced elsewhere); remove unwanted files from
that folder manually.

## The admin UI

Open the shop and click the ⚙️ button in the products header, or go
directly to `/#/admin`. Sign in (see "Admin sign-in" above) to add, edit,
and delete products — including photo upload — and to watch incoming
orders in the **Orders** tab, with no code changes. New products appear in
the listing and detail pages automatically because the storefront now
reads the catalog from this API.

> Hosting note: a purely static deploy has no server behind it, so the
> shop there keeps using the catalog snapshot bundled in `useProducts.js`
> as a fallback. To make the admin live, either run this server anywhere
> Node runs (a laptop, a VPS, a container) and point the frontend's
> `/api` at it via the dev proxy or by serving the build from this
> server — or use the Cloudflare port in `../functions/` (see
> [`../cloudflare/README.md`](../cloudflare/README.md)), which is how the
> API runs on the live Cloudflare Pages deployment.
