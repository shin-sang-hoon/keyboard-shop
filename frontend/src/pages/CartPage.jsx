// frontend/src/pages/CartPage.jsx
// Phase 8 5-D Round 2 (5/19) — 장바구니 풀 페이지.
//
// 핵심 구조:
//   - 좌측 70%: 아이템 리스트 (썸네일 + 상품명 + 브랜드 + 단가 + 수량 컨트롤 + 소계 + 삭제)
//   - 우측 30%: sticky 총액 박스 (상품금액 + 배송비 + 총합 + 주문하기 CTA)
//   - 빈 상태: 중앙 정렬 + 🛒 이모지 + "쇼핑 계속하기" 버튼
//   - 비로그인: localStorage 카트 그대로 표시 (cartStore 자동 분기)
//   - 로그인: 백엔드 fetchCart 호출로 최신화
//
// 디자인 톤: swagkey 라이트 (white + surface + textOnLight, 빨강 #ef4444 강조)

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, radius } from '../styles/tokens';

export default function CartPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const logged = isAuthenticated;

  // cartStore selectors
  const items = useCartStore((s) => s.getDisplayItems());
  const totalQuantity = useCartStore((s) => s.getTotalQuantity());
  const totalPrice = useCartStore((s) => s.getTotalPrice());
  const refreshFromServer = useCartStore((s) => s.refreshFromServer);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clear);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // ─── 마운트 시 로그인 사용자라면 최신 카트 fetch ────────────
  useEffect(() => {
    if (logged) {
      setLoading(true);
      refreshFromServer().finally(() => setLoading(false));
    }
  }, [logged, refreshFromServer]);

  // ─── Toast 표시 헬퍼 ─────────────────────────────────────
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  // ─── 액션 핸들러 ─────────────────────────────────────────
  async function handleDecrease(item) {
    const newQty = (item.quantity ?? 1) - 1;
    if (newQty < 1) {
      // 1 이하면 confirm 거쳐서 삭제 (silent 모드 X — 사용자 의도 확인)
      return handleRemove(item);
    }
    const result = await updateQuantity(item.itemId, item.productId, newQty);
    if (!result.ok) showToast(result.message || '수량 변경 실패');
  }

  async function handleIncrease(item) {
    const newQty = (item.quantity ?? 1) + 1;
    const result = await updateQuantity(item.itemId, item.productId, newQty);
    if (!result.ok) showToast(result.message || '수량 변경 실패');
  }

  async function handleRemove(item, silent = false) {
    if (!silent && !window.confirm(`${item.productName || item.name}\n장바구니에서 삭제하시겠습니까?`)) {
      return;
    }
    const result = await removeItem(item.itemId, item.productId);
    if (!result.ok) showToast(result.message || '삭제 실패');
  }

  async function handleClearAll() {
    if (!window.confirm('장바구니의 모든 상품을 삭제하시겠습니까?')) return;
    const result = await clearCart();
    if (result.ok) showToast('장바구니를 비웠습니다');
    else showToast(result.message || '비우기 실패');
  }

  function handleCheckout() {
    if (!logged) {
      // 비로그인은 결제 못 함 → 로그인 페이지로
      showToast('로그인이 필요합니다');
      setTimeout(() => navigate('/login?redirect=/cart'), 800);
      return;
    }
    if (items.length === 0) {
      showToast('장바구니가 비어있습니다');
      return;
    }
    // 5-E 주문 placeholder 페이지로
    navigate('/order');
  }

  // ─── 렌더 ────────────────────────────────────────────────
  const hasItems = items && items.length > 0;

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Breadcrumb */}
        <div style={S.crumb}>
          <Link to="/" style={S.crumbLink}>홈</Link>
          <span style={S.crumbSep}>›</span>
          <span style={S.crumbCurr}>장바구니</span>
        </div>

        {/* Title */}
        <h1 style={S.title}>
          장바구니
          {hasItems && (
            <span style={S.titleCount}>({totalQuantity})</span>
          )}
        </h1>

        {loading ? (
          <div style={S.loadingBox}>장바구니를 불러오는 중...</div>
        ) : !hasItems ? (
          <EmptyCart />
        ) : (
          <div style={S.body}>
            {/* 좌측: 아이템 리스트 */}
            <div style={S.leftCol}>
              <div style={S.leftHeader}>
                <span style={S.leftHeaderText}>상품 {items.length}개</span>
                <button onClick={handleClearAll} style={S.clearBtn}>
                  전체 삭제
                </button>
              </div>

              {items.map((item) => (
                <CartItemRow
                  key={item.itemId || item.productId}
                  item={item}
                  onDecrease={() => handleDecrease(item)}
                  onIncrease={() => handleIncrease(item)}
                  onRemove={() => handleRemove(item)}
                />
              ))}
            </div>

            {/* 우측: sticky 총액 박스 */}
            <aside style={S.rightCol}>
              <div style={S.summaryBox}>
                <h3 style={S.summaryTitle}>주문 요약</h3>

                <div style={S.summaryRow}>
                  <span style={S.summaryLabel}>상품 금액</span>
                  <span style={S.summaryValue}>
                    ₩{totalPrice.toLocaleString()}
                  </span>
                </div>

                <div style={S.summaryRow}>
                  <span style={S.summaryLabel}>배송비</span>
                  <span style={S.summaryValueFree}>무료</span>
                </div>

                <div style={S.summaryDivider} />

                <div style={S.summaryTotalRow}>
                  <span style={S.summaryTotalLabel}>총 결제 금액</span>
                  <span style={S.summaryTotalValue}>
                    ₩{totalPrice.toLocaleString()}
                  </span>
                </div>

                <button onClick={handleCheckout} style={S.checkoutBtn}>
                  주문하기 ({totalQuantity})
                </button>

                {!logged && (
                  <div style={S.loginHint}>
                    💡 로그인하면 카트가 서버에 저장됩니다
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={S.toast}>{toast}</div>
      )}
    </div>
  );
}

