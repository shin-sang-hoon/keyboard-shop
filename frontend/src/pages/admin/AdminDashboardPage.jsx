// frontend/src/pages/admin/AdminDashboardPage.jsx
//
// Phase 7-G — 관리자 대시보드.
//
// 라운드 1 (5/21): 레이아웃 검증용 임시 화면 (통계 카드 자리만).
// 라운드 3 (5/24): GET /api/admin/stats 연결 — 카드 4개 실제 숫자.
//                  (막대바 차트는 카드 숫자와 중복이라 제거 — 심플 관리자 UI 지향.)
//
// 디자인: swagkey 화이트 톤.
//
// 상태 처리: loading / error / success 3-상태.
//   - loading: 카드 값 자리에 "..." 스켈레톤
//   - error:   상단 빨간 배너 + 카드는 "—" 유지
//   - success: 실제 숫자 렌더

import { useState, useEffect } from 'react';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';
import { adminStatsApi } from '../../api/adminStats';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await adminStatsApi.getStats();
        if (alive) {
          setStats(data);
          setError(null);
        }
      } catch (e) {
        if (alive) {
          setError('통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 카드 메타 + stats 키 매핑
  const cards = [
    { key: 'activeProductCount', label: '판매중 상품', hint: 'ACTIVE 상태' },
    { key: 'totalUserCount',     label: '전체 회원',   hint: 'USER + ADMIN' },
    { key: 'reviewCount',        label: '누적 리뷰',   hint: '구매 인증 리뷰' },
    { key: 'orderCount',         label: '누적 주문',   hint: '주문 건수' },
  ];

  const renderValue = (key) => {
    if (loading) return '...';
    if (error || !stats) return '—';
    return (stats[key] ?? 0).toLocaleString();
  };

  return (
    <div>
      <div style={S.intro}>
        <h2 style={S.introTitle}>SWACHRON 관리자 대시보드</h2>
        <p style={S.introDesc}>
          좌측 사이드바에서 회원 · 상품 · 주문 · 공지사항 · 플래시 딜 · 감사 로그를 관리할 수 있습니다.
        </p>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div style={S.errorBanner}>{error}</div>
      )}

      {/* 통계 카드 4개 */}
      <div style={S.cardGrid}>
        {cards.map((c) => (
          <div key={c.key} style={S.card}>
            <div style={S.cardLabel}>{c.label}</div>
            <div style={{ ...S.cardValue, color: error ? colors.textOnLightDim : colors.textOnLight }}>
              {renderValue(c.key)}
            </div>
            <div style={S.cardHint}>{c.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const S = {
  intro: {
    marginBottom: spacing[6],
  },
  introTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[2],
  },
  introDesc: {
    fontSize: typography.fontSize.base,
    color: colors.textOnLightDim,
    margin: 0,
  },
  errorBanner: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: radius.md,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[5],
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: spacing[4],
  },
  card: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: spacing[5],
    boxShadow: shadow.card,
  },
  cardLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[3],
  },
  cardValue: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    lineHeight: 1,
  },
  cardHint: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
    marginTop: spacing[2],
  },
};
