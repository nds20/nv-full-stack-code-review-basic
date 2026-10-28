// AI Engine smoke test — added on purpose in a diagnostic PR so the
// BeastMode Review workflow (AFS integrity check + 824 Engine) runs
// against a fresh pull request and produces a current pass/fail log.
// This file is intentionally tiny and changes no shop behavior.
//
// Retest note: this commit exists to trigger a fresh Cloudflare
// Workers Build after the Previews deploy command was changed from
// `npx wrangler preview` to `npx wrangler versions upload`.

function smokeTestTotal(price, quantity) {
  if (typeof price !== "number" || typeof quantity !== "number") {
    throw new TypeError("price and quantity must be numbers");
  }
  return price * quantity;
}

module.exports = { smokeTestTotal };