// ============================================================================
// 빈 카트
// ============================================================================
function EmptyCart() {
  return (
    <div style={S.emptyBox}>
      <div style={S.emptyIcon}>🛒</div>
      <h2 style={S.emptyTitle}>장바구니가 비어있습니다</h2>
      <p style={S.emptyDesc}>마음에 드는 키보드를 찾아보세요</p>
      <Link to="/" style={S.emptyBtn}>
        쇼핑 계속하기
      </Link>
    </div>
  );
}

// ============================================================================
// 카트 아이템 행
// ============================================================================

// 3D 빌더 옵션 id → 한글 표시 라벨 (KeyboardBuilder 옵션명과 일치)
const LAYOUT_LABEL = { '65': '65%', '75': '75%', TKL: 'TKL', FULL: '풀배열' };
const SWITCH_LABEL = { LINEAR: '리니어', TACTILE: '택타일', CLICKY: '클리키' };
const KEYCAP_LABEL = {
  original: '오리지널 키캡', white: '화이트 키캡', black: '블랙 키캡',
  gray: '스모크 키캡', navy: '네이비 키캡', red: '레트로 레드 키캡', mint: '민트 키캡',
};
const CASE_LABEL = {
  original: '오리지널 케이스', white: '화이트 케이스', silver: '실버 케이스',
  black: '블랙 케이스', beige: '베이지 케이스',
};

/** 카트 아이템의 커스텀 옵션을 표시용 라벨 배열로 (옵션 없으면 빈 배열). */
function buildOptionLabels(item) {
  const labels = [];
  if (item.layout) labels.push(LAYOUT_LABEL[item.layout] || item.layout);
  if (item.switchType) labels.push(SWITCH_LABEL[item.switchType] || item.switchType);
  if (item.keycapColor) labels.push(KEYCAP_LABEL[item.keycapColor] || item.keycapColor);
  if (item.caseColor) labels.push(CASE_LABEL[item.caseColor] || item.caseColor);
  return labels;
}

