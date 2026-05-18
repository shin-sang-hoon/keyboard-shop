// frontend/src/pages/OrderPlaceholderPage.jsx
// Phase 8 5-D Round 3 (2026-05-19) — 주문 placeholder 페이지.
//
// 도메인 흐름:
//   CartPage 의 "주문하기" CTA → /order → 주문 요약 표시 → "주문 완료 (mock)" → clearCart() → / 메인
//
// Phase 8 (배포) 시 본격 구현 예정:
//   - 토스 페이먼츠 / 아임포트 등 PG 사 연동
//   - 배송지 입력 폼 (Daum 우편번호 API)
//   - 주문 내역 DB 저장 (orders + order_items)
//   - 결제 검증 webhook
//
// 현재 구현 범위 (mock):
//   - Cart 비어있으면 /cart 리다이렉트 (가드)
//   - 주문 요약 표시 (CartPage 의 데이터 그대로 활용)
//   - "주문 완료" 클릭 → clearCart() + Toast + / 이동
//   - swagkey 라이트 톤 통일

import { useEffect, useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, radius } from '../styles/tokens';

export default function OrderPlaceholderPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const items = useCartStore((s) => s.getDisplayItems());
  const totalQuantity = useCartStore((s) => s.getTotalQuantity());
  const totalPrice = useCartStore((s) => s.getTotalPrice());
  const clearCart = useCartStore((s) => s.clear);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // ─── 가드: 비로그인이면 로그인으로 ────────────────────
  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/order" replace />;
  }

  // ─── 가드: 카트 비어있으면 카트 페이지로 ────────────
  // submitting 중이면 우회 — clearCart() 직후 unmount 방지 (Toast 표시 보장)
  if ((!items || items.length === 0) && !submitting) {
    return <Navigate to="/cart" replace />;
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // ─── 주문 완료 (mock) ─────────────────────────────────
  async function handleSubmitOrder() {
    if (submitting) return;
    if (!window.confirm(
      `총 ${totalQuantity}개 / ₩${totalPrice.toLocaleString()} 결제하시겠습니까?\n\n` +
      `(이번 단계는 mock 동작 - 실제 결제는 Phase 8 배포 단계에서 도입 예정)`
    )) return;

    setSubmitting(true);
    try {
      // mock latency (실제론 백엔드 /api/orders POST + PG 결제)
      await new Promise((r) => setTimeout(r, 600));

      // Toast 먼저 띄움 - 화면이 마지막까지 정상 상태로 유지
      showToast('주문이 완료되었습니다 (mock)');

      // 2.5초 후 clearCart + navigate (Toast 충분히 표시 후)
      setTimeout(async () => {
        try {
          await clearCart();
        } catch (e) {
          console.warn('clearCart after order:', e);
        }
        navigate('/', { replace: true });
      }, 2500);
    } catch (err) {
      console.error('Order mock error:', err);
      showToast('주문 처리 실패');
      setSubmitting(false);
    }
  }

  // ─── 렌더 ────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Breadcrumb */}
        <div style={S.crumb}>
          <Link to="/" style={S.crumbLink}>홈</Link>
          <span style={S.crumbSep}>›</span>
          <Link to="/cart" style={S.crumbLink}>장바구니</Link>
          <span style={S.crumbSep}>›</span>
          <span style={S.crumbCurr}>주문/결제</span>
        </div>

        <h1 style={S.title}>주문/결제</h1>

        {/* mock 안내 배너 */}
        <div style={S.mockBanner}>
          <strong style={S.mockBannerTitle}>⚠️ Mock 동작</strong>
          <div style={S.mockBannerDesc}>
            이 페이지는 도메인 흐름 시연용 — 실제 결제 (토스 페이먼츠 / 아임포트) 연동은
            <strong> Phase 8 배포 단계</strong>에서 도입 예정.
          </div>
        </div>

        <div style={S.body}>
          {/* 좌측: 주문 상품 */}
          <div style={S.leftCol}>
            <div style={S.section}>
              <h3 style={S.sectionTitle}>주문 상품 ({items.length})</h3>
              {items.map((item) => (
                <OrderItemRow key={item.itemId || item.productId} item={item} />
              ))}
            </div>

            <div style={S.section}>
              <h3 style={S.sectionTitle}>주문자 정보</h3>
              <div style={S.fieldRow}>
                <span style={S.fieldLabel}>이름</span>
                <span style={S.fieldValue}>{user?.name || '-'}</span>
              </div>
              <div style={S.fieldRow}>
                <span style={S.fieldLabel}>이메일</span>
                <span style={S.fieldValue}>{user?.email || '-'}</span>
              </div>
            </div>

            <div style={S.section}>
              <h3 style={S.sectionTitle}>배송지 정보</h3>
              <div style={S.fieldRow}>
                <span style={S.fieldLabel}>주소</span>
                <span style={S.fieldValuePlaceholder}>
                  Phase 8에서 Daum 우편번호 API 연동 예정
                </span>
              </div>
            </div>

            <div style={S.section}>
              <h3 style={S.sectionTitle}>결제 수단</h3>
              <div style={S.fieldRow}>
                <span style={S.fieldLabel}>방법</span>
                <span style={S.fieldValuePlaceholder}>
                  Phase 8에서 토스 페이먼츠 / 아임포트 연동 예정
                </span>
              </div>
            </div>
          </div>

          {/* 우측: sticky 결제 요약 */}
          <aside style={S.rightCol}>
            <div style={S.summaryBox}>
              <h3 style={S.summaryTitle}>결제 요약</h3>

              <div style={S.summaryRow}>
                <span style={S.summaryLabel}>상품 금액</span>
                <span style={S.summaryValue}>₩{totalPrice.toLocaleString()}</span>
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

              <button
                onClick={handleSubmitOrder}
                disabled={submitting}
                style={{ ...S.submitBtn, opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? '처리 중...' : `결제하기 (mock)`}
              </button>

              <Link to="/cart" style={S.backLink}>← 장바구니로 돌아가기</Link>
            </div>
          </aside>
        </div>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

// ============================================================================
// 주문 상품 행
// ============================================================================
function OrderItemRow({ item }) {
  const name = item.productName || item.name || '상품명 없음';
  const brand = item.brandName;
  const price = item.price ?? 0;
  const quantity = item.quantity ?? 1;
  const subtotal = item.subtotal ?? (price * quantity);
  const thumb = item.thumbnailUrl || item.imageUrl;

  return (
    <div style={S.orderItemRow}>
      {thumb ? (
        <img src={thumb} alt={name} style={S.orderItemThumb} />
      ) : (
        <div style={S.orderItemThumbEmpty}>📦</div>
      )}
      <div style={S.orderItemInfo}>
        <div style={S.orderItemName}>{name}</div>
        {brand && <div style={S.orderItemBrand}>{brand}</div>}
        <div style={S.orderItemMeta}>
          ₩{price.toLocaleString()} × {quantity}
        </div>
      </div>
      <div style={S.orderItemSubtotal}>
        ₩{subtotal.toLocaleString()}
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

  title: {
    fontSize: 28,
    fontWeight: 700,
    color: colors.textOnLight,
    marginBottom: 20,
    letterSpacing: '-0.02em',
  },

  // Mock 안내 배너
  mockBanner: {
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderLeft: '3px solid #f59e0b',
    borderRadius: 8,
    padding: '14px 18px',
    marginBottom: 24,
  },
  mockBannerTitle: {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    color: '#92400e',
    marginBottom: 4,
  },
  mockBannerDesc: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 1.5,
  },

  body: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: 24,
    alignItems: 'start',
  },

  // 좌측 컬럼
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  section: {
    background: colors.white,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: colors.textOnLight,
    marginBottom: 14,
  },

  // 주문 상품 행
  orderItemRow: {
    display: 'grid',
    gridTemplateColumns: '72px 1fr auto',
    alignItems: 'center',
    gap: 14,
    padding: '12px 0',
    borderTop: '1px solid #f3f4f6',
  },
  orderItemThumb: {
    width: 72,
    height: 72,
    objectFit: 'cover',
    borderRadius: 6,
    border: '1px solid #f3f4f6',
  },
  orderItemThumbEmpty: {
    width: 72,
    height: 72,
    background: colors.surfaceMuted,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
  },
  orderItemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.textOnLight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.4,
  },
  orderItemBrand: {
    fontSize: 12,
    color: colors.textOnLightDim,
  },
  orderItemMeta: {
    fontSize: 12,
    color: colors.textOnLightDim,
    marginTop: 2,
  },
  orderItemSubtotal: {
    fontSize: 15,
    fontWeight: 700,
    color: colors.textOnLight,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
  },

  // 주문자 / 배송지 / 결제 정보 행
  fieldRow: {
    display: 'flex',
    gap: 16,
    padding: '8px 0',
    fontSize: 14,
    lineHeight: 1.5,
  },
  fieldLabel: {
    minWidth: 70,
    color: colors.textOnLightDim,
    fontSize: 13,
  },
  fieldValue: {
    color: colors.textOnLight,
    fontWeight: 500,
  },
  fieldValuePlaceholder: {
    color: colors.textOnLightDim,
    fontStyle: 'italic',
    fontSize: 13,
  },

  // 우측 sticky 결제 요약
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
  summaryValueFree: { color: '#10b981', fontWeight: 600 },
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

  submitBtn: {
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
  backLink: {
    display: 'block',
    textAlign: 'center',
    marginTop: 12,
    padding: '8px',
    color: colors.textOnLightDim,
    textDecoration: 'none',
    fontSize: 13,
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
