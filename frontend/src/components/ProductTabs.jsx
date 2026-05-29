import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReviewList from './ReviewList';
import QnAList from './QnAList';
import RefundPolicy from './RefundPolicy';
// P3 (5/29) — 상세정보 HTML 렌더: XSS sanitize + dev/prod URL 보정
import DOMPurify from 'dompurify';
import { prependAssetOrigins } from '../utils/assetUrl';

/**
 * 상품 상세 4-tab 네비게이션 (5-H C1-b + C1-c + C3 + C7).
 *
 * 4 탭: 상세정보 / 구매평 (N) / Q&A (N) / 반품·교환
 *
 * 변경 이력:
 *   - C1-c: ReviewsTab placeholder → <ReviewList />
 *   - C2:   ReviewList 작성 모달 트리거 + refetchKey 전달
 *   - C3:   QnATab placeholder → <QnAList /> (modal trigger via parent)
 *   - C7:   RefundTab placeholder → <RefundPolicy /> (정책 + FAQ + 고객센터 CTA)
 *
 * lazy fetch / lazy mount 패턴 유지:
 *   - 탭 활성화 시점에만 컨텐츠 컴포넌트 마운트
 *   - 다른 탭 → /reviews · /qna · refund 자원 사용 0
 */

// P3: 상세정보 본문(.swk-detail-content) 스타일 1회 주입 (ProductDetail.jsx 패턴)
if (typeof document !== 'undefined' && !document.getElementById('swk-detail-content-style')) {
  const el = document.createElement('style');
  el.id = 'swk-detail-content-style';
  el.textContent = `
    .swk-detail-content { font-size: 15px; line-height: 1.8; color: #27272a; word-break: break-word; }
    .swk-detail-content > *:first-child { margin-top: 0; }
    .swk-detail-content h2 { font-size: 24px; font-weight: 800; margin: 28px 0 14px; line-height: 1.3; color: #18181b; }
    .swk-detail-content h3 { font-size: 19px; font-weight: 700; margin: 24px 0 12px; line-height: 1.35; color: #18181b; }
    .swk-detail-content p { margin: 0 0 14px; }
    .swk-detail-content ul, .swk-detail-content ol { margin: 0 0 14px; padding-left: 24px; }
    .swk-detail-content li { margin: 6px 0; }
    .swk-detail-content img { max-width: 100%; height: auto; border-radius: 10px; margin: 12px 0; display: block; }
    .swk-detail-content strong { font-weight: 700; }
    .swk-detail-content a { color: #3b6bef; text-decoration: underline; }
  `;
  document.head.appendChild(el);
}

const TABS = [
  { key: 'detail',  label: '상세정보',   getCount: () => null },
  { key: 'reviews', label: '구매평',     getCount: (p) => p?.reviewCount ?? 0 },
  { key: 'qna',     label: 'Q&A',        getCount: (p) => p?.qnaCount ?? 0 },
  { key: 'refund',  label: '반품·교환',  getCount: () => null },
];

const VALID_KEYS = new Set(TABS.map((t) => t.key));

export default function ProductTabs({
  product,
  productId,
  onRequestQnAWrite,
  qnaRefetchKey = 0,
  onRequestReviewWrite,
  reviewRefetchKey = 0,
}) {
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
        {activeTab === 'reviews' && (
          <ReviewList
            productId={productId}
            onRequestWrite={onRequestReviewWrite}
            refetchKey={reviewRefetchKey}
          />
        )}
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
  const raw = product?.description;
  const hasContent =
    typeof raw === 'string' && raw.trim().length > 0 && raw.trim() !== '<p></p>';

  // 미등록 — 기존 placeholder 톤 유지
  if (!hasContent) {
    return (
      <div style={S.placeholderBox}>
        <h2 style={S.tabTitle}>상세정보</h2>
        <p style={S.placeholderText}>등록된 상세정보가 없습니다.</p>
        {product?.brandName && (
          <p style={S.placeholderMeta}>
            우측 정보 박스에서 기본 정보 (브랜드 / 재고 / 상태) 를 확인하세요.
          </p>
        )}
      </div>
    );
  }

  // 보안: ADMIN 만 작성하는 신뢰 경계 안의 HTML 이지만, dangerouslySetInnerHTML 는
  //       stored XSS 정문이므로 렌더 단에서 DOMPurify allowlist sanitization (defense-in-depth).
  //       sanitize 후 dev/prod origin 보정 (저장은 상대 URL, 표시는 절대 URL).
  const safeHtml = prependAssetOrigins(DOMPurify.sanitize(raw));

  return (
    <div style={S.detailBox}>
      <div
        className="swk-detail-content"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
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

  detailBox: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '32px 28px',
    minHeight: 200,
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