function CartItemRow({ item, onDecrease, onIncrease, onRemove }) {
  const name = item.productName || item.name || '상품명 없음';
  const brand = item.brandName;
  const price = item.price ?? 0;
  const quantity = item.quantity ?? 1;
  const subtotal = item.subtotal ?? (price * quantity);
  const thumb = item.thumbnailUrl || item.imageUrl;

  // 3D 빌더 커스텀 옵션 배지 (일반 상품은 옵션이 없어 표시 안 됨)
  const optionLabels = buildOptionLabels(item);

  // ─── 3블록 flex 구조 ─────────────────────────────────────
  //   [썸네일(고정)] [정보(flex, minWidth:0 → ellipsis)] [우측 컨트롤(고정, shrink:0)]
  //   제품명이 길어도 정보 블록만 줄어들고, 우측(수량/소계/삭제)은 절대 침범당하지 않음.
  return (
    <div style={S.itemRow}>
      {/* 썸네일 (고정폭) */}
      <Link to={`/products/${item.productId}`} style={S.itemThumbLink}>
        {thumb ? (
          <img src={thumb} alt={name} style={S.itemThumb} />
        ) : (
          <div style={S.itemThumbEmpty}>📦</div>
        )}
      </Link>

      {/* 정보 (가변폭, minWidth:0 으로 grid/flex blowout 차단) */}
      <div style={S.itemInfo}>
        {brand && <div style={S.itemBrand}>{brand}</div>}
        <Link to={`/products/${item.productId}`} style={S.itemNameLink}>
          <div style={S.itemName}>{name}</div>
        </Link>
        {optionLabels.length > 0 && (
          <div style={S.itemOptions}>
            {optionLabels.map((opt) => (
              <span key={opt} style={S.itemOptionBadge}>{opt}</span>
            ))}
          </div>
        )}
        <div style={S.itemPrice}>₩{price.toLocaleString()}</div>
      </div>

      {/* 우측 컨트롤 묶음 (고정폭, flex-shrink:0) */}
      <div style={S.itemControls}>
        {/* 수량 컨트롤 */}
        <div style={S.qtyControl}>
          <button onClick={onDecrease} style={S.qtyBtn} aria-label="감소">−</button>
          <span style={S.qtyValue}>{quantity}</span>
          <button onClick={onIncrease} style={S.qtyBtn} aria-label="증가">+</button>
        </div>

        {/* 소계 */}
        <div style={S.itemSubtotal}>
          ₩{subtotal.toLocaleString()}
        </div>

        {/* 삭제 */}
        <button onClick={onRemove} style={S.removeBtn} aria-label="삭제">
          ✕
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 스타일
// ============================================================================
const S = {
  page: {
    background: colors.surface,
    minHeight: '100vh',
    paddingTop: 24,
    paddingBottom: 80,
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
  },

  // Breadcrumb
  crumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: colors.textOnLightDim,
    marginBottom: 16,
  },
  crumbLink: { color: colors.textOnLightDim, textDecoration: 'none' },
  crumbSep: { color: colors.textOnLightDim, fontSize: 14 },
  crumbCurr: { color: colors.textOnLight, fontWeight: 500 },

  // Title
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: colors.textOnLight,
    marginBottom: 28,
    letterSpacing: '-0.02em',
  },
  titleCount: {
    fontSize: 22,
    fontWeight: 500,
    color: colors.textOnLightDim,
    marginLeft: 10,
  },

  loadingBox: {
    background: colors.white,
    padding: 60,
    textAlign: 'center',
    color: colors.textOnLightDim,
    borderRadius: 12,
  },

  // Body grid
  body: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: 24,
    alignItems: 'start',
  },

  // 좌측
  leftCol: {
    background: colors.white,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  leftHeader: {
    padding: '18px 24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftHeaderText: {
    fontSize: 14,
    color: colors.textOnLightDim,
    fontWeight: 500,
  },
  clearBtn: {
    background: 'transparent',
    border: 'none',
    color: colors.textOnLightDim,
    fontSize: 13,
    cursor: 'pointer',
    padding: '4px 8px',
    textDecoration: 'underline',
  },

  // 아이템 행 — flex 3블록 (썸네일 / 정보 / 우측 컨트롤). grid 음수폭 blowout 방지.
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '20px 24px',
    borderBottom: '1px solid #f3f4f6',
  },
  itemThumbLink: { display: 'block', textDecoration: 'none', flexShrink: 0 },
  itemThumb: {
    width: 88,
    height: 88,
    objectFit: 'cover',
    borderRadius: 8,
    border: '1px solid #f3f4f6',
    background: '#fff',
  },
  itemThumbEmpty: {
    width: 88,
    height: 88,
    background: colors.surfaceMuted,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,            // ← 핵심: 긴 제품명이 우측 컨트롤을 밀지 않도록 ellipsis 허용
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  itemNameLink: { textDecoration: 'none', color: 'inherit', minWidth: 0 },
  itemName: {
    fontSize: 15,
    fontWeight: 600,
    color: colors.textOnLight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.4,
    wordBreak: 'break-all',
  },
  itemOptions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  itemOptionBadge: {
    fontSize: 11,
    fontWeight: 500,
    color: '#4A42B0',
    background: 'rgba(74,66,176,0.08)',
    border: '1px solid rgba(74,66,176,0.2)',
    borderRadius: 5,
    padding: '2px 7px',
    whiteSpace: 'nowrap',
  },
  itemBrand: {
    fontSize: 12,
    color: colors.textOnLightDim,
  },
  itemPrice: {
    fontSize: 13,
    color: colors.textOnLightDim,
    marginTop: 4,
  },

  // 우측 컨트롤 묶음 — 고정폭, 절대 줄어들지 않음
  itemControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexShrink: 0,
  },

  // 수량 컨트롤
  qtyControl: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    overflow: 'hidden',
    background: '#fff',
    flexShrink: 0,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    fontWeight: 500,
    color: colors.textOnLight,
    transition: 'background 0.12s',
    flexShrink: 0,
  },
  qtyValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 600,
    color: colors.textOnLight,
    fontVariantNumeric: 'tabular-nums',
    borderLeft: '1px solid #e5e7eb',
    borderRight: '1px solid #e5e7eb',
    padding: '8px 4px',
  },

  // 소계
  itemSubtotal: {
    width: 110,
    fontSize: 16,
    fontWeight: 700,
    color: colors.textOnLight,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },

  // 삭제
  removeBtn: {
    width: 32,
    height: 32,
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: 16,
    cursor: 'pointer',
    borderRadius: 16,
    transition: 'all 0.12s',
    flexShrink: 0,
  },

  // 우측 sticky 총액
  rightCol: {
    position: 'sticky',
    top: 24,
  },
  summaryBox: {
    background: colors.white,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: colors.textOnLight,
    marginBottom: 18,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    fontSize: 14,
  },
  summaryLabel: { color: colors.textOnLightDim },
  summaryValue: {
    color: colors.textOnLight,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  summaryValueFree: {
    color: '#10b981',
    fontWeight: 600,
  },
  summaryDivider: {
    height: 1,
    background: '#e5e7eb',
    margin: '12px 0',
  },
  summaryTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0 20px',
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: colors.textOnLight,
  },
  summaryTotalValue: {
    fontSize: 22,
    fontWeight: 800,
    color: '#ef4444',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.01em',
  },

  checkoutBtn: {
    width: '100%',
    padding: '14px',
    background: colors.textOnLight,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.12s',
  },
  loginHint: {
    marginTop: 14,
    padding: '10px 12px',
    background: colors.surfaceMuted,
    borderRadius: 6,
    fontSize: 12,
    color: colors.textOnLightDim,
    textAlign: 'center',
  },

  // 빈 카트
  emptyBox: {
    background: colors.white,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: '80px 24px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.7,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.textOnLight,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textOnLightDim,
    marginBottom: 28,
  },
  emptyBtn: {
    display: 'inline-block',
    padding: '12px 28px',
    background: colors.textOnLight,
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
  },

  // Toast
  toast: {
    position: 'fixed',
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(15, 23, 42, 0.92)',
    color: '#fff',
    padding: '12px 22px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  },
};
