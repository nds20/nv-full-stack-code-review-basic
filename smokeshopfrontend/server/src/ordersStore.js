'use strict';

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
 *     createdAt: ISO timestamp, seenAt: ISO timestamp | null
 *   }
 */
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
    };
    this.orders.push(order);
    this.save();
    return { ...order };
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
