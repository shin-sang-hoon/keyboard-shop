import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * 상품 상세 4-tab 네비게이션 (5-H C1-b).
 *
 * Swagkey 패턴:
 *   - 4 탭: 상세정보 / 구매평 (N) / Q&A (N) / 반품·교환
 *   - URL 쿼리로 활성 탭 동기화 (?tab=reviews)
 *   - sticky nav — 스크롤 시 상단 고정
 *   - 활성 탭 underline + 글자 진하게
 *   - 카운트 배지 (B1 응답의 reviewCount, qnaCount)
 *
 * Props:
 *   - product: ProductDto.Response (reviewCount, qnaCount 사용)
 *   - productId: 자식 탭 컴포넌트에 전달용
 *
 * 탭 컨텐츠는 일단 placeholder.
 * C1-c 에서:
 *   - 구매평 탭 → RatingDistributionChart + 리뷰 리스트 lazy load
 *   - Q&A 탭 → B3 미완성 시 placeholder, 완성 후 QnA 리스트
 *   - 반품·교환 → 정적 텍스트 (정책)
 *
 * 면접 포인트:
 *   - useSearchParams 로 URL ↔ state 동기화 (새로고침/뒤로가기 시 탭 유지)
 *   - replace:true 로 history 오염 방지 (브라우저 뒤로가기 자연스럽게)
 *   - sticky positioning (z-index, top, 배경/테두리)
 *   - role='tablist' / 'tab' / 'tabpanel' 접근성 트리
 */

const TABS = [
  { key: 'detail',  label: '상세정보',   getCount: () => null },
  { key: 'reviews', label: '구매평',     getCount: (p) => p?.reviewCount ?? 0 },
  { key: 'qna',     label: 'Q&A',        getCount: (p) => p?.qnaCount ?? 0 },
  { key: 'refund',  label: '반품·교환',  getCount: () => null },
];

const VALID_KEYS = new Set(TABS.map((t) => t.key));

