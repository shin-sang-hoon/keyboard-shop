import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProductGallery from '../components/ProductGallery';
import ProductTabs from '../components/ProductTabs';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// ─── 표시 라벨 매핑 ────────────────────────────────────────────────
const PRODUCT_TYPE_LABELS = {
  KEYBOARD: '키보드',
  MOUSE: '마우스',
  SWITCH_PART: '스위치 부품',
  ACCESSORY: '액세서리',
  NOISE: '노이즈',
  UNCLASSIFIED: null,
};

const CONNECTION_LABELS = {
  WIRELESS: '무선',
  WIRED: '유선',
  BLUETOOTH: '블루투스',
  HYBRID: '하이브리드',
};

const LAYOUT_LABELS = {
  FULL: '풀배열',
  TKL: '텐키리스',
  '96': '96%',
  '75': '75%',
  '65': '65%',
  '60': '60%',
  '40': '40%',
};

// ─── 인증 헬퍼 (5-A 미완 - 임시 localStorage 기반) ──────────────────
// 5-A authStore 완성 시 마이그레이션. 현재는 단순 토큰 존재 여부로 판단.
function getAuthToken() {
  return localStorage.getItem('accessToken');
}

function isLoggedIn() {
  return Boolean(getAuthToken());
}

// ─── 빵부스러기 ────────────────────────────────────────────────────
function Breadcrumb({ productType, productName }) {
  const typeLabel = productType ? PRODUCT_TYPE_LABELS[productType] : null;

  return (
    <nav style={S.breadcrumb} aria-label="breadcrumb">
      <Link to="/" style={S.crumbLink}>홈</Link>
      <span style={S.crumbSep}>›</span>
      <Link to="/products" style={S.crumbLink}>상품</Link>
      {typeLabel && (
        <>
          <span style={S.crumbSep}>›</span>
          <Link
            to={`/products?productType=${productType}`}
            style={S.crumbLink}
          >
            {typeLabel}
          </Link>
        </>
      )}
      <span style={S.crumbSep}>›</span>
      <span style={S.crumbCurrent} title={productName}>
        {productName}
      </span>
    </nav>
  );
}

// ─── 스펙 칩 ─────────────────────────────────────────────────────
function SpecChips({ product }) {
  const chips = [];

  const typeLabel = product.productType
    ? PRODUCT_TYPE_LABELS[product.productType]
    : null;
  if (typeLabel) chips.push({ key: 'type', label: typeLabel });

  const connLabel = product.connectionType
    ? CONNECTION_LABELS[product.connectionType] || product.connectionType
    : null;
  if (connLabel) chips.push({ key: 'conn', label: connLabel });

  const layoutLabel = product.layout
    ? LAYOUT_LABELS[product.layout] || product.layout
    : null;
  if (layoutLabel) chips.push({ key: 'layout', label: layoutLabel });

  if (product.switchName) chips.push({ key: 'switch', label: product.switchName });

  if (chips.length === 0) return null;

  return (
    <div style={S.chipRow}>
      {chips.map((c) => (
        <span key={c.key} style={S.chip}>{c.label}</span>
      ))}
    </div>
  );
}

// ─── 토스트 ──────────────────────────────────────────────────────
function Toast({ message, visible }) {
  if (!message) return null;
  return (
    <div style={{
      ...S.toast,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
    }}>
      {message}
    </div>
  );
}

