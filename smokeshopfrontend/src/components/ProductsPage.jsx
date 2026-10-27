import { useState } from 'react';
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';

export default function ProductsPage({
  onProductSelect = (id) => console.log('select', id),
  onBack = () => console.log('back'),
  cartCount = 0,
  onSearch = () => {},
  onAccount = () => {},
  onCart = () => {},
  onAdmin = () => {},
}) {
  const { products } = useProducts();
  const { addToCart } = useCart();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100);
  const [viewType, setViewType] = useState('grid');

  const categories = [
    { id: 'all', name: 'All Products' },
    { id: 'flower', name: 'Flower' },
    { id: 'vapes', name: 'Vapes' },
    { id: 'gummies', name: 'Gummies' },
    { id: 'pouches', name: 'Pouches' },
    { id: 'nic-vapes', name: 'Nicotine Vapes' },
  ];

  let filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.subtitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesPrice = p.price == null || (p.price >= minPrice && p.price <= maxPrice);
    return matchesSearch && matchesCategory && matchesPrice;
  });

  if (sortBy === 'price-low') filtered.sort((a, b) => a.price - b.price);
  if (sortBy === 'price-high') filtered.sort((a, b) => b.price - a.price);
  if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="pp-page">
      <style>{css}</style>

      <header className="pp-header">
        <div className="pp-shell pp-header-in">
          <button className="pp-back" onClick={onBack}>← Back</button>
          <h1 className="pp-title">Shop Products</h1>
          <div className="pp-icons">
            <button onClick={onSearch} aria-label="Search">🔍</button>
            <button onClick={onAccount} aria-label="Account">👤</button>
            <button onClick={onCart} aria-label={`Cart (${cartCount})`} style={{ position: 'relative' }}>
              🛒
              {cartCount > 0 && <span className="pp-badge">{cartCount}</span>}
            </button>
            <button onClick={onAdmin} aria-label="Store admin" title="Store admin">⚙️</button>
          </div>
        </div>
      </header>

      <main className="pp-shell">
        <div className="pp-layout">
          <aside className="pp-sidebar">
            <h2>Refine</h2>
            <section>
              <h3>Category</h3>
              {categories.map((cat) => (
                <label key={cat.id} className="pp-checkbox">
                  <input
                    type="radio"
                    name="category"
                    value={cat.id}
                    checked={selectedCategory === cat.id}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  />
                  {cat.name}
                </label>
              ))}
            </section>
            <section>
              <h3>Price Range</h3>
              <div className="pp-price-range">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minPrice}
                  onChange={(e) => setMinPrice(Number(e.target.value))}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
                <p>${minPrice} - ${maxPrice}</p>
              </div>
            </section>
          </aside>

          <section className="pp-main">
            <div className="pp-controls">
              <div className="pp-search">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="pp-sort">
                <label>Sort:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name: A-Z</option>
                </select>
              </div>
              <div className="pp-view">
                <button
                  className={viewType === 'grid' ? 'active' : ''}
                  onClick={() => setViewType('grid')}
                >
                  ⊞ Grid
                </button>
                <button
                  className={viewType === 'list' ? 'active' : ''}
                  onClick={() => setViewType('list')}
                >
                  ≡ List
                </button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="pp-empty">No products found</div>
            ) : (
              <div className={`pp-grid pp-grid--${viewType}`}>
                {filtered.map((product) => (
                  <div key={product.id} className="pp-card">
                    <div
                      className="pp-thumb"
                      style={{
                        background: `linear-gradient(135deg, ${product.tile[0]}, ${product.tile[1]})`
                      }}
                    >
                      {product.image && (
                        <img
                          className="pp-thumb-img"
                          src={product.image}
                          alt={product.name}
                        />
                      )}
                      <button
                        className="pp-view-btn"
                        onClick={() => onProductSelect(product.id)}
                      >
                        View Details
                      </button>
                    </div>
                    <div className="pp-info">
                      <p className="pp-category">{product.type}</p>
                      <h3 className="pp-name">{product.name}</h3>
                      <p className="pp-sub">{product.subtitle}</p>
                      <p className="pp-strength">{product.strength}</p>
                      <div className="pp-footer">
                        <span className="pp-price">{product.price != null ? `$${product.price}` : 'Price TBD'}</span>
                        <button
                          className="pp-add"
                          onClick={() => addToCart(product, 1)}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

const css = `
.pp-page {
  background: #000; color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.pp-header {
  background: #1a1a1a; border-bottom: 1px solid #333;
  padding: 16px 0; sticky: top; z-index: 10;
}
.pp-shell { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
.pp-header-in {
  display: flex; align-items: center; justify-content: space-between;
}
.pp-back { background: none; border: none; color: #d4f23a; cursor: pointer; font-size: 1.1rem; }
.pp-title { flex: 1; margin: 0 20px; font-size: 1.5rem; }
.pp-icons { display: flex; gap: 20px; font-size: 1.3rem; }
.pp-icons button { background: none; border: none; color: #fff; cursor: pointer; position: relative; }
.pp-badge { position: absolute; top: -8px; right: -8px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 9px; background: #d4f23a; color: #000; font-size: 0.7rem; font-weight: 600;
  display: grid; place-items: center; }

.pp-layout { display: grid; grid-template-columns: 220px 1fr; gap: 30px; margin: 30px 0; }
.pp-sidebar { background: #1a1a1a; padding: 20px; border-radius: 8px; height: fit-content; }
.pp-sidebar h2 { margin: 0 0 20px; font-size: 1.3rem; }
.pp-sidebar h3 { margin: 20px 0 10px; font-size: 0.95rem; text-transform: uppercase; color: #d4f23a; }
.pp-sidebar section { margin-bottom: 20px; }
.pp-checkbox { display: flex; align-items: center; gap: 8px; margin: 8px 0; cursor: pointer; }
.pp-checkbox input { cursor: pointer; }

.pp-price-range { display: flex; flex-direction: column; gap: 10px; }
.pp-price-range input { width: 100%; }
.pp-price-range p { margin: 0; color: #d4f23a; font-size: 0.9rem; }

.pp-controls { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
.pp-search { flex: 1; min-width: 200px; }
.pp-search input { width: 100%; padding: 10px 15px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #fff; }
.pp-sort { display: flex; align-items: center; gap: 10px; }
.pp-sort select { padding: 8px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #fff; }
.pp-view { display: flex; gap: 8px; }
.pp-view button { padding: 8px 16px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #fff; cursor: pointer; }
.pp-view button.active { background: #d4f23a; color: #000; }

.pp-grid { display: grid; gap: 20px; }
.pp-grid--grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.pp-grid--list { grid-template-columns: 1fr; }
.pp-card { background: #1a1a1a; border-radius: 8px; overflow: hidden; transition: transform 0.2s; }
.pp-card:hover { transform: translateY(-4px); }
.pp-thumb { height: 200px; display: grid; place-items: center; position: relative; }
.pp-thumb-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pp-view-btn { position: relative; }
.pp-view-btn { padding: 10px 20px; background: rgba(212, 242, 58, 0.9); color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
.pp-info { padding: 15px; }
.pp-category { margin: 0; font-size: 0.8rem; color: #d4f23a; text-transform: uppercase; }
.pp-name { margin: 8px 0; font-size: 1.1rem; }
.pp-sub { margin: 6px 0; color: #aaa; font-size: 0.9rem; }
.pp-strength { margin: 6px 0; color: #d4f23a; font-size: 0.9rem; }
.pp-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
.pp-price { font-weight: 600; font-size: 1.1rem; }
.pp-add { padding: 6px 12px; background: #d4f23a; color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }

.pp-empty { text-align: center; padding: 40px; color: #aaa; }

@media (max-width: 768px) {
  .pp-layout { grid-template-columns: 1fr; }
  .pp-sidebar { display: none; }
  .pp-grid--grid { grid-template-columns: repeat(2, 1fr); }
}
`;