export default function ProductTabs({ product, productId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabsRef = useRef(null);

  // ─── 활성 탭 결정 (URL 쿼리 우선, invalid 면 detail) ──────────────────
  const rawTab = searchParams.get('tab');
  const activeTab = VALID_KEYS.has(rawTab) ? rawTab : 'detail';

  // ─── 탭 클릭 핸들러 ────────────────────────────────────────────────────
  function handleTabClick(key) {
    if (key === activeTab) return;

    const next = new URLSearchParams(searchParams);
    if (key === 'detail') {
      next.delete('tab'); // 기본 탭은 URL 비우기 (cleaner)
    } else {
      next.set('tab', key);
    }
    setSearchParams(next, { replace: true });
  }

  // ─── 키보드 ←/→ 로 탭 이동 (focus 된 상태에서) ────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if (!tabsRef.current?.contains(document.activeElement)) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = TABS.findIndex((t) => t.key === activeTab);
        const delta = e.key === 'ArrowLeft' ? -1 : 1;
        const nextIdx = (idx + delta + TABS.length) % TABS.length;
        handleTabClick(TABS[nextIdx].key);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div style={S.wrapper}>
      {/* ─── 탭 nav (sticky) ─────────────────────────────────────────── */}
      <div
        ref={tabsRef}
        style={S.tabBar}
        role="tablist"
        aria-label="상품 정보 탭"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const count = tab.getCount(product);
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleTabClick(tab.key)}
              type="button"
              style={{
                ...S.tab,
                color: isActive ? '#18181b' : '#71717a',
                fontWeight: isActive ? 600 : 500,
                borderBottomColor: isActive ? '#18181b' : 'transparent',
              }}
            >
              <span>{tab.label}</span>
              {count !== null && (
                <span style={{
                  ...S.count,
                  color: isActive ? '#18181b' : '#a1a1aa',
                }}>
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 탭 컨텐츠 영역 ──────────────────────────────────────────── */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        style={S.panel}
      >
        {activeTab === 'detail'  && <DetailTab product={product} />}
        {activeTab === 'reviews' && <ReviewsTab productId={productId} />}
        {activeTab === 'qna'     && <QnATab productId={productId} />}
        {activeTab === 'refund'  && <RefundTab />}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 탭별 placeholder 컨텐츠 (C1-c 에서 본격 구현)
// ═════════════════════════════════════════════════════════════════════

function DetailTab({ product }) {
  return (
    <div style={S.placeholderBox}>
      <h2 style={S.tabTitle}>상세정보</h2>
      <p style={S.placeholderText}>
        상품 상세 설명 영역입니다.<br />
        C1-c 에서 description 필드 + 추가 메타 정보가 표시됩니다.
      </p>
      {product?.brandName && (
        <p style={S.placeholderMeta}>
          현재는 우측 정보 박스에서 기본 정보를 확인하세요.
        </p>
      )}
    </div>
  );
}

function ReviewsTab({ productId }) {
  return (
    <div style={S.placeholderBox}>
      <h2 style={S.tabTitle}>구매평</h2>
      <p style={S.placeholderText}>
        C1-c 에서 별점 분포 차트와 리뷰 리스트가 여기로 이동합니다.<br />
        현재는 페이지 하단의 별점 차트를 확인하세요.
      </p>
      <p style={S.placeholderMeta}>productId: {productId}</p>
    </div>
  );
}

function QnATab({ productId }) {
  return (
    <div style={S.placeholderBox}>
      <h2 style={S.tabTitle}>Q&A</h2>
      <p style={S.placeholderText}>
        Q&A 기능 준비 중입니다.<br />
        백엔드 B3 (QnA CRUD) 완성 후 활성화됩니다.
      </p>
      <p style={S.placeholderMeta}>productId: {productId}</p>
    </div>
  );
}

function RefundTab() {
  return (
    <div style={S.placeholderBox}>
      <h2 style={S.tabTitle}>반품·교환 안내</h2>
      <div style={S.refundBlock}>
        <p style={S.refundLine}>
          • <strong>반품 가능 기간</strong>: 상품 수령 후 7일 이내
        </p>
        <p style={S.refundLine}>
          • <strong>반품 비용</strong>: 단순 변심 시 왕복 배송비 고객 부담
        </p>
        <p style={S.refundLine}>
          • <strong>교환 가능 사유</strong>: 상품 불량, 오배송 시 무상 교환
        </p>
        <p style={S.refundLine}>
          • <strong>반품 불가</strong>: 사용 흔적이 있거나 포장이 훼손된 경우
        </p>
        <p style={S.refundLine}>
          • <strong>고객센터</strong>: 1588-0000 (평일 09:00 ~ 18:00)
        </p>
      </div>
      <p style={S.placeholderMeta}>※ C1-c 에서 정식 콘텐츠로 보강 예정</p>
    </div>
  );
}

// ─── 인라인 스타일 ───────────────────────────────────────────────────────
const S = {
  wrapper: {
    marginTop: 48,
    background: '#fafafa',
  },

  // 탭 nav (sticky)
  tabBar: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    gap: 0,
    background: '#ffffff',
    borderTop: '1px solid #e4e4e7',
    borderBottom: '1px solid #e4e4e7',
    margin: '0 -24px', // container padding 보정 (전체 너비 가로지름)
    padding: '0 24px',
    boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
  },
  tab: {
    flex: 1,
    padding: '16px 12px',
    fontSize: 14,
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontFamily: 'inherit',
  },
  count: {
    fontSize: 13,
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },

  // 패널 영역
  panel: {
    padding: '32px 0 48px',
  },

  // placeholder 공통
  placeholderBox: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '32px 28px',
    minHeight: 200,
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#18181b',
    margin: '0 0 16px',
  },
  placeholderText: {
    fontSize: 14,
    color: '#52525b',
    lineHeight: 1.7,
    margin: 0,
  },
  placeholderMeta: {
    marginTop: 16,
    fontSize: 12,
    color: '#a1a1aa',
    fontStyle: 'italic',
  },

  // 반품 안내
  refundBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 1.7,
  },
  refundLine: {
    margin: 0,
  },
};
