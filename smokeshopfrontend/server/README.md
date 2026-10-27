# Smoke Shop Server — product API + admin backend

A small Node/Express service that lives **inside `smokeshopfrontend/`**, next
to the React app it feeds. It replaces the hardcoded product list with a real
backend store and a login-gated admin area for managing the catalog.

## Why this exists (and why Node, here)

The repo's other backend (`SmokeShopAppApi/`) is still the default ASP.NET
Core template (WeatherForecast) — it has no product model, database, or auth
to build on. The React app, on the other hand, already anticipated this API:
`src/hooks/useProducts.js` had a `TODO: Call backend API` pointing at
`/api/products`. So the least invasive coherent step is a small Node service
in the frontend's own folder, speaking exactly that contract.

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
**No credentials are hardcoded anywhere.**

| Variable                   | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `PORT`                     | Port to listen on (default `4000`)                             |
| `SMOKESHOP_ADMIN_USER`     | Admin username. Required for admin login.                      |
| `SMOKESHOP_ADMIN_PASSWORD` | Admin password. Required for admin login.                      |
| `SMOKESHOP_ADMIN_SECRET`   | Recommended. Signs admin session tokens (HMAC-SHA256, 8h TTL). |

If the admin credentials are not set, the catalog still works but admin
login responds `503` with an explanation instead of guessing a password.

## Data

- The catalog lives in `data/products.json` (git-ignored runtime file).
- On first run it is seeded from `data/products.seed.json` — the exact five
  products that used to be hardcoded in the React app.
- Admin changes (create / edit / delete) are written through to that file,
  so they survive restarts.
- Data honesty: **price and THC stay `null` ("TBD") unless the admin enters
  real values.** The API rejects negative prices and THC outside 0–100.

## API

| Method   | Route               | Auth  | Notes                                             |
| -------- | ------------------- | ----- | ------------------------------------------------- |
| `GET`    | `/api/health`       | —     | Liveness check                                    |
| `GET`    | `/api/products`     | —     | Full catalog                                      |
| `GET`    | `/api/products/:id` | —     | One product                                       |
| `POST`   | `/api/admin/login`  | —     | `{ username, password }` → `{ token, expiresAt }` |
| `POST`   | `/api/products`     | Admin | JSON, or multipart with a `photo` file            |
| `PUT`    | `/api/products/:id` | Admin | JSON, or multipart with a `photo` file            |
| `DELETE` | `/api/products/:id` | Admin | Removes the product from the catalog              |

## Photos

Uploaded photos are stored in `../public/images/products/` and served from
`/images/products/<file>` — the same place and URL scheme as the existing
product photos, so nothing about how the storefront displays images changes.
Photos are **not** deleted when a product is deleted or its photo is
replaced (a file may be referenced elsewhere); remove unwanted files from
that folder manually.

## The admin UI

Open the shop and click the ⚙️ button in the products header, or go
directly to `/#/admin`. Sign in with the env-configured credentials to add,
edit, and delete products — including photo upload — with no code changes.
New products appear in the listing and detail pages automatically because
the storefront now reads the catalog from this API.

> Static-hosting note: the Cloudflare static deploy has no server behind
> it, so the shop there keeps using the catalog snapshot bundled in
> `useProducts.js` as a fallback. Run this server anywhere Node runs
> (a laptop, a VPS, a container) to make the admin live; point the
> frontend's `/api` at it via the dev proxy or by serving the build from
> this server.
