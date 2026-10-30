// Smoke Shop product data for the static mirror.
// Mirrors smokeshopfrontend/src/hooks/useProducts.js exactly.
// price: null means the price is not confirmed yet and must display as
// "Price TBD" — never invent a price, potency, effect, or rating here.
window.PRODUCTS = [
  {
    slug: 'raz-nicotine-vape',
    page: 'product-raz-nicotine-vape.html',
    name: 'Raz Nicotine Vape',
    subtitle: 'Nicotine Vape · Blue Raz',
    category: 'nic-vapes',
    type: 'Nicotine',
    strength: '12W',
    price: null,
    unit: '1ct',
    effects: [],
    tile: ['#7dd3fc', '#38bdf8'],
    image: 'images/products/raz-nicotine-vape.svg',
    about: 'A nicotine vape in the Blue Raz flavor, rated at 12W. Sold as a single count (1ct).'
  },
  {
    slug: 'raz-blueberry-yummy',
    page: 'product-raz-blueberry-yummy.html',
    name: 'Raz Blueberry Yummy',
    subtitle: 'Nicotine Vape · Blueberry Yummy',
    category: 'nic-vapes',
    type: 'Nicotine',
    strength: 'TBD',
    price: null,
    unit: '1ct',
    effects: [],
    tile: ['#2bff62', '#00c853'],
    image: 'images/products/raz-blueberry-yummy.svg',
    about: 'A nicotine vape in the Blueberry Yummy flavor. Sold as a single count (1ct). Strength: TBD.'
  }
];

window.getProduct = function (slug) {
  return window.PRODUCTS.find(function (p) { return p.slug === slug; }) || null;
};
