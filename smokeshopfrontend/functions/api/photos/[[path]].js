// GET /api/photos/<key> — serves product photos uploaded through the
// admin area, which live in the R2 bucket bound as PRODUCT_PHOTOS
// (uploads are stored under keys like "products/<id>-<slug>.<ext>", so
// their URLs are /api/photos/products/<id>-<slug>.<ext>).
//
// Seeded catalog photos are NOT served here: they keep their static
// /images/products/... paths from the site build. If the bucket is not
// bound, everything here is a 404 and the rest of the API is unaffected.

import { json } from '../_lib/http.js';
import { contentTypeForExtension, extensionOf } from '../_lib/photos.js';

export async function onRequestGet({ env, params }) {
  if (!env.PRODUCT_PHOTOS) {
    return json({ error: 'Photo storage is not configured on this deployment.' }, 404);
  }
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  const key = segments.filter(Boolean).join('/');
  if (!key || key.includes('..')) {
    return json({ error: 'Photo not found' }, 404);
  }
  const object = await env.PRODUCT_PHOTOS.get(key);
  if (!object) return json({ error: 'Photo not found' }, 404);

  const headers = new Headers();
  const contentType =
    (object.httpMetadata && object.httpMetadata.contentType) ||
    contentTypeForExtension(extensionOf(key));
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=86400');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  return new Response(object.body, { headers });
}
