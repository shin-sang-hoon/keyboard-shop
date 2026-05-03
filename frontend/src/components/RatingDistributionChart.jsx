import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * 별점 분포 차트 (5-H C5).
 *
 * GET /api/products/{productId}/reviews/stats 호출 → B5 응답 시각화.
 *
 * 응답 구조:
 *   {
 *     productId, totalCount, averageRating,
 *     distribution: { "1": 5, "2": 8, "3": 12, "4": 47, "5": 70 }
 *   }
 *
 * 화면 레이아웃 (한국 쇼핑몰 표준 — 5★ 위, 1★ 아래):
 *   ┌─────────────────────────────────────────┐
 *   │  ⭐ 4.3 / 5             142개 리뷰      │
 *   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
 *   │  5★  ████████████████░  70 (49%)        │
 *   │  4★  ███████████░░░░░░  47 (33%)        │
 *   │  3★  ███░░░░░░░░░░░░░░  12  (8%)        │
 *   │  2★  ██░░░░░░░░░░░░░░░   8  (6%)        │
 *   │  1★  █░░░░░░░░░░░░░░░░   5  (4%)        │
 *   └─────────────────────────────────────────┘
 *
 * 설계:
 *   - 외부 차트 라이브러리 의존성 0 (CSS flex + width% 직접)
 *   - 빈 버킷 보정의 가시화 — DB 0건이어도 1~5 모든 막대 표시
 *   - 3가지 상태: loading / error / no-reviews / data
 *   - ProductDetail 패턴(인라인 style 객체) 일관성
 */
export default function RatingDistributionChart({ productId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/products/${productId}/reviews/stats`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('[RatingDistributionChart] fetch error:', err);
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [productId]);

  // ─── 상태별 렌더 ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={S.container}>
        <div style={S.loading}>별점 통계를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.container}>
        <div style={S.error}>별점 통계를 불러오지 못했습니다 ({error})</div>
      </div>
    );
  }

  if (!stats || stats.totalCount === 0) {
    return (
      <div style={S.container}>
        <div style={S.empty}>
          <div style={S.emptyIcon}>⭐</div>
          <div style={S.emptyText}>아직 리뷰가 없습니다</div>
          <div style={S.emptySub}>첫 리뷰를 남겨주세요</div>
        </div>
      </div>
    );
  }

  const { totalCount, averageRating, distribution } = stats;

  // 백엔드 distribution 키가 string 일 수도 (JSON map 직렬화 — Jackson 이 Integer key 를 string 으로)
  // 5 → 4 → 3 → 2 → 1 순서로 정렬 (한국 쇼핑몰 표준)
  const buckets = [5, 4, 3, 2, 1].map((star) => {
    const count = distribution[star] ?? distribution[String(star)] ?? 0;
    const percent = totalCount > 0 ? (count / totalCount) * 100 : 0;
    return { star, count, percent };
  });

  return (
    <div style={S.container}>
      {/* 헤더 — 평균 별점 + 총 개수 */}
      <div style={S.header}>
        <div style={S.avgGroup}>
          <span style={S.avgStar}>⭐</span>
          <span style={S.avgValue}>{averageRating?.toFixed(1) ?? '-'}</span>
          <span style={S.avgMax}>/ 5</span>
        </div>
        <div style={S.totalCount}>{totalCount.toLocaleString()}개 리뷰</div>
      </div>

      <div style={S.divider} />

      {/* 5개 막대그래프 */}
      <div style={S.chart}>
        {buckets.map(({ star, count, percent }) => (
          <div key={star} style={S.row}>
            {/* 별 라벨 — '5★' 형태 */}
            <div style={S.starLabel}>
              {star}<span style={S.starIcon}>★</span>
            </div>

            {/* 막대 — 채워진 부분 + 빈 부분 */}
            <div style={S.barTrack}>
              <div
                style={{
                  ...S.barFill,
                  width: `${percent}%`,
                  // 0% 막대는 살짝 보이게 minWidth (없으면 시각적으로 사라짐)
                  minWidth: count === 0 ? '0' : '2px',
                }}
                role="progressbar"
                aria-valuenow={count}
                aria-valuemin={0}
                aria-valuemax={totalCount}
                aria-label={`${star}점 리뷰 ${count}개 (${percent.toFixed(1)}%)`}
              />
            </div>

            {/* 우측 — count + percent */}
            <div style={S.metaGroup}>
              <span style={S.count}>{count}</span>
              <span style={S.percent}>({percent.toFixed(0)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 인라인 스타일 객체 (ProductDetail 패턴 일관) ────────────────────────
const S = {
  container: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '20px 24px',
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, sans-serif',
  },
  loading: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    padding: '40px 0',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
    padding: '40px 0',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 0',
  },
  emptyIcon: {
    fontSize: 48,
    opacity: 0.3,
    marginBottom: 12,
  },
  emptyText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 4,
  },
  emptySub: {
    color: '#9ca3af',
    fontSize: 13,
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  avgGroup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  avgStar: {
    fontSize: 24,
    lineHeight: 1,
  },
  avgValue: {
    fontSize: 36,
    fontWeight: 800,
    color: '#111827',
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
  avgMax: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: 500,
  },
  totalCount: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 500,
  },
  divider: {
    height: 1,
    background: '#f3f4f6',
    margin: '16px 0 14px',
  },
  chart: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  starLabel: {
    minWidth: 28,
    fontSize: 13,
    color: '#374151',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  starIcon: {
    color: '#fbbf24',
    fontSize: 12,
  },
  barTrack: {
    flex: 1,
    height: 10,
    background: '#f3f4f6',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)',
    borderRadius: 5,
    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  metaGroup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    minWidth: 70,
    justifyContent: 'flex-end',
    fontVariantNumeric: 'tabular-nums',
  },
  count: {
    fontSize: 13,
    color: '#374151',
    fontWeight: 600,
  },
  percent: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: 500,
  },
};
