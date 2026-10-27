// Product photo uploads — the Cloudflare port of the Node server's multer
// handling in server/index.js.
//
// Node stores uploads as files in public/images/products/ and the product's
// `image` points at /images/products/<file>. Here uploads go to an R2
// bucket bound as `PRODUCT_PHOTOS` and are served back by the Pages
// Function in ../photos/[[path]].js, so a product created with a photo
// gets image = /api/photos/products/<id>-<slug>.<ext>. Products that
// already exist (the seeded catalog) keep their static
// /images/products/... paths untouched.
//
// Same validation as Node: image extensions only (.jpg .jpeg .png .webp
// .gif .svg) with an image/* content type, 10 MB maximum.
//
// If the PRODUCT_PHOTOS binding is absent, products can still be created
// and edited WITHOUT a photo; an attempt to upload one fails with a clear
// 400 (see assertPhotoStorage) instead of crashing.

import { fail, slugify } from './http.js';
import { updateProductImage } from './db.js';

export const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const CONTENT_TYPES_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export function extensionOf(filename) {
  const name = String(filename || '');
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

export function contentTypeForExtension(ext) {
  return CONTENT_TYPES_BY_EXT[ext] || 'application/octet-stream';
}

/** The Node fileFilter + size-limit checks, in the same order multer runs them. */
export function validatePhotoFile(file) {
  const ext = extensionOf(file.name);
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext) || !(file.type || '').startsWith('image/')) {
    fail(400, 'photo must be an image file (jpg, png, webp, gif or svg)');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    fail(400, 'File too large');
  }
}

/**
 * Fail early — before any row is written — when a photo was attached but
 * this deployment has no R2 bucket bound.
 */
export function assertPhotoStorage(env, photo) {
  if (photo && !env.PRODUCT_PHOTOS) {
    fail(
      400,
      'Photo uploads are not configured on this deployment: the R2 bucket binding ' +
        '"PRODUCT_PHOTOS" is missing. Add it in the Pages project settings ' +
        '(see cloudflare/README.md) or save the product without a photo.'
    );
  }
}

/**
 * Read a product create/update request the way Express + multer presented
 * it to the Node handlers: JSON bodies come through typed; multipart
 * bodies come through as string fields plus an optional `photo` file.
 * Returns { fields, photo } where photo is a File or null.
 */
export async function readProductInput(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const fields = {};
    let photo = null;
    for (const [key, value] of form.entries()) {
      if (key === 'photo') {
        // An untouched file input arrives as an empty File — treat as none.
        if (value && typeof value === 'object' && value.size > 0 && value.name) {
          photo = value;
        }
      } else if (typeof value === 'string') {
        fields[key] = value;
      }
    }
    if (photo) validatePhotoFile(photo);
    return { fields, photo };
  }

  if (contentType.includes('json')) {
    const parsed = await request.json().catch(() => fail(400, 'Invalid JSON body'));
    const fields = parsed && typeof parsed === 'object' ? parsed : {};
    return { fields, photo: null };
  }

  // Express's json parser left req.body as {} for other content types;
  // validation downstream produces the same errors as the Node server.
  return { fields: {}, photo: null };
}

/**
 * Store an uploaded photo in R2 under a stable, readable key and point the
 * product at it — the port of Node's finalizePhoto(). Returns the product
 * (updated when a photo was stored).
 */
export async function attachPhoto(env, product, photo) {
  if (!photo) return product;
  assertPhotoStorage(env, photo);
  const ext = extensionOf(photo.name);
  const key = `products/${product.id}-${slugify(product.name)}${ext}`;
  await env.PRODUCT_PHOTOS.put(key, photo.stream(), {
    httpMetadata: { contentType: photo.type || contentTypeForExtension(ext) },
  });
  const image = `/api/photos/${key}`;
  return (await updateProductImage(env, product.id, image)) || { ...product, image };
}
