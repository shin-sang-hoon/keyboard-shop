import { useEffect, useRef, useState } from 'react';
import RatingDistributionChart from './RatingDistributionChart';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * 상품 리뷰 리스트 (5-H C1-c).
 *
 * 구성 (위 → 아래):
 *   [1] 헤더 — 정렬 dropdown (B6 미완성 → placeholder + disabled)
 *   [2] 별점 분포 차트 (RatingDistributionChart, B5 stats API)
 *   [3] 리뷰 리스트 (B2 GET /api/products/{id}/reviews)
 *
 * Props:
 *   - productId: number
 *
 * Lazy 패턴:
 *   ProductTabs 의 조건부 렌더 ({activeTab === 'reviews' && <ReviewsTab />})
 *   덕분에 이 컴포넌트는 '구매평' 탭 활성 시점에만 마운트됨.
 *   그래서 useEffect 가 자연스럽게 lazy fetch.
 *
 * 안전장치:
 *   - AbortController: 요청 중 unmount 시 abort (race condition 방어)
 *   - isMounted ref: 응답 늦게 도착 + setState 시 unmount 후 setState 방지
 *
 * 4-state UI:
 *   - loading: 초기 로딩 indicator
 *   - error: HTTP 에러 + 재시도
 *   - empty: 리뷰 0건 — 별점 차트는 빈 상태로 표시되고 리스트 영역만 별도 빈 메시지
 *   - data: 리뷰 리스트 카드 펼침
 *
 * 면접 포인트:
 *   - lazy fetch (탭 활성 시점에만 호출)
 *   - isMounted 가드 + AbortController 이중 안전장치
 *   - 정렬 placeholder 로 B6 후 자연스러운 확장점 표시
 */
export default function ReviewList({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLast, setIsLast] = useState(true);

  // 정렬 (B6 미완성 — UI placeholder)
  const [sort, setSort] = useState('latest');

  const isMountedRef = useRef(true);

  // ─── 마운트/언마운트 ─────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─── lazy fetch — 탭 활성 시점에만 호출 ─────────────────────────────
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
        // PagedResponse 응답 (B5에서 정리한 9 필드)
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
  }, [productId, page]);

  return (
    <div style={S.container}>
      {/* ═══════ [1] 헤더 — 정렬 dropdown placeholder ═══════ */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <h2 style={S.title}>구매평</h2>
          {!loading && !error && (
            <span style={S.totalCount}>
              총 {totalElements.toLocaleString()}건
            </span>
          )}
        </div>

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
          </div>
        )}

        {!loading && !error && reviews.length > 0 && (
          <>
            <div style={S.cardList}>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>

            {/* 페이지네이션 — B6 정렬 완성 후 함께 보강 */}
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
    verifiedPurchase = true, // B2 응답에 isVerifiedPurchase 있다 가정 (없으면 default true)
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

// ─── 별점을 ★ 5개로 시각화 ─────────────────────────────────────────────
function StarRating({ rating = 0 }) {
  // rating 0.5 단위 (1.0~5.0). 5개 별 중 채움/반/빈 비율로 표시
  return (
    <div style={S.starGroup} aria-label={`별점 ${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        // 별 하나가 가득 찬 경우, 절반, 빈 경우
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

// ─── 상대 시간 포맷 (방금 / N분 전 / N시간 전 / N일 전 / yyyy.mm.dd) ─
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

  // 1주 이상은 yyyy.mm.dd
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

  // 헤더
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

  // 정렬
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

  // 차트 wrap
  chartWrap: {
    // RatingDistributionChart 가 자체 container 가 있어서 별도 box 필요 없음
  },

  // 리스트 wrap
  listWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  // 상태 박스 (loading/error)
  statusBox: {
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    padding: '40px 24px',
    textAlign: 'center',
    color: '#71717a',
    fontSize: 14,
  },

  // 빈 상태
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
  },

  // 카드 리스트
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

  // 별점 컴포넌트
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

  // 페이지네이션
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
