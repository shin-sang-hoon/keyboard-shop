// frontend/src/pages/admin/AdminDashboardPage.jsx
//
// Phase 7-G (2026-05-21) — 관리자 대시보드.
//
// 라운드 1: 레이아웃 검증용 임시 화면 (통계 카드 자리만).
// 라운드 3: GET /api/admin/stats 연결 + Recharts 추이 차트.
//
// 디자인: swagkey 화이트 톤.

import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';

export default function AdminDashboardPage() {
  return (
    <div>
      <div style={S.intro}>
        <h2 style={S.introTitle}>SWACHRON 관리자 대시보드</h2>
        <p style={S.introDesc}>
          좌측 사이드바에서 회원 · 상품 · 주문 · 공지사항 · 플래시 딜 · 감사 로그를 관리할 수 있습니다.
        </p>
      </div>

      {/* 통계 카드 자리 — 라운드 3에서 실제 데이터 연결 */}
      <div style={S.cardGrid}>
        {STAT_PLACEHOLDERS.map((stat) => (
          <div key={stat.label} style={S.card}>
            <div style={S.cardLabel}>{stat.label}</div>
            <div style={S.cardValue}>—</div>
            <div style={S.cardHint}>{stat.hint}</div>
          </div>
        ))}
      </div>

      <div style={S.notice}>
        통계 데이터는 다음 단계(7-G 라운드 3)에서 <code style={S.code}>GET /api/admin/stats</code> 연결 시 표시됩니다.
      </div>
    </div>
  );
}

const STAT_PLACEHOLDERS = [
  { label: '판매중 상품', hint: 'ACTIVE 상태' },
  { label: '전체 회원', hint: 'USER + ADMIN' },
  { label: '누적 리뷰', hint: '구매 인증 리뷰' },
  { label: '누적 주문', hint: '주문 건수' },
];

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
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: spacing[4],
    marginBottom: spacing[6],
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
  notice: {
    background: colors.surfaceMuted,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  code: {
    fontFamily: typography.fontFamily.mono,
    background: colors.white,
    padding: '2px 6px',
    borderRadius: radius.sm,
    fontSize: typography.fontSize.xs,
    color: colors.accent,
  },
};
