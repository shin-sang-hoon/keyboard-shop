import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReviewList from './ReviewList';
import QnAList from './QnAList';

/**
 * 상품 상세 4-tab 네비게이션 (5-H C1-b + C1-c).
 *
 * 4 탭: 상세정보 / 구매평 (N) / Q&A (N) / 반품·교환
 *
 * C1-c 변경:
 *   - ReviewsTab placeholder → <ReviewList productId={...} /> 로 교체
 *   - lazy fetch: 사용자가 '구매평' 탭 클릭하기 전엔 ReviewList 가 마운트 안 됨
 *     → /reviews API 와 /reviews/stats API 호출 0
 *   - 탭 클릭 시점에 ReviewList 마운트 → 자동 fetch
 *
 * 면접 포인트:
 *   - 조건부 렌더가 곧 lazy 패턴 (별도 코드 없이 자연스럽게)
 *   - 다른 탭 (Q&A, 반품) 도 활성 시점에만 렌더 → 불필요한 호출 0
 */

const TABS = [
  { key: 'detail',  label: '상세정보',   getCount: () => null },
  { key: 'reviews', label: '구매평',     getCount: (p) => p?.reviewCount ?? 0 },
  { key: 'qna',     label: 'Q&A',        getCount: (p) => p?.qnaCount ?? 0 },
  { key: 'refund',  label: '반품·교환',  getCount: () => null },
];

const VALID_KEYS = new Set(TABS.map((t) => t.key));

export default function ProductTabs({ product, productId, onRequestQnAWrite, qnaRefetchKey = 0 }) {
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

  // ─── 키보드 ←/→ 로 탭 이동 ─────────────────────────────────────────────
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
        {activeTab === 'reviews' && <ReviewList productId={productId} />}
        {activeTab === 'qna'     && (
          <QnAList
            productId={productId}
            onRequestWrite={onRequestQnAWrite}
            refetchKey={qnaRefetchKey}
          />
        )}
        {activeTab === 'refund'  && <RefundTab />}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 탭별 컨텐츠 — Reviews 만 ReviewList 로 분리, 나머지는 placeholder
// ═════════════════════════════════════════════════════════════════════

function DetailTab({ product }) {
  return (
    <div style={S.placeholderBox}>
      <h2 style={S.tabTitle}>상세정보</h2>
      <p style={S.placeholderText}>
        상품 상세 설명 영역입니다.<br />
        백엔드에 description 필드 추가 후 본격 컨텐츠가 표시됩니다.
      </p>
      {product?.brandName && (
        <p style={S.placeholderMeta}>
          현재는 우측 정보 박스에서 기본 정보 (브랜드 / 재고 / 상태) 를 확인하세요.
        </p>
      )}
    </div>
  );
}

function QnATab({ productId }) {
  // 5-H C3 완료: ProductTabs 에서 직접 <QnAList /> 를 렌더하므로 이 컴포넌트는 더 이상 사용 안 됨.
  // 호환성을 위해 남겨두지만, 향후 정리 시 삭제 가능.
  return (
    <div style={S.placeholderBox}>
      <h2 style={S.tabTitle}>Q&A</h2>
      <p style={S.placeholderText}>
        (deprecated placeholder — QnAList 가 직접 렌더링됩니다)
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
    margin: '0 -24px',
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
