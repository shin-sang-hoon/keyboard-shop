import { useEffect, useRef, useState } from 'react';
import RatingDistributionChart from './RatingDistributionChart';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * 상품 리뷰 리스트 (5-H C1-c + C2).
 *
 * C2 변경:
 *   - props 에 onRequestWrite, refetchKey 추가 (C3 패턴 그대로)
 *   - 헤더 우측에 "+ 리뷰 작성" 버튼
 *   - EmptyState 에도 작성 버튼
 *   - refetchKey 변경 시 자동 refetch (등록 성공 후 트리거용)
 *
 * 구성 (위 → 아래):
 *   [1] 헤더 — 정렬 dropdown (B6 미완성 → placeholder + disabled) + 작성 버튼
 *   [2] 별점 분포 차트 (RatingDistributionChart, B5 stats API)
 *   [3] 리뷰 리스트 (B2 GET /api/products/{id}/reviews)
 *
 * Props:
 *   - productId: number
 *   - onRequestWrite: () => void  (C2 신규, 작성 버튼 클릭)
 *   - refetchKey: number          (C2 신규, 등록 성공 시 +1 → refetch 트리거)
 */
export default function ReviewList({ productId, onRequestWrite, refetchKey = 0 }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLast, setIsLast] = useState(true);

  const [sort, setSort] = useState('latest');

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // refetchKey 변경 시 첫 페이지로 돌아가서 다시 fetch
  useEffect(() => {
    if (refetchKey > 0) setPage(0);
  }, [refetchKey]);

  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(
      `${API_BASE}/products/${productId}/reviews?page=${page}&size=10`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMountedRef.current) return;
        setReviews(data.content || []);
        setTotalElements(data.totalElements ?? 0);
        setIsLast(data.last ?? true);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (!isMountedRef.current) return;
        console.error('[ReviewList] fetch error:', err);
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [productId, page, refetchKey]);

  return (
    <div style={S.container}>
      {/* ═══════ [1] 헤더 — 정렬 dropdown placeholder + 작성 버튼 ═══════ */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <h2 style={S.title}>구매평</h2>
          {!loading && !error && (
            <span style={S.totalCount}>
              총 {totalElements.toLocaleString()}건
            </span>
          )}
        </div>

        <div style={S.headerRight}>
          {/* 정렬 dropdown — B6 완성 전이라 disabled placeholder */}
          <div style={S.sortGroup}>
            <label style={S.sortLabel} htmlFor="review-sort">정렬</label>
            <select
              id="review-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              disabled
              style={S.sortSelect}
              title="정렬 기능은 백엔드 B6 완성 후 활성화됩니다"
            >
              <option value="latest">최신순</option>
              <option value="rating_desc">별점 높은순</option>
              <option value="rating_asc">별점 낮은순</option>
              <option value="helpful">도움순</option>
            </select>
          </div>

          {/* C2 신규: 리뷰 작성 버튼 */}
          {onRequestWrite && (
            <button
              type="button"
              onClick={onRequestWrite}
              style={S.writeBtn}
              aria-label="리뷰 작성"
            >
              + 리뷰 작성
            </button>
          )}
        </div>
      </div>

      {/* ═══════ [2] 별점 분포 차트 ═══════ */}
      <div style={S.chartWrap}>
        <RatingDistributionChart productId={productId} />
      </div>

      {/* ═══════ [3] 리뷰 리스트 ═══════ */}
      <div style={S.listWrap}>
        {loading && (
          <div style={S.statusBox}>리뷰를 불러오는 중...</div>
        )}

        {error && (
          <div style={{ ...S.statusBox, color: '#dc2626' }}>
            리뷰를 불러오지 못했습니다 ({error})
          </div>
        )}

        {!loading && !error && reviews.length === 0 && (
          <div style={S.emptyBox}>
            <div style={S.emptyIcon}>📝</div>
            <div style={S.emptyTitle}>아직 리뷰가 없습니다</div>
            <div style={S.emptySub}>구매하신 분들의 첫 리뷰를 기다리고 있어요</div>
            {onRequestWrite && (
              <button
                type="button"
                onClick={onRequestWrite}
                style={S.emptyWriteBtn}
              >
                + 첫 리뷰 작성하기
              </button>
            )}
          </div>
        )}

        {!loading && !error && reviews.length > 0 && (
          <>
            <div style={S.cardList}>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>

            <div style={S.pagination}>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  ...S.pageBtn,
                  opacity: page === 0 ? 0.4 : 1,
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                }}
                type="button"
              >
                이전
              </button>
              <span style={S.pageInfo}>{page + 1}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={isLast}
                style={{
                  ...S.pageBtn,
                  opacity: isLast ? 0.4 : 1,
                  cursor: isLast ? 'not-allowed' : 'pointer',
                }}
                type="button"
              >
                다음
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 리뷰 카드 (개별 리뷰 한 건)
// ═════════════════════════════════════════════════════════════════════

function ReviewCard({ review }) {
  const {
    rating,
    content,
    userName = '익명',
    createdAt,
    verifiedPurchase = true,
  } = review;

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardLeft}>
          <StarRating rating={rating} />
          {verifiedPurchase && (
            <span style={S.verifiedBadge}>✓ 구매 인증</span>
          )}
        </div>
        <div style={S.cardRight}>
          <span style={S.userName}>{userName}</span>
          <span style={S.dot}>·</span>
          <span style={S.date}>{formatRelativeDate(createdAt)}</span>
        </div>
      </div>

      {content && <p style={S.cardContent}>{content}</p>}
    </div>
  );
}