// ─── 메인 ProductDetail ──────────────────────────────────────────
export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── Like 상태 ────────────────────────────────────────────
  // liked: 본인이 좋아요 눌렀는지 (로그인 시에만 의미 있음)
  // likeCount: 전체 좋아요 수 (비로그인도 표시)
  // 로딩 분리: count 만 먼저 fetch, liked 는 토글 시점에 알 수 있음
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false); // 토글 중 중복 클릭 방지

  // ─── Wishlist 상태 ────────────────────────────────────────
  const [wished, setWished] = useState(false);
  const [wishBusy, setWishBusy] = useState(false);

  // ─── 토스트 ──────────────────────────────────────────────
  const [toast, setToast] = useState({ message: '', visible: false });

  // ─── 상품 데이터 fetch ────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setProduct(null);

    fetch(`${API_BASE}/products/${id}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setProduct(data))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id]);

  // ─── 좋아요 카운트 fetch (비로그인도 가능) ────────────────────
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/products/${id}/like/count`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setLikeCount(data.count ?? 0))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        // 카운트 fetch 실패는 silent (UI 0 으로 폴백, 사용자에게 토스트 안 띄움)
        console.warn('Like count fetch failed:', err.message);
      });
    return () => controller.abort();
  }, [id]);

  // 주의: 로그인 사용자의 liked/wished 초기 상태는 별도 API 가 없어서
  // 토글 시점에 서버 응답으로 동기화. 페이지 이탈 후 재진입 시 기존 상태가
  // 보이지 않는 한계 — B1 ProductDto 에 isLikedByMe 추가하면 해결 가능.

  // ─── 토스트 표시 ──────────────────────────────────────────
  function showToast(message) {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 1800);
    setTimeout(() => setToast({ message: '', visible: false }), 2200);
  }

  // ─── 좋아요 토글 (낙관적 업데이트 + 401 롤백) ───────────────
  async function handleToggleLike() {
    if (!isLoggedIn()) {
      showToast('로그인이 필요합니다');
      return;
    }
    if (likeBusy) return;

    // 1) 낙관적 업데이트 — UI 즉시 반영
    const prevLiked = liked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    setLiked(nextLiked);
    setLikeCount(prevCount + (nextLiked ? 1 : -1));
    setLikeBusy(true);

    try {
      const res = await fetch(`${API_BASE}/products/${id}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('AUTH');
        }
        throw new Error(`HTTP ${res.status}`);
      }

      // 2) 서버 응답으로 정확한 상태 동기화
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.count);
    } catch (err) {
      // 3) 롤백
      setLiked(prevLiked);
      setLikeCount(prevCount);

      if (err.message === 'AUTH') {
        showToast('로그인이 만료되었습니다');
      } else {
        showToast('잠시 후 다시 시도해주세요');
      }
    } finally {
      setLikeBusy(false);
    }
  }

  // ─── 찜 토글 (낙관적 업데이트 + 401 롤백) ───────────────────
  async function handleToggleWish() {
    if (!isLoggedIn()) {
      showToast('로그인이 필요합니다');
      return;
    }
    if (wishBusy) return;

    const prevWished = wished;
    setWished(!prevWished);
    setWishBusy(true);

    try {
      const res = await fetch(`${API_BASE}/products/${id}/wishlist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw new Error('AUTH');
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setWished(data.wishlisted);
      showToast(data.wishlisted ? '찜 목록에 추가됨' : '찜 해제됨');
    } catch (err) {
      setWished(prevWished);
      if (err.message === 'AUTH') {
        showToast('로그인이 만료되었습니다');
      } else {
        showToast('잠시 후 다시 시도해주세요');
      }
    } finally {
      setWishBusy(false);
    }
  }

  // ─── 핸들러: 구매/장바구니 (placeholder) ──────────────────
  function handleBuy() {
    showToast('구매 페이지 준비 중입니다');
  }

  function handleAddToCart() {
    showToast('장바구니에 담겼습니다 (준비 중)');
  }

  function handle3DPreview() {
    window.open(`/builder/${id}`, '_blank', 'width=1400,height=900');
  }

  // ─── 로딩 / 에러 ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.statusWrap}>
          <Link to="/products" style={S.backLink}>← 목록으로</Link>
          <p style={S.statusText}>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={S.page}>
        <div style={S.statusWrap}>
          <Link to="/products" style={S.backLink}>← 목록으로</Link>
          <p style={{ ...S.statusText, color: '#dc2626' }}>
            상품을 불러올 수 없습니다{error ? `: ${error}` : ''}
          </p>
        </div>
      </div>
    );
  }

  // ─── 메인 렌더 ────────────────────────────────────────────
  const hasGlb = Boolean(product.glbUrl);

  return (
    <div style={S.page}>
      <div style={S.container}>
        <Breadcrumb
          productType={product.productType}
          productName={product.name || `상품 #${product.id}`}
        />

        <div style={S.layout}>
          {/* 좌측 갤러리 (5-H C1-a) */}
          <div style={S.imageColumn}>
            <ProductGallery
              images={product.images}
              fallbackImageUrl={product.imageUrl}
            />
          </div>

          {/* 우측 정보 / CTA */}
          <div style={S.infoColumn}>
            {/* 상품명 + ♥ 좋아요 (인기도) */}
            <div style={S.titleRow}>
              <h1 style={S.title}>{product.name}</h1>
              <button
                onClick={handleToggleLike}
                disabled={likeBusy}
                style={{
                  ...S.likeTopBtn,
                  borderColor: liked ? '#fecaca' : '#e4e4e7',
                  background: liked ? '#fef2f2' : 'transparent',
                  cursor: likeBusy ? 'wait' : 'pointer',
                  opacity: likeBusy ? 0.7 : 1,
                }}
                aria-label={liked ? '좋아요 취소' : '좋아요'}
                aria-pressed={liked}
                title="이 상품 좋아요"
              >
                <span style={{
                  fontSize: 18,
                  color: liked ? '#ef4444' : '#a1a1aa',
                  lineHeight: 1,
                }}>
                  {liked ? '♥' : '♡'}
                </span>
                <span style={{
                  ...S.likeTopCount,
                  color: liked ? '#ef4444' : '#71717a',
                }}>
                  {likeCount}
                </span>
              </button>
            </div>

            {/* 가격 */}
            <div style={S.price}>
              ₩{(product.price || 0).toLocaleString()}
            </div>

            {/* 스펙 칩 */}
            <SpecChips product={product} />

            {/* 메타 박스 */}
            <div style={S.metaBox}>
              <div style={S.metaRow}>
                <span style={S.metaLabel}>브랜드</span>
                <span style={S.metaValue}>{product.brandName || '-'}</span>
              </div>
              <div style={S.metaRow}>
                <span style={S.metaLabel}>재고</span>
                <span style={S.metaValue}>
                  {product.stock != null ? `${product.stock}개` : '정보 없음'}
                </span>
              </div>
              <div style={S.metaRow}>
                <span style={S.metaLabel}>상태</span>
                <span style={{
                  ...S.metaValue,
                  color: product.status === 'ACTIVE' ? '#16a34a' : '#a1a1aa',
                }}>
                  {product.status === 'ACTIVE' ? '판매중' : product.status || '-'}
                </span>
              </div>
            </div>

            {/* 3D 미리보기 (GLB 있을 때만) */}
            {hasGlb && (
              <button onClick={handle3DPreview} style={S.previewBtn}>
                <span style={{ fontSize: 16, marginRight: 8 }}>🧊</span>
                3D 미리보기
              </button>
            )}

            {/* 메인 CTA — 구매 / 장바구니 */}
            <div style={S.ctaRow}>
              <button onClick={handleBuy} style={S.buyBtn}>
                구매하기
              </button>
              <button onClick={handleAddToCart} style={S.cartBtn}>
                <span style={{ marginRight: 6 }}>🛒</span>
                장바구니
              </button>
            </div>

            {/* ⭐ 찜 (보조) */}
            <button
              onClick={handleToggleWish}
              disabled={wishBusy}
              aria-pressed={wished}
              style={{
                ...S.wishBtn,
                borderColor: wished ? '#fed7aa' : '#e4e4e7',
                background: wished ? '#fff7ed' : '#fff',
                color: wished ? '#c2410c' : '#52525b',
                cursor: wishBusy ? 'wait' : 'pointer',
                opacity: wishBusy ? 0.7 : 1,
              }}
            >
              <span style={{
                marginRight: 6,
                color: wished ? '#f59e0b' : '#a1a1aa',
                fontSize: 16,
                lineHeight: 1,
              }}>
                {wished ? '★' : '☆'}
              </span>
              {wished ? '찜 완료' : '찜하기'}
            </button>
          </div>
        </div>

        {/* 5-H C1-b: 4-tab nav (sticky) */}
        <ProductTabs product={product} productId={product.id} />
      </div>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}

