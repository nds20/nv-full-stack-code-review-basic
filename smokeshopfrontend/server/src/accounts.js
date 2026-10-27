'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Stored admin accounts, created through the first-run setup flow
 * (POST /api/admin/setup).
 *
 * Accounts live in `data/admin-accounts.json` (git-ignored). Passwords are
 * NEVER stored in plaintext: each account keeps a per-account random salt
 * and a scrypt hash (Node's built-in crypto — no extra dependencies), and
 * verification recomputes the hash and compares with timingSafeEqual.
 *
 * Record shape: { username, salt, hash, createdAt }
 */
const SCRYPT_KEYLEN = 64;

class AccountsStore {
  constructor(dataFile) {
    this.dataFile = dataFile;
    this.accounts = [];
    this.load();
  }

  load() {
    if (fs.existsSync(this.dataFile)) {
      this.accounts = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
    } else {
      this.accounts = [];
      this.save();
    }
    if (!Array.isArray(this.accounts)) {
      throw new Error(`Accounts store at ${this.dataFile} is not a JSON array`);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    const tmp = `${this.dataFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.accounts, null, 2));
    fs.renameSync(tmp, this.dataFile);
  }

  hasAccounts() {
    return this.accounts.length > 0;
  }

  find(username) {
    const wanted = String(username || '').trim().toLowerCase();
    return this.accounts.find((a) => a.username.toLowerCase() === wanted) || null;
  }

  create(username, password) {
    const name = String(username || '').trim();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
    const account = { username: name, salt, hash, createdAt: new Date().toISOString() };
    this.accounts.push(account);
    this.save();
    return { username: account.username, createdAt: account.createdAt };
  }

  /** Constant-time credential check against the stored (hashed) accounts. */
  verify(username, password) {
    const account = this.find(username);
    if (!account) {
      // Burn a comparable amount of work so unknown usernames are not
      // trivially distinguishable by timing.
      crypto.scryptSync(String(password || ''), 'unknown-user-salt', SCRYPT_KEYLEN);
      return false;
    }
    const candidate = crypto.scryptSync(String(password || ''), account.salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(account.hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }
}

function createAccountsStore(dataDir) {
  return new AccountsStore(path.join(dataDir, 'admin-accounts.json'));
}

module.exports = { AccountsStore, createAccountsStore };
