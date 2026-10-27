'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Tiny JSON-file-backed orders store — the orders counterpart of the
 * product store in ./store.js.
 *
 * Orders live in `data/orders.json` (git-ignored). Unlike the catalog there
 * is no seed: the file starts as an empty array on first run and every
 * placed order is appended and written through to disk, so orders survive
 * restarts. Order ids are incrementing integers (1, 2, 3, ...).
 *
 * Order shape:
 *   {
 *     id, items: [{ productId, name, qty, unitPrice, lineTotal }],
 *     subtotal, tax, total,
 *     customer: { fullName, phone, address, city, zip, notes },
 *     payment: { method: 'card', last4 } | null,   // never full card data
 *     status: 'new' | 'seen',
 *     createdAt: ISO timestamp, seenAt: ISO timestamp | null,
 *     paymentStatus: 'unpaid' | 'pending' | 'paid' | 'payment_failed',
 *     stripeSessionId: string | null,        // Stripe Checkout Session
 *     stripePaymentIntentId: string | null,  // set by the webhook when paid
 *     accessToken: string  // random per-order secret issued to the buyer;
 *                          // gates that order's public status + checkout
 *   }
 *
 * The Stripe fields arrived after the first orders were stored; load()
 * backfills them on older records (paymentStatus 'unpaid', no session, a
 * freshly generated accessToken) so every order the API returns has the
 * full shape.
 */
function newAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}
class OrderStore {
  constructor(dataFile) {
    this.dataFile = dataFile;
    this.orders = [];
    this.load();
  }

  load() {
    if (fs.existsSync(this.dataFile)) {
      this.orders = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    } else {
      this.orders = [];
      this.save();
    }
    if (!Array.isArray(this.orders)) {
      throw new Error(`Order store at ${this.dataFile} is not a JSON array`);
    }
    // Backfill the Stripe payment fields on orders stored before they
    // existed (see the shape note above).
    let backfilled = false;
    for (const order of this.orders) {
      if (order.paymentStatus === undefined) { order.paymentStatus = 'unpaid'; backfilled = true; }
      if (order.stripeSessionId === undefined) { order.stripeSessionId = null; backfilled = true; }
      if (order.stripePaymentIntentId === undefined) { order.stripePaymentIntentId = null; backfilled = true; }
      if (!order.accessToken) { order.accessToken = newAccessToken(); backfilled = true; }
    }
    if (backfilled) this.save();
  }

  save() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    const tmp = `${this.dataFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.orders, null, 2));
    fs.renameSync(tmp, this.dataFile);
  }

  /** All orders, newest first. */
  all() {
    return this.orders
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((o) => ({ ...o }));
  }

  get(id) {
    const found = this.orders.find((o) => o.id === Number(id));
    return found ? { ...found } : null;
  }

  create(data) {
    const id = this.orders.reduce((max, o) => Math.max(max, o.id || 0), 0) + 1;
    const order = {
      ...data,
      id,
      status: 'new',
      createdAt: new Date().toISOString(),
      seenAt: null,
      paymentStatus: 'unpaid',
      stripeSessionId: null,
      stripePaymentIntentId: null,
      accessToken: newAccessToken(),
    };
    this.orders.push(order);
    this.save();
    return { ...order };
  }

  /**
   * Patch an order's Stripe payment fields. Only the keys present in
   * `patch` are written: { paymentStatus, stripeSessionId,
   * stripePaymentIntentId }. Returns the updated order, or null when it
   * does not exist.
   */
  updatePayment(id, patch) {
    const index = this.orders.findIndex((o) => o.id === Number(id));
    if (index === -1) return null;
    const next = { ...this.orders[index] };
    for (const field of ['paymentStatus', 'stripeSessionId', 'stripePaymentIntentId']) {
      if (patch[field] !== undefined) next[field] = patch[field];
    }
    this.orders[index] = next;
    this.save();
    return { ...next };
  }

  /** Find the order a Stripe Checkout Session belongs to (webhook lookup). */
  findBySessionId(sessionId) {
    if (!sessionId) return null;
    const found = this.orders.find((o) => o.stripeSessionId === String(sessionId));
    return found ? { ...found } : null;
  }

  /**
   * Acknowledge an order: status 'new' -> 'seen', stamping seenAt the first
   * time it happens. Idempotent — acknowledging a seen order returns it
   * unchanged. Returns null when the order does not exist.
   */
  markSeen(id) {
    const index = this.orders.findIndex((o) => o.id === Number(id));
    if (index === -1) return null;
    if (this.orders[index].status !== 'seen') {
      this.orders[index] = {
        ...this.orders[index],
        status: 'seen',
        seenAt: new Date().toISOString(),
      };
      this.save();
    }
    return { ...this.orders[index] };
  }

  newCount() {
    return this.orders.filter((o) => o.status === 'new').length;
  }
}

function createOrderStore(dataDir) {
  return new OrderStore(path.join(dataDir, 'orders.json'));
}

module.exports = { OrderStore, createOrderStore };
