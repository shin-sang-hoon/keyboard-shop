// ─────────────────────────────────────────────────────────────────────────
// KeyboardBuilderRoute.jsx
// /builder/:id 라우트 전용 wrapper
//
// 5/10 fix: App.jsx 에서 <KeyboardBuilder /> 를 prop 없이 마운트해서
//          glbUrl=null 로 초기화 → "GLB 경로가 없습니다" 표시되던 버그 수정.
//          useParams 로 id 추출 + /api/products/:id fetch 후 props 주입.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import KeyboardBuilder from './KeyboardBuilder';

const API_BASE = "http://localhost:8080/api";

export default function KeyboardBuilderRoute() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/products/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`상품을 찾을 수 없습니다 (${r.status})`);
        return r.json();
      })
      .then(setProduct)
      .catch(e => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        상품 정보를 불러오는 중...
      </div>
    );
  }

  return (
    <KeyboardBuilder
      productId={product.id}
      glbUrl={product.glbUrl}
      productName={product.name}
      productLayout={product.layout}
      productDescription={product.description}
      basePrice={product.price}
    />
  );
}