function StarRating({ rating = 0 }) {
  return (
    <div style={S.starGroup} aria-label={`별점 ${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        let fillPercent = 0;
        if (rating >= n) fillPercent = 100;
        else if (rating > n - 1) fillPercent = (rating - (n - 1)) * 100;

        return (
          <span key={n} style={S.starWrap}>
            <span style={S.starBg}>☆</span>
            <span
              style={{
                ...S.starFg,
                width: `${fillPercent}%`,
              }}
            >
              ★
            </span>
          </span>
        );
      })}
    </div>
  );
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const now = Date.now();
  const diff = now - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;

  if (diff < min) return '방금';
  if (diff < hour) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

// ─── 인라인 스타일 ───────────────────────────────────────────────────────
const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#18181b',
    margin: 0,
  },
  totalCount: {
    fontSize: 13,
    color: '#71717a',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },

  sortGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    color: '#71717a',
    fontWeight: 500,
  },
  sortSelect: {
    padding: '6px 28px 6px 10px',
    fontSize: 13,
    color: '#71717a',
    background: '#f9fafb',
    border: '1px solid #e4e4e7',
    borderRadius: 6,
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    appearance: 'menulist',
  },

  writeBtn: {
    background: '#18181b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    flexShrink: 0,
  },

  chartWrap: {},

  listWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  statusBox: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '40px 24px',
    textAlign: 'center',
    color: '#71717a',
    fontSize: 14,
  },

  emptyBox: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 16,
  },
  emptyWriteBtn: {
    background: '#18181b',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 4,
  },

  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '16px 20px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#71717a',
  },
  userName: {
    color: '#52525b',
    fontWeight: 500,
  },
  dot: {
    color: '#d4d4d8',
  },
  date: {
    color: '#a1a1aa',
  },
  verifiedBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: '#16a34a',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 4,
    padding: '2px 6px',
  },
  cardContent: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  starGroup: {
    display: 'inline-flex',
    gap: 1,
    fontSize: 14,
    lineHeight: 1,
  },
  starWrap: {
    position: 'relative',
    display: 'inline-block',
    width: 14,
    height: 14,
    color: '#e4e4e7',
  },
  starBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: '#e4e4e7',
  },
  starFg: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: '#fbbf24',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },

  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid #f4f4f5',
  },
  pageBtn: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: '#52525b',
    background: '#fff',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  pageInfo: {
    fontSize: 13,
    fontWeight: 600,
    color: '#18181b',
    fontVariantNumeric: 'tabular-nums',
  },
};
