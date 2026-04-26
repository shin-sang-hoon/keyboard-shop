import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import KeyboardBuilder from "../KeyboardBuilder";

const API_BASE = "http://localhost:8080/api";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setProduct(null);
    setError(null);
    fetch(`${API_BASE}/products/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setProduct)
      .catch(e => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div style={S.errorWrap}>
        <Link to="/products" style={S.backLink}>← 목록으로</Link>
        <p style={{ color: "#a23", marginTop: 16 }}>상품을 불러올 수 없습니다: {error}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={S.errorWrap}>
        <Link to="/products" style={S.backLink}>← 목록으로</Link>
        <p style={{ color: "#8A8680", marginTop: 16 }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={S.topBar}>
        <Link to="/products" style={S.backLink}>← 목록으로</Link>
        <span style={S.productName}>{product.name || `상품 #${product.id}`}</span>
      </div>

      <KeyboardBuilder
        productId={product.id}
        glbUrl={product.glbUrl}
        productName={product.name}
        productLayout={product.layout}
        basePrice={product.price}
        productDescription={product.description}
      />
    </div>
  );
}

const S = {
  errorWrap: {
    fontFamily: "'DM Sans','Pretendard',sans-serif",
    background: "#F0EEE9", minHeight: "100vh", padding: "2rem",
  },
  topBar: {
    background: "#F0EEE9", padding: "1rem 2rem",
    display: "flex", alignItems: "center", gap: 16,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    fontFamily: "'DM Sans','Pretendard',sans-serif",
  },
  backLink: {
    color: "#5A5855", textDecoration: "none", fontSize: 13,
    fontWeight: 500,
  },
  productName: {
    fontSize: 13, color: "#1A1814", fontWeight: 600,
  },
};
