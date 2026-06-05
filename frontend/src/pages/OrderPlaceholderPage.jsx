// frontend/src/pages/OrderPlaceholderPage.jsx
// PortOne V2 결제 연동 (6/5) — 주문/결제 페이지.
//
// 도메인 흐름:
//   진입: CartPage "주문하기" → /order  또는  상품상세/3D빌더 "바로구매" → /order?type=direct&...
//   ① 배송지 입력 (DaumPostcode) → ② "결제하기"
//   → preparePayment* (서버: PENDING 주문 + paymentId 발급, 재고 미차감)
//   → PortOne.requestPayment (결제창 팝업, 실제 결제)
//   → completePayment (서버: PortOne 단건조회 금액검증 → 재고차감 + PAID)
//   → 마이페이지(주문완료)
//
// 보존 (이전 mock 버전에서 그대로):
//   - direct/cart 다형 처리 (?type=direct 분기, 표시 데이터 통합)
//   - 비로그인/빈카트 가드, 즉시구매 상품 서버 재조회 + 표시단가 계산
//   - OrderItemRow, 결제 요약 UI, swagkey 라이트 톤 스타일
//
// 교체 (PortOne 연동):
//   - mock 안내 배너 제거
//   - 배송지: placeholder 문구 → 실제 입력 폼 (이름/연락처/우편번호/주소/상세 + Daum 검색)
//   - 결제 수단: placeholder 문구 → 안내(결제창에서 선택)
//   - 결제 버튼: "결제하기 (mock)" → "결제하기", window.confirm 제거
//   - 금액은 서버가 prepare 에서 산출/저장하고 complete 에서 PG 원본과 재대조(프론트 금액 불신).

import { useEffect, useState } from 'react';
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import * as PortOne from '@portone/browser-sdk/v2';
import { useCartStore } from '../stores/cartStore';
import { useAuth } from '../hooks/useAuth';
import { preparePaymentCart, preparePaymentDirect, completePayment } from '../api/order';
import { apiClient } from '../api/client';
import userApi from '../api/user';
import DaumPostcode from '../components/DaumPostcode';
import { colors, spacing, radius } from '../styles/tokens';

