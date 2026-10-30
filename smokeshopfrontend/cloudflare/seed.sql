-- Smoke Shop API — seed data for the Cloudflare port.
--
-- Run this in the D1 console AFTER schema.sql (see README.md in this
-- folder). As of 2026-10-30 the shop is nicotine-only (owner's call):
-- every THC vape and the cannabis flower were retired, and the catalog
-- is the two Raz nicotine vapes below. The DELETE retires the old
-- seeded rows (ids 1, 2, 3, 5) so re-running this file brings a live
-- database to the current catalog; INSERT OR REPLACE then refreshes
-- the two current products (ids 4 and 6) without touching products
-- added later through the admin.
--
-- NULL price means "Price TBD" — nothing is invented. The Blueberry
-- Yummy strength is likewise TBD until the owner confirms it. Product
-- images keep their static /images/products/... paths from the site
-- build; only NEW admin uploads go to R2.

DELETE FROM products WHERE id IN (1, 2, 3, 5);

INSERT OR REPLACE INTO products (id, name, subtitle, category, type, thc, strength, price, unit, effects, tile, image) VALUES
  (4, 'Raz Nicotine Vape', 'Nicotine Vape · Blue Raz', 'nic-vapes', 'Nicotine', NULL, '12W', NULL, '1ct', '[]', '["#7dd3fc","#38bdf8"]', '/images/products/raz-nicotine-vape.svg'),
  (6, 'Raz Blueberry Yummy', 'Nicotine Vape · Blueberry Yummy', 'nic-vapes', 'Nicotine', NULL, 'TBD', NULL, '1ct', '[]', '["#2bff62","#00c853"]', '/images/products/raz-blueberry-yummy.svg');
