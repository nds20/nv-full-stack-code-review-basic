// /api/products/:id — public read (GET), admin update (PUT) and delete
// (DELETE). Port of the matching routes in ../../../server/index.js.

import { handle, json, fail } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { getProduct, updateProduct, removeProduct } from '../_lib/db.js';
import { normalizeProduct } from '../_lib/validate.js';
import { readProductInput, assertPhotoStorage, attachPhoto } from '../_lib/photos.js';

export const onRequestGet = handle(async ({ env, params }) => {
  const product = await getProduct(env, params.id);
  if (!product) fail(404, 'Product not found');
  return json(product);
});

export const onRequestPut = handle(async (context) => {
  await requireAdmin(context);
  const existing = await getProduct(context.env, context.params.id);
  if (!existing) fail(404, 'Product not found');
  const { fields, photo } = await readProductInput(context.request);
  assertPhotoStorage(context.env, photo);
  const data = normalizeProduct(fields, existing);
  const updated = await updateProduct(context.env, existing.id, data);
  return json(await attachPhoto(context.env, updated, photo));
});

export const onRequestDelete = handle(async (context) => {
  await requireAdmin(context);
  if (!(await removeProduct(context.env, context.params.id))) {
    fail(404, 'Product not found');
  }
  // Photo objects are intentionally left in R2: an object may be referenced
  // by the committed catalog, and deleting user assets is destructive —
  // the same policy as the Node server leaving files on disk.
  return new Response(null, { status: 204 });
});