export default function OrderPlaceholderPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();

  // ─── 주문 출처 판별 (다형 처리) ──────────────────────
  //   ?type=direct → 즉시구매: URL 의 productId/qty/옵션으로 단건 주문 (장바구니 미경유).
  //   그 외(기본)  → 장바구니 주문: cartStore 의 담긴 품목으로 주문.
  const isDirect = searchParams.get('type') === 'direct';
  const directProductId = searchParams.get('productId');
  const directQty = Math.max(1, parseInt(searchParams.get('qty') || '1', 10) || 1);
  const directOpts = {
    layout: searchParams.get('layout') || null,
    switchType: searchParams.get('switchType') || null,
    keycapColor: searchParams.get('keycapColor') || null,
    caseColor: searchParams.get('caseColor') || null,
  };

  // 장바구니 데이터 (cart 경로에서만 사용)
  const cartItems = useCartStore((s) => s.getDisplayItems());
  const cartTotalQuantity = useCartStore((s) => s.getTotalQuantity());
  const cartTotalPrice = useCartStore((s) => s.getTotalPrice());
  const clearCart = useCartStore((s) => s.clear);

  // 즉시구매 단건 상품 (direct 경로에서만 — productId 로 서버 재조회해 표시용 데이터 구성)
  const [directItem, setDirectItem] = useState(null);
  const [directLoading, setDirectLoading] = useState(isDirect);
  const [directError, setDirectError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // ─── 배송지 입력 폼 ──────────────────────────────────
  //   ProfileEditPage 와 동일하게 userApi.getMe 로 저장된 주소를 prefill, 사용자가 수정 가능.
  //   DaumPostcode 컴포넌트(open/onClose/onComplete) 재사용.
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [postOpen, setPostOpen] = useState(false);
  const [shipError, setShipError] = useState('');

  // 즉시구매: 상품 정보를 서버에서 조회 (가격/이름/이미지는 표시용 — 실제 금액은 결제 시 서버 재계산).
  useEffect(() => {
    if (!isDirect || !directProductId) return;
    let alive = true;
    setDirectLoading(true);
    setDirectError(null);
    apiClient.get(`/products/${directProductId}`)
      .then((res) => {
        if (!alive) return;
        const p = res.data;
        const unitPrice = calcDisplayUnitPrice(p, directOpts);
        setDirectItem({
          productId: p.id,
          productName: p.name,
          brandName: p.brandName,
          imageUrl: p.imageUrl,
          price: unitPrice,
          quantity: directQty,
          subtotal: unitPrice * directQty,
          layout: directOpts.layout,
          switchType: directOpts.switchType,
          keycapColor: directOpts.keycapColor,
          caseColor: directOpts.caseColor,
        });
      })
      .catch((err) => {
        if (!alive) return;
        console.error('direct product load error:', err);
        setDirectError(err?.response?.data?.message || '상품 정보를 불러오지 못했습니다.');
      })
      .finally(() => { if (alive) setDirectLoading(false); });
    return () => { alive = false; };
  }, [isDirect, directProductId, directQty,
      directOpts.layout, directOpts.switchType, directOpts.keycapColor, directOpts.caseColor]);

  // 배송지 prefill — 저장된 회원 주소/연락처/이름을 기본값으로 채운다(수정 가능).
  useEffect(() => {
    let alive = true;
    userApi.getMe()
      .then((me) => {
        if (!alive) return;
        setReceiverName((prev) => prev || me.name || '');
        setReceiverPhone((prev) => prev || me.phone || '');
        setPostcode((prev) => prev || me.zipcode || '');
        setAddress((prev) => prev || me.address || '');
        setAddressDetail((prev) => prev || me.addressDetail || '');
      })
      .catch(() => { /* prefill 실패는 무시 — 사용자가 직접 입력 */ });
    return () => { alive = false; };
  }, []);

  // ─── 표시 데이터 통합 (direct/cart 공통 렌더용) ──────
  const items = isDirect ? (directItem ? [directItem] : []) : cartItems;
  const totalQuantity = isDirect ? (directItem ? directItem.quantity : 0) : cartTotalQuantity;
  const totalPrice = isDirect ? (directItem ? directItem.subtotal : 0) : cartTotalPrice;

  // ─── 가드: 비로그인이면 로그인으로 ────────────────────
  if (!isAuthenticated) {
    const redirect = isDirect
      ? `/order?type=direct&productId=${directProductId}&qty=${directQty}`
      : '/order';
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  // ─── 가드: 장바구니 경로에서 카트 비어있으면 카트로 ──
  if (!isDirect && (!cartItems || cartItems.length === 0) && !submitting) {
    return <Navigate to="/cart" replace />;
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // 배송지 필수값 검증 — 빈 값이면 결제 진행 차단.
  function validateShipping() {
    if (!receiverName.trim()) return '받는 분 이름을 입력해 주세요.';
    if (!receiverPhone.trim()) return '연락처를 입력해 주세요.';
    if (!postcode.trim() || !address.trim()) return '주소를 검색해 주세요.';
    if (!addressDetail.trim()) return '상세 주소를 입력해 주세요.';
    return '';
  }

  // ─── 결제 (prepare → PortOne 결제창 → complete) ──────
  //   1) prepare: 서버가 PENDING 주문 + paymentId 발급(재고 미차감). storeId/channelKey 수령.
  //   2) PortOne.requestPayment: 결제창 팝업. 결제수단은 여기서 선택. 결과로 code/message(실패) 반환.
  //   3) complete: 서버가 PortOne 단건조회로 금액검증 → 재고차감 + PAID. 실패 시 400(주문 CANCELLED).
  //   금액은 프론트가 정하지 않는다 — prepare 응답의 amount(서버 산출)를 결제창에 넘기고,
  //   complete 에서 서버가 PG 원본과 DB 금액을 재대조한다(위변조 차단).
  async function handlePayment() {
    if (submitting) return;

    const shipErr = validateShipping();
    if (shipErr) {
      setShipError(shipErr);
      showToast(shipErr);
      return;
    }
    setShipError('');

    const shipping = {
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      postcode: postcode.trim(),
      address: address.trim(),
      addressDetail: addressDetail.trim(),
    };

    setSubmitting(true);
    try {
      // 1) 결제 준비 — PENDING 주문 생성 + paymentId 발급
      const prep = isDirect
        ? await preparePaymentDirect({
            productId: directItem.productId,
            quantity: directItem.quantity,
            layout: directItem.layout,
            switchType: directItem.switchType,
            keycapColor: directItem.keycapColor,
            caseColor: directItem.caseColor,
            shipping,
          })
        : await preparePaymentCart(shipping);

      // 2) PortOne 결제창 — storeId/channelKey/paymentId 는 서버 prepare 응답 값 사용.
      //    currency 는 V2 SDK 표준 enum "CURRENCY_KRW".
      const payResponse = await PortOne.requestPayment({
        storeId: prep.storeId,
        channelKey: prep.channelKey,
        paymentId: prep.paymentId,
        orderName: prep.orderName,
        totalAmount: prep.amount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        customer: {
          fullName: shipping.receiverName,
          phoneNumber: shipping.receiverPhone,
          email: user?.email || undefined,
        },
      });

      // 결제창에서 실패/취소 시 code 가 채워져 온다(성공이면 code 없음).
      if (payResponse?.code != null) {
        console.warn('PortOne payment failed:', payResponse);
        showToast(payResponse.message || '결제가 취소되었거나 실패했습니다.');
        setSubmitting(false);
        return;
      }

      // 3) 결제 완료 검증 — 서버가 PortOne 단건조회로 금액 대조 후 PAID 확정.
      const order = await completePayment(prep.paymentId);

      showToast(`결제가 완료되었습니다 (주문번호 ${order?.id ?? '-'})`);

      // 장바구니 결제였다면 비우기(서버에서도 비웠지만 클라 상태도 동기화) 후 마이페이지로.
      setTimeout(async () => {
        if (!isDirect) {
          try { await clearCart(); } catch (e) { console.warn('clearCart after order:', e); }
        }
        navigate('/mypage', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('payment error:', err);
      const msg = err?.response?.data?.message || '결제 처리에 실패했습니다. 다시 시도해 주세요.';
      showToast(msg);
      setSubmitting(false);
    }
  }

  // ─── 즉시구매 로딩/에러 가드 ─────────────────────────
  if (isDirect && directLoading) {
    return (
      <div style={S.page}>
        <div style={{ ...S.container, textAlign: 'center', paddingTop: 80 }}>
          <p style={{ color: colors.textOnLight }}>상품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }
  if (isDirect && (directError || !directItem)) {
    return (
      <div style={S.page}>
        <div style={{ ...S.container, textAlign: 'center', paddingTop: 80 }}>
          <p style={{ color: colors.textOnLight, marginBottom: spacing.md }}>
            {directError || '주문할 상품을 찾을 수 없습니다.'}
          </p>
          <Link to="/products" style={S.backLink}>← 쇼핑 계속하기</Link>
        </div>
      </div>
    );
  }

  // ─── 렌더 ────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Breadcrumb */}
        <div style={S.crumb}>
          <Link to="/" style={S.crumbLink}>홈</Link>
          <span style={S.crumbSep}>›</span>
          {isDirect ? (
            <Link to={`/products/${directProductId}`} style={S.crumbLink}>상품</Link>
          ) : (
            <Link to="/cart" style={S.crumbLink}>장바구니</Link>
          )}
          <span style={S.crumbSep}>›</span>
          <span style={S.crumbCurr}>주문/결제</span>
        </div>

        <h1 style={S.title}>{isDirect ? '바로 구매' : '주문/결제'}</h1>

        <div style={S.body}>
          {/* 좌측: 주문 상품 + 배송지 입력 */}
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

            {/* 배송지 입력 폼 (DaumPostcode) */}
            <div style={S.section}>
              <h3 style={S.sectionTitle}>배송지 정보</h3>

              <label style={S.formLabel}>받는 분</label>
              <input
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="받는 분 이름"
                maxLength={100}
                style={S.input}
              />

              <label style={S.formLabel}>연락처</label>
              <input
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                placeholder="010-0000-0000"
                maxLength={30}
                style={S.input}
              />

              <label style={S.formLabel}>우편번호</label>
              <div style={S.zipRow}>
                <input
                  value={postcode}
                  readOnly
                  placeholder="우편번호"
                  style={{ ...S.input, ...S.readonly, flex: '0 0 140px', marginBottom: 0 }}
                />
                <button type="button" onClick={() => setPostOpen(true)} style={S.searchBtn}>
                  주소 검색
                </button>
              </div>

              <label style={S.formLabel}>기본 주소</label>
              <input
                value={address}
                readOnly
                placeholder="주소 검색 후 자동 입력"
                style={{ ...S.input, ...S.readonly }}
              />

              <label style={S.formLabel}>상세 주소</label>
              <input
                value={addressDetail}
                onChange={(e) => setAddressDetail(e.target.value)}
                placeholder="동/호수/층 등 상세 주소"
                maxLength={255}
                style={S.input}
              />

              {shipError && <div style={S.inlineError}>{shipError}</div>}
            </div>

            {/* 결제 수단 안내 */}
            <div style={S.section}>
              <h3 style={S.sectionTitle}>결제 수단</h3>
              <p style={S.payMethodNote}>
                다음 단계의 결제창에서 카드 등 결제 수단을 선택합니다.
              </p>
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
                onClick={handlePayment}
                disabled={submitting}
                style={{ ...S.submitBtn, opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? '결제 처리 중...' : '결제하기'}
              </button>

              {isDirect ? (
                <Link to={`/products/${directProductId}`} style={S.backLink}>← 상품으로 돌아가기</Link>
              ) : (
                <Link to="/cart" style={S.backLink}>← 장바구니로 돌아가기</Link>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Daum 우편번호 레이어 */}
      <DaumPostcode
        open={postOpen}
        onClose={() => setPostOpen(false)}
        onComplete={({ zipcode: z, address: a }) => {
          setPostcode(z);
          setAddress(a);
          setPostOpen(false);
        }}
      />

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

// ============================================================================
// 주문 상품 행
// ============================================================================

// 3D 빌더 옵션 id → 한글 표시 라벨 (KeyboardBuilder / CartPage 와 일치)
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

// 즉시구매 표시 단가 계산 (서버 BuilderPriceCalculator 와 동일 규칙).
//   주의: 이 값은 화면 표시용일 뿐, 실제 결제 금액은 서버가 결제 시점에 다시 계산한다
//   (위변조 차단의 단일 진실은 서버). 옵션이 없으면 product.price 를 그대로 쓴다.
const DISPLAY_SWITCH_PRICE = { LINEAR: 25000, TACTILE: 28000, CLICKY: 30000 };
const DISPLAY_KEYCAP_PRICE = {
  original: 0, white: 35000, black: 35000, gray: 38000, navy: 38000, red: 42000, mint: 42000,
};
function calcDisplayUnitPrice(product, opts) {
  const hasOption = opts.layout || opts.switchType || opts.keycapColor;
  if (!hasOption) {
    return product.price != null ? product.price : 0;
  }
  const base = product.price != null ? product.price : 0;
  const sw = opts.switchType ? (DISPLAY_SWITCH_PRICE[opts.switchType] || 0) : 0;
  const kc = opts.keycapColor ? (DISPLAY_KEYCAP_PRICE[opts.keycapColor] || 0) : 0;
  return base + sw + kc;
}

function buildOptionLabels(item) {
  const labels = [];
  if (item.layout) labels.push(LAYOUT_LABEL[item.layout] || item.layout);
  if (item.switchType) labels.push(SWITCH_LABEL[item.switchType] || item.switchType);
  if (item.keycapColor) labels.push(KEYCAP_LABEL[item.keycapColor] || item.keycapColor);
  if (item.caseColor) labels.push(CASE_LABEL[item.caseColor] || item.caseColor);
  return labels;
}

function OrderItemRow({ item }) {
  const name = item.productName || item.name || '상품명 없음';
  const brand = item.brandName;
  const price = item.price ?? 0;
  const quantity = item.quantity ?? 1;
  const subtotal = item.subtotal ?? (price * quantity);
  const thumb = item.thumbnailUrl || item.imageUrl;
  const optionLabels = buildOptionLabels(item);

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
        {optionLabels.length > 0 && (
          <div style={S.orderItemOptions}>
            {optionLabels.map((opt) => (
              <span key={opt} style={S.orderItemOptionBadge}>{opt}</span>
            ))}
          </div>
        )}
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
    paddingTop: 0,
    paddingRight: 24,
    paddingBottom: 0,
    paddingLeft: 24,
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
  orderItemOptions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 3,
  },
  orderItemOptionBadge: {
    fontSize: 11,
    fontWeight: 500,
    color: '#4A42B0',
    background: 'rgba(74,66,176,0.08)',
    border: '1px solid rgba(74,66,176,0.2)',
    borderRadius: 5,
    padding: '2px 7px',
    whiteSpace: 'nowrap',
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

  // 주문자 정보 행
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

  // 배송지 입력 폼
  formLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: colors.textOnLight,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    color: colors.textOnLight,
    background: colors.white,
    marginBottom: 4,
  },
  readonly: {
    background: colors.surfaceMuted,
    color: colors.textOnLightDim,
    cursor: 'not-allowed',
  },
  zipRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  searchBtn: {
    flex: 1,
    padding: '10px 12px',
    background: colors.white,
    border: `1px solid ${colors.textOnLight}`,
    borderRadius: 8,
    color: colors.textOnLight,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  inlineError: {
    marginTop: 10,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    fontSize: 13,
    padding: '8px 12px',
    borderRadius: 8,
  },
  payMethodNote: {
    fontSize: 13,
    color: colors.textOnLightDim,
    lineHeight: 1.5,
    margin: 0,
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
