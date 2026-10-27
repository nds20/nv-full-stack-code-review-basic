// /api/products — public catalog list (GET) and admin create (POST).
// Port of the matching routes in ../../server/index.js.

import { handle, json } from './_lib/http.js';
import { requireAdmin } from './_lib/auth.js';
import { listProducts, createProduct } from './_lib/db.js';
import { normalizeProduct } from './_lib/validate.js';
import { readProductInput, assertPhotoStorage, attachPhoto } from './_lib/photos.js';

export const onRequestGet = handle(async ({ env }) => json(await listProducts(env)));

export const onRequestPost = handle(async (context) => {
  await requireAdmin(context);
  const { fields, photo } = await readProductInput(context.request);
  assertPhotoStorage(context.env, photo);
  const data = normalizeProduct(fields, null);
  const created = await createProduct(context.env, data);
  return json(await attachPhoto(context.env, created, photo), 201);
});
