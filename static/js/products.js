// Smoke Shop product data for the static mirror.
// Mirrors smokeshopfrontend/src/hooks/useProducts.js exactly.
// price: null means the price is not confirmed yet and must display as
// "Price TBD" — never invent a price, potency, effect, or rating here.
window.PRODUCTS = [
  {
    slug: 'muha-runtz-2g',
    page: 'product-muha-runtz-2g.html',
    name: 'Muha Meds Runtz 2G',
    subtitle: 'THC Vape Disposable · Candy-Sweet Fruity Runtz',
    category: 'vapes',
    type: 'Hybrid',
    strength: 'THC TBD',
    price: 17.49,
    unit: '2g',
    effects: ['Relaxed', 'Happy'],
    tile: ['#ff8c1a', '#f5b921'],
    image: 'images/products/muha-runtz-2g.svg',
    about: 'A 2G THC vape disposable with a candy-sweet, fruity Runtz profile. Hybrid. Strength: THC TBD.'
  },
  {
    slug: 'muha-galactic-diesel-2g',
    page: 'product-muha-galactic-diesel-2g.html',
    name: 'Muha Meds Galactic Diesel 2G',
    subtitle: 'THC Vape Disposable · Pungent Earthy Diesel · Postless Ceramic, Rechargeable, LED Display',
    category: 'vapes',
    type: 'Hybrid',
    strength: 'THC TBD',
    price: null,
    unit: '2g',
    effects: ['Heavy', 'Hazy'],
    tile: ['#a855f7', '#7c3aed'],
    image: 'images/products/muha-galactic-diesel-2g.svg',
    about: 'A 2G THC vape disposable with a pungent, earthy diesel profile, a postless ceramic build, a rechargeable battery, and an LED display. Hybrid. Strength: THC TBD.'
  },
  {
    slug: 'pack-man-2g-combo',
    page: 'product-pack-man-2g-combo.html',
    name: 'Pack Man 2G Combo',
    subtitle: 'THC Vape Dual-Chamber Disposable · Watermelon Frost + Fruit Loops · LED Screen, USB-C, Draw-Activated',
    category: 'vapes',
    type: 'Indica/Hybrid',
    strength: 'THC TBD',
    price: null,
    unit: '2g',
    effects: [],
    tile: ['#14532d', '#052e16'],
    image: 'images/products/packman-2g-combo.svg',
    about: 'A 2G dual-chamber THC vape disposable pairing Watermelon Frost and Fruit Loops in one device, with an LED screen, USB-C charging, and draw activation. Strength: THC TBD.'
  },
  {
    slug: 'raz-nicotine-vape',
    page: 'product-raz-nicotine-vape.html',
    name: 'Raz Nicotine Vape',
    subtitle: 'Nicotine Vape · Baby Blue',
    category: 'nic-vapes',
    type: 'Nicotine',
    strength: '12W',
    price: null,
    unit: '1ct',
    effects: [],
    tile: ['#7dd3fc', '#38bdf8'],
    image: 'images/products/raz-nicotine-vape.svg',
    about: 'A nicotine vape in baby blue, rated at 12W. Sold as a single count (1ct).'
  },
  {
    slug: 'rehab-cherry-candy-gelato',
    page: 'product-rehab-cherry-candy-gelato.html',
    name: 'Rehab Cherry Candy Gelato',
    subtitle: 'Cannabis Flower · Cherry Candy Gelato',
    category: 'flower',
    type: 'Flower',
    strength: 'THC TBD',
    price: 30,
    unit: null,
    effects: [],
    tile: ['#dc2626', '#171717'],
    image: 'images/products/rehab-cherry-candy-gelato.svg',
    about: 'Cannabis flower — Cherry Candy Gelato. Strength: THC TBD.'
  }
];

window.getProduct = function (slug) {
  return window.PRODUCTS.find(function (p) { return p.slug === slug; }) || null;
};
