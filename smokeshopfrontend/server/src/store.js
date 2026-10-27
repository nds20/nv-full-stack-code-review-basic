'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Tiny JSON-file-backed product store.
 *
 * The live catalog is kept in `data/products.json`. On first run the file is
 * created from `data/products.seed.json` (the exact products that used to be
 * hardcoded in the React app), so the shop starts with the real catalog and
 * every admin change is persisted to disk across restarts.
 */
class ProductStore {
  constructor(dataFile, seedFile) {
    this.dataFile = dataFile;
    this.seedFile = seedFile;
    this.products = [];
    this.load();
  }

  load() {
    if (fs.existsSync(this.dataFile)) {
      this.products = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    } else {
      this.products = JSON.parse(fs.readFileSync(this.seedFile, 'utf8'));
      this.save();
    }
    if (!Array.isArray(this.products)) {
      throw new Error(`Product store at ${this.dataFile} is not a JSON array`);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    const tmp = `${this.dataFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.products, null, 2));
    fs.renameSync(tmp, this.dataFile);
  }

  all() {
    return this.products.map((p) => ({ ...p }));
  }

  get(id) {
    const found = this.products.find((p) => p.id === Number(id));
    return found ? { ...found } : null;
  }

  create(data) {
    const id = this.products.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
    const product = { ...data, id };
    this.products.push(product);
    this.save();
    return { ...product };
  }

  update(id, data) {
    const index = this.products.findIndex((p) => p.id === Number(id));
    if (index === -1) return null;
    this.products[index] = { ...this.products[index], ...data, id: this.products[index].id };
    this.save();
    return { ...this.products[index] };
  }

  remove(id) {
    const index = this.products.findIndex((p) => p.id === Number(id));
    if (index === -1) return false;
    this.products.splice(index, 1);
    this.save();
    return true;
  }
}

function createStore(dataDir) {
  return new ProductStore(
    path.join(dataDir, 'products.json'),
    path.join(dataDir, 'products.seed.json')
  );
}

module.exports = { ProductStore, createStore };