// ─── 스타일 ────────────────────────────────────────────────────
const S = {
  page: {
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
    background: '#fafafa',
    minHeight: '100vh',
    padding: '24px 0',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
  },
  statusWrap: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '60px 24px',
    textAlign: 'center',
  },
  statusText: {
    marginTop: 16,
    color: '#71717a',
    fontSize: 14,
  },
  backLink: {
    color: '#5A5855',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
  },

  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    fontSize: 13,
    color: '#71717a',
    overflow: 'hidden',
  },
  crumbLink: {
    color: '#71717a',
    textDecoration: 'none',
    flexShrink: 0,
  },
  crumbSep: {
    color: '#d4d4d8',
    flexShrink: 0,
  },
  crumbCurrent: {
    color: '#18181b',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },

  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
    gap: 48,
    alignItems: 'start',
  },
  imageColumn: {
    position: 'sticky',
    top: 24,
  },
  infoColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    color: '#18181b',
    margin: 0,
    lineHeight: 1.4,
    flex: 1,
  },

  likeTopBtn: {
    border: '1px solid #e4e4e7',
    borderRadius: 8,
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  likeTopCount: {
    fontSize: 13,
    fontWeight: 500,
  },

  price: {
    fontSize: 28,
    fontWeight: 700,
    color: '#18181b',
    margin: '4px 0',
  },

  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    margin: '4px 0 8px',
  },
  chip: {
    fontSize: 12,
    fontWeight: 500,
    color: '#52525b',
    background: '#f4f4f5',
    padding: '4px 10px',
    borderRadius: 12,
  },

  metaBox: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 8,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
  },
  metaLabel: {
    color: '#71717a',
  },
  metaValue: {
    color: '#18181b',
    fontWeight: 500,
  },

  previewBtn: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: '#6366f1',
    background: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  ctaRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  buyBtn: {
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    background: '#18181b',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  cartBtn: {
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    color: '#18181b',
    background: '#fff',
    border: '1px solid #d4d4d8',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  wishBtn: {
    width: '100%',
    padding: '12px',
    fontSize: 14,
    fontWeight: 500,
    border: '1px solid #e4e4e7',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  toast: {
    position: 'fixed',
    bottom: 40,
    left: '50%',
    background: 'rgba(24,24,27,0.92)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    zIndex: 1000,
    transition: 'all 0.3s',
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
};
