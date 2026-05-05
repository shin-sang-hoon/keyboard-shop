import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReviewList from './ReviewList';
import QnAList from './QnAList';
import RefundPolicy from './RefundPolicy';

/**
 * 상품 상세 4-tab 네비게이션 (5-H C1-b + C1-c + C3 + C7).
 *
 * 4 탭: 상세정보 / 구매평 (N) / Q&A (N) / 반품·교환
 *
 * 변경 이력:
 *   - C1-c: ReviewsTab placeholder → <ReviewList />
 *   - C3:   QnATab placeholder → <QnAList /> (modal trigger via parent)
 *   - C7:   RefundTab placeholder → <RefundPolicy /> (정책 + FAQ + 고객센터 CTA)
 *
 * lazy fetch / lazy mount 패턴 유지:
 *   - 탭 활성화 시점에만 컨텐츠 컴포넌트 마운트
 *   - 다른 탭 → /reviews · /qna · refund 자원 사용 0
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

  const rawTab = searchParams.get('tab');
  const activeTab = VALID_KEYS.has(rawTab) ? rawTab : 'detail';

  function handleTabClick(key) {
    if (key === activeTab) return;

    const next = new URLSearchParams(searchParams);
    if (key === 'detail') {
      next.delete('tab');
    } else {
      next.set('tab', key);
    }
    setSearchParams(next, { replace: true });
  }

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
        {activeTab === 'refund'  && <RefundPolicy />}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// DetailTab 만 placeholder. 나머지 (Reviews/QnA/Refund) 는 별도 컴포넌트.
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

// ─── 인라인 스타일 ───────────────────────────────────────────────────────
const S = {
  wrapper: {
    marginTop: 48,
    background: '#fafafa',
  },

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

  panel: {
    padding: '32px 0 48px',
  },

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
};
