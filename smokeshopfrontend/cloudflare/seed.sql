-- Smoke Shop API — seed data for the Cloudflare port.
--
-- Run this in the D1 console AFTER schema.sql (see README.md in this
-- folder). It inserts the shop's current 5 real products, field-for-field
-- identical to the Node server's seed (server/data/products.seed.json),
-- including the explicit ids 1-5 so product URLs match the existing shop.
-- NULL price / thc means "TBD", exactly as in the JSON seed — nothing is
-- invented. Product images keep their static /images/products/... paths
-- from the site build; only NEW admin uploads go to R2.
--
-- INSERT OR REPLACE makes this safe to re-run: it refreshes the five
-- seeded rows without touching products added later through the admin.

INSERT OR REPLACE INTO products (id, name, subtitle, category, type, thc, strength, price, unit, effects, tile, image) VALUES
  (1, 'Muha Meds Runtz 2G', 'THC Vape Disposable · Candy-Sweet Fruity Runtz', 'vapes', 'Hybrid', NULL, 'THC TBD', 17.49, '2g', '["Relaxed","Happy"]', '["#ff8c1a","#f5b921"]', '/images/products/muha-runtz-2g.svg'),
  (2, 'Muha Meds Galactic Diesel 2G', 'THC Vape Disposable · Pungent Earthy Diesel · Postless Ceramic, Rechargeable, LED Display', 'vapes', 'Hybrid', NULL, 'THC TBD', NULL, '2g', '["Heavy","Hazy"]', '["#a855f7","#7c3aed"]', '/images/products/muha-galactic-diesel-2g.svg'),
  (3, 'Pack Man 2G Combo', 'THC Vape Dual-Chamber Disposable · Watermelon Frost + Fruit Loops · LED Screen, USB-C, Draw-Activated', 'vapes', 'Indica/Hybrid', NULL, 'THC TBD', NULL, '2g', '[]', '["#14532d","#052e16"]', '/images/products/packman-2g-combo.svg'),
  (4, 'Raz Nicotine Vape', 'Nicotine Vape · Baby Blue', 'nic-vapes', 'Nicotine', NULL, '12W', NULL, '1ct', '[]', '["#7dd3fc","#38bdf8"]', '/images/products/raz-nicotine-vape.svg'),
  (5, 'Rehab Cherry Candy Gelato', 'Cannabis Flower · Cherry Candy Gelato', 'flower', 'Flower', NULL, 'THC TBD', 30, NULL, '[]', '["#dc2626","#171717"]', '/images/products/rehab-cherry-candy-gelato.svg');
