import { useMemo, useState } from "react";
import { useCart } from '../hooks/useCart';
import { useProducts } from '../hooks/useProducts';

export default function ProductDetailPage({
  productId,
  onBack = () => console.log('back'),
  cartCount = 0,
  onSearch = () => {},
  onAccount = () => {},
  onCart = () => {},
}) {
  const { getProduct } = useProducts();
  const { addToCart } = useCart();
  const product = useMemo(() => getProduct(productId), [productId, getProduct]);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  if (!product) return <div>Product not found</div>;

  const images = [
    { src: null, color: product.tile[0] },
    { src: null, color: product.tile[1] },
    { src: null, color: product.tile[0] },
    { src: null, color: product.tile[1] },
    { src: null, color: product.tile[0] },
  ];

  const handleAddToCart = () => {
    addToCart(product, qty);
  };

  return (
    <div className="pd-page">
      <style>{css}</style>

      <header className="pd-header">
        <div className="pd-shell pd-header-in">
          <button className="pd-back" onClick={onBack}>← Back</button>
          <h1 className="pd-title">Product Details</h1>
          <div className="pd-icons">
            <button onClick={onSearch} aria-label="Search">🔍</button>
            <button onClick={onAccount} aria-label="Account">👤</button>
            <button onClick={onCart} aria-label={`Cart (${cartCount})`} style={{ position: 'relative' }}>
              🛒
              {cartCount > 0 && <span className="pd-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="pd-shell">
        <div className="pd-layout">
          <section className="pd-gallery">
            <div className="pd-main-image" style={{ background: images[imageIndex].color }}></div>
            <div className="pd-thumbnails">
              {images.map((img, i) => (
                <button
                  key={i}
                  className={`pd-thumb ${i === imageIndex ? 'active' : ''}`}
                  style={{ background: img.color }}
                  onClick={() => setImageIndex(i)}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          </section>

          <section className="pd-details">
            <div className="pd-meta">
              <span className="pd-type" style={{ color: '#2d7a3e' }}>{product.type}</span>
              <h2 className="pd-name">{product.name}</h2>
              <p className="pd-subtitle">{product.subtitle}</p>
            </div>

            <div className="pd-specs">
              <div className="pd-spec">
                <span className="pd-label">Strength</span>
                <span className="pd-value">{product.strength}</span>
              </div>
              <div className="pd-spec">
                <span className="pd-label">Unit Size</span>
                <span className="pd-value">{product.unit}</span>
              </div>
              {product.effects.length > 0 && (
                <div className="pd-spec">
                  <span className="pd-label">Effects</span>
                  <div className="pd-effects">
                    {product.effects.map((e) => (
                      <span key={e} className="pd-effect">{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pd-price">${product.price}</div>

            <div className="pd-qty">
              <label>Quantity:</label>
              <div className="pd-qty-control">
                <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span>{qty}</span>
                <button onClick={() => setQty(Math.min(10, qty + 1))}>+</button>
              </div>
            </div>

            <button className="pd-add-btn" onClick={handleAddToCart}>
              Add to Cart
            </button>

            <div className="pd-installment">
              <p>or 4 interest-free payments of <strong>${(product.price / 4).toFixed(2)}</strong> with Klarna</p>
            </div>

            <div className="pd-description">
              <h3>About This Product</h3>
              <p>Premium quality {product.type.toLowerCase()} product. Lab tested for potency and purity. Compliant with all local regulations.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const css = `
.pd-page {
  background: #fafafa; color: #1a1d1b;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.pd-header {
  background: #fff; border-bottom: 1px solid #e8e8e6;
  padding: 14px 0; sticky: top; z-index: 10;
}
.pd-shell { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
.pd-header-in {
  display: flex; align-items: center; justify-content: space-between;
}
.pd-back { background: none; border: none; color: #2d6a3e; cursor: pointer; font-size: 1.1rem; font-weight: 600; }
.pd-title { flex: 1; margin: 0 20px; font-size: 1.5rem; }
.pd-icons { display: flex; gap: 20px; font-size: 1.3rem; }
.pd-icons button { background: none; border: none; color: #1a1d1b; cursor: pointer; position: relative; }
.pd-badge { position: absolute; top: -8px; right: -8px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 9px; background: #2d6a3e; color: #fff; font-size: 0.7rem; font-weight: 600;
  display: grid; place-items: center; }

.pd-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 40px 0; }
.pd-gallery { }
.pd-main-image { width: 100%; aspect-ratio: 1; border-radius: 12px; background: #e8efe6; }
.pd-thumbnails { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 12px; }
.pd-thumb { width: 100%; aspect-ratio: 1; border-radius: 8px; border: 2px solid transparent; cursor: pointer; transition: border-color 0.2s; }
.pd-thumb.active { border-color: #2d6a3e; }

.pd-details { display: flex; flex-direction: column; }
.pd-meta { }
.pd-type { display: inline-block; padding: 4px 8px; background: #efeaf8; border-radius: 4px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; }
.pd-name { margin: 12px 0 6px; font-size: 2.2rem; font-weight: 700; }
.pd-subtitle { margin: 0; color: #666b67; font-size: 1.1rem; }

.pd-specs { margin: 20px 0; padding: 20px 0; border-top: 1px solid #e8e8e6; border-bottom: 1px solid #e8e8e6; }
.pd-spec { margin-bottom: 14px; }
.pd-spec:last-child { margin-bottom: 0; }
.pd-label { display: block; font-size: 0.9rem; color: #666b67; text-transform: uppercase; font-weight: 600; margin-bottom: 6px; }
.pd-value { display: block; font-size: 1.1rem; font-weight: 500; }
.pd-effects { display: flex; gap: 8px; flex-wrap: wrap; }
.pd-effect { display: inline-block; padding: 6px 12px; background: #f1f3ef; border-radius: 20px; font-size: 0.9rem; }

.pd-price { margin: 20px 0; font-size: 2.4rem; font-weight: 700; color: #2d6a3e; }

.pd-qty { margin: 24px 0; display: flex; align-items: center; gap: 16px; }
.pd-qty label { font-weight: 600; }
.pd-qty-control { display: flex; align-items: center; gap: 10px; border: 1px solid #d8d8d6; border-radius: 6px; padding: 0 4px; height: 44px; }
.pd-qty-control button { background: none; border: none; cursor: pointer; width: 32px; display: grid; place-items: center; font-size: 1.2rem; }
.pd-qty-control span { width: 40px; text-align: center; font-weight: 600; }

.pd-add-btn { width: 100%; height: 56px; margin-top: 20px;
  background: #2d6a3e; color: #fff; border: none; border-radius: 6px;
  font: inherit; font-size: 1.15rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.pd-add-btn:hover { background: #22532f; }

.pd-installment { margin-top: 16px; padding: 12px; background: #f1f3ef; border-radius: 6px; font-size: 0.9rem; text-align: center; }

.pd-description { margin-top: 30px; }
.pd-description h3 { margin: 0 0 12px; font-size: 1.2rem; }
.pd-description p { margin: 0; color: #666b67; line-height: 1.6; }

@media (max-width: 768px) {
  .pd-layout { grid-template-columns: 1fr; gap: 20px; }
  .pd-name { font-size: 1.6rem; }
  .pd-price { font-size: 1.8rem; }
}
`;
