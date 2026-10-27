# Smoke Shop API on Cloudflare — Pages Functions + D1 + R2

This folder is the **Cloudflare port** of the shop's API. The same API
contract as the Node/Express server in [`../server/`](../server/) is
implemented as [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
in [`../functions/`](../functions/), so on Cloudflare Pages the store,
the admin area, and order alerts all actually run — no separate server
to host.

|                | Local / anywhere Node runs       | Cloudflare Pages                          |
| -------------- | -------------------------------- | ----------------------------------------- |
| Code           | `../server/` (Express)           | `../functions/` (Pages Functions)         |
| Catalog/order/customer data | JSON files in `server/data/` | **D1** database (binding `DB`)            |
| Uploaded photos | `../public/images/products/`    | **R2** bucket (binding `PRODUCT_PHOTOS`)  |
| Password hashes | scrypt (Node crypto)            | PBKDF2-SHA256 (WebCrypto)                 |

The React frontend needs **no changes** between the two: it already calls
relative `/api/*` URLs. Everything below is one-time setup in the
Cloudflare dashboard.

> **Where `functions/` must live:** Pages only picks up a `functions/`
> folder at the Pages project's **root directory**. In this repo that is
> `smokeshopfrontend/` (the same folder this file's parent lives in) —
> check **Pages project → Settings → Build → Root directory** if your
> deployment behaves differently.

> **Is your project a Worker instead of a Pages project?** If the
> dashboard says *"Bindings cannot be added to a Worker that only has
> static assets"*, your deployment is a Worker with static assets:
> `functions/` never runs there and the steps below won't take effect.
> Use the Worker packaging instead — skip to
> [If your project is a Worker (not Pages)](#if-your-project-is-a-worker-not-pages).

## Step-by-step setup

### 1. Create the D1 database

1. In the Cloudflare dashboard go to **Storage & Databases → D1 SQL Database**.
2. Click **Create database**, name it e.g. `smokeshop-db`, and create it.

### 2. Create the tables (schema)

1. Open your new database and go to its **Console** tab.
2. Open [`schema.sql`](./schema.sql) from this folder, copy the whole
   file, paste it into the console, and click **Execute**.
3. You should see the five tables (`products`, `orders`,
   `admin_accounts`, `customers`, `app_settings`) created.

> **Already have a database from an earlier setup?** Don't re-run the
> whole schema — your database only needs the two newest tables. Paste
> [`migration-customers.sql`](./migration-customers.sql) into the same
> Console instead (it adds `customers` + `app_settings`, nothing else,
> and is safe to re-run). If the console reports a syntax error on the
> whole paste, run its two statements one at a time.

### 3. Load the catalog (seed)

1. Still in the D1 console, open [`seed.sql`](./seed.sql), copy the whole
   file, paste it in, and click **Execute**.
2. Verify: run `SELECT id, name, price FROM products;` — you should get
   the shop's 5 real products (two with prices, three still TBD, exactly
   as in the shop today).

### 4. (Optional) Create the R2 bucket for photo uploads

Only needed if you want photo uploads from the admin area to work on the
live site. Everything else — catalog, orders, admin login — works
without it.

1. Go to **R2 Object Storage** and click **Create bucket**, name it e.g.
   `smokeshop-product-photos`, and create it.
2. Note: R2 may first ask you to **activate R2 on your account** — that's
   a one-time account step (the free tier includes 10 GB of storage; no
   per-request charges apply to this setup as documented by Cloudflare).
3. Without the bucket, creating/editing a product *without* a photo
   still works; attaching a photo returns a clear error message saying
   the upload binding is missing.

### 5. Bind the storage to the Pages project

Bindings are how the Functions reach D1/R2 — the names must match
exactly, the code looks for `DB` and `PRODUCT_PHOTOS`.

1. Go to **Workers & Pages → your shop's Pages project → Settings → Bindings**
   (older dashboards: **Settings → Functions → D1 database bindings /
   R2 bucket bindings**).
2. **Add → D1 database**: variable name `DB`, select `smokeshop-db`.
3. If you made the bucket: **Add → R2 bucket**: variable name
   `PRODUCT_PHOTOS`, select `smokeshop-product-photos`.
4. Add the bindings for **Production** (and **Preview** too if you use
   preview deployments).

### 6. (Optional) Set admin environment variables

Under **Settings → Environment variables** (Production), you can set the
same variables the Node server uses:

| Variable                   | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `SMOKESHOP_ADMIN_USER`     | Admin username (env sign-in method).                           |
| `SMOKESHOP_ADMIN_PASSWORD` | Admin password (env sign-in method).                           |
| `SMOKESHOP_ADMIN_SECRET`   | Recommended: a long random string that signs admin tokens.     |

All three are optional: with none set, the built-in **demo login**
(`admin` / `admin123`) is active until you create a real admin account
from the admin login screen — identical behaviour to the local server,
including the demo warning banner. Creating an account (or setting env
credentials) switches the demo login off.

### 7. Redeploy

Bindings and env vars only take effect on a **new deployment**: go to
**Deployments → ⋯ on the latest deployment → Retry deployment**, or just
push any commit.

### 8. Verify

1. Open `https://<your-domain>/api/health` → `{"ok":true}`.
2. Open `https://<your-domain>/api/products` → the 5 products as JSON.
3. Open the shop, go to the admin area (`/#/admin`), and sign in with the
   demo login or create your admin account via **Create admin account**.
4. Place a test order through checkout, then check the admin **Orders**
   tab — the order should appear with the `new` badge; **Mark seen**
   clears it.
5. (If R2 is bound) add a product with a photo in the admin; its image
   URL will be `/api/photos/products/<id>-<name>.<ext>` and should load.
6. Create a customer account from the shop's **Create Account** form —
   the first one registered is **customer #1** — then log out and log
   back in with it. (Customer accounts are real: passwords are stored as
   PBKDF2 hashes in the `customers` table, and nothing is seeded.)

## If your project is a Worker (not Pages)

Cloudflare has two ways to host a site from a Git repo, and they are
not interchangeable:

- A **Pages project** runs the `functions/` folder — that's the setup
  above.
- A **Worker with static assets** serves files only. Until it has a
  script, there is nothing to attach bindings to — the dashboard says
  *"Bindings cannot be added to a Worker that only has static assets"* —
  and the `functions/` folder is ignored entirely.

If your shop is the Worker kind, this repo ships a Worker packaging of
the same API: [`../worker/index.js`](../worker/index.js) dispatches
`/api/*` requests to the same handler code the Pages routes use, and
[`../wrangler.toml`](../wrangler.toml) declares the script, the static
assets, and both storage bindings — so on this path there is **no
manual binding step in the dashboard**. The `functions/` folder and
the Node server stay in the repo untouched (the Functions remain ready
if the project ever moves to Pages).

### Worker setup

1. **Create the D1 database and load it** — exactly steps 1–3 above:
   create `smokeshop-db`, then run `schema.sql` and `seed.sql` in its
   console.
2. **(Optional) Create the R2 bucket** — step 4 above. Name it
   `smokeshop-product-photos` (the name already written in
   `wrangler.toml`), or edit `bucket_name` in `wrangler.toml` to match
   a bucket you created under a different name.
3. **Open `wrangler.toml` and set your two values:**
   - `name` — wrangler.toml's name must exactly match the project name shown in Workers & Pages — if yours differs, edit that one line before deploying.
   - `database_id` — open your D1 database's page in the dashboard,
     copy the **Database ID** shown there, and replace
     `REPLACE_WITH_YOUR_D1_DATABASE_ID` with it.
   Those are the only edits: the bindings (`DB`, `PRODUCT_PHOTOS`) are
   declared in `wrangler.toml`, so the deploy creates them — do **not**
   try to add them under Settings → Bindings first; that dashboard
   message is what this packaging replaces.
4. **Check the Workers Builds settings** (Workers & Pages → your
   project → **Settings → Build**): root directory `smokeshopfrontend`,
   build command `npm run build`, deploy command
   `npx wrangler deploy`. A fresh Workers Git setup normally has these
   values already; the deploy command is the one that matters, because
   it is what reads `wrangler.toml`.
5. **(Optional) Admin secrets** — your Worker → **Settings → Variables
   and Secrets**: add `SMOKESHOP_ADMIN_USER`,
   `SMOKESHOP_ADMIN_PASSWORD` and `SMOKESHOP_ADMIN_SECRET` as secrets,
   or skip them and use the demo login / first-run account setup,
   exactly as described in step 6 above.
6. **Redeploy** — push a commit, or use Deployments → Retry. The new
   deployment carries the script and the bindings from `wrangler.toml`.
7. **Verify** — the same checks as step 8 above: `/api/health` returns
   `{"ok":true}`, `/api/products` lists the 5 products, the admin
   sign-in works (demo login or Create admin account), a test order
   appears in the admin **Orders** tab, and — if R2 is bound — a photo
   upload from the admin loads at its `/api/photos/...` URL.

A local dry run is possible before deploying: from `smokeshopfrontend/`,
`npx wrangler dev` serves the Worker, the static build, and emulated
local D1/R2 together (apply the schema to the local database first with
`npx wrangler d1 execute DB --local --file=cloudflare/schema.sql` and
the same for `seed.sql`).

## How storage maps to the API

- **`products`** — one row per product. `effects` and `tile` are TEXT
  columns holding JSON arrays; the API parses them back, so responses
  are identical to the Node server. `price`/`thc` are `NULL` when TBD.
- **`orders`** — one row per order. `items`, `customer`, `payment` are
  TEXT columns holding JSON. `payment` only ever contains the card's
  last 4 digits. Totals are recomputed by the API (10.2% tax), never
  trusted from the client, and orders containing a TBD-priced product
  are rejected — the same rules as the Node server.
- **`admin_accounts`** — one row per setup-created admin, username +
  PBKDF2 salt/hash. Note the hashes differ from the Node server's scrypt
  format: an account created locally does **not** transfer — create the
  account again here (or use env credentials on both).
- **`customers`** — one row per registered shopper: incrementing id,
  name, unique case-insensitive email, PBKDF2 salt/hash. Never seeded —
  the first registration is customer 1. Backs
  `POST /api/customers/register`, `POST /api/customers/login` and
  `GET /api/customers/me`. (Same cross-runtime note: scrypt on Node,
  PBKDF2 here — customer accounts don't transfer between runtimes
  either.)
- **`app_settings`** — key/value rows. Currently one generated row,
  `customer_token_secret`: the random secret that signs customer
  session tokens (created automatically on first register/login).
  Customer tokens are a separate audience from admin tokens — different
  signing key plus a `kind: 'customer'` claim — so the two never work
  on each other's endpoints.
- **R2 bucket** — uploaded photos under keys `products/<id>-<slug>.<ext>`,
  served by the Function at `/api/photos/...`. Seeded products keep
  their static `/images/products/...` image paths from the site build.
  Photos are not deleted when a product is deleted (same policy as the
  Node server); remove unwanted objects from the bucket manually.

## Stripe payments (optional)

Real card payments via **Stripe Checkout** (Stripe-hosted — card data
never touches this code), implementing the identical contract as the
Node server. Off until configured; while off, `/api/payments/config`
reports `stripeEnabled: false`, the checkout-session endpoint answers
`503`, and the shop runs exactly as it does today.

1. **Database step (once):** in the D1 console for your existing
   database, run `migration-stripe.sql` from this folder — it adds the
   `payment_status`, `stripe_session_id`, `stripe_payment_intent_id` and
   `access_token` columns to `orders`. (Fresh databases get them from
   `schema.sql` directly.) Run the statements one at a time if the
   console balks at the whole file; a "duplicate column name" error on a
   re-run just means it already landed.
2. **Secrets:** your Worker → **Settings → Variables and Secrets** → add
   `STRIPE_SECRET_KEY` as a **secret**, using a **test-mode** key
   (`sk_test_...`) first. (On a Pages project: Settings → Environment
   variables, Production.) Never commit keys to the repo.
3. **Webhook:** in the Stripe Dashboard (test mode) → **Developers →
   Webhooks → Add endpoint**:
   - URL: `https://www.beastmode82420.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.expired`,
     `checkout.session.async_payment_failed`
   - After creating it, reveal its **Signing secret** (`whsec_...`) and
     add it in the Worker settings as `STRIPE_WEBHOOK_SECRET` (secret).
4. **Redeploy** so the new secrets take effect, then verify:
   - `/api/payments/config` → `{"stripeEnabled":true}`
   - Place a test order and pay with Stripe's test card
     `4242 4242 4242 4242` (any future expiry, any CVC). You should land
     back on the confirmation page, watch **Payment** settle to **Paid**,
     and see the order badged **Paid** in the admin Orders tab.
   - Only switch to a live (`sk_live_...`) key — and create the matching
     live-mode webhook — once test mode works end to end.

How it fits together: placing an order stores it `paymentStatus:
'unpaid'` and returns a per-order `accessToken` to the buyer;
`POST /api/orders/:id/checkout` (token required) creates the Checkout
Session from the **stored** items/totals and marks it `pending`; the
signature-verified webhook marks it `paid` / back to `unpaid` /
`payment_failed`. The buyer-facing status probe is
`GET /api/orders/:id/status?token=...`.

## Troubleshooting

- **`/api/*` returns 500** — the `DB` binding is missing or the schema
  wasn't run. Check step 5 (variable name must be exactly `DB`) and
  step 2, then redeploy.
- **Photo upload says the binding is missing** — bind the R2 bucket as
  `PRODUCT_PHOTOS` (step 5) and redeploy; everything else still works.
- **Admin login rejects everything** — check `GET /api/admin/setup-status`:
  it reports whether env credentials are configured and whether the demo
  login is active. Remember the demo login turns off once an account
  exists or env credentials are set.
