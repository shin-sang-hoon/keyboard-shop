// frontend/src/pages/admin/AdminDashboardPage.jsx
//
// Phase 7-G — 관리자 대시보드.
//
// 라운드 1 (5/21): 레이아웃 검증용 임시 화면.
// 라운드 3 (5/24): GET /api/admin/stats 연결 — 카드 4개.
// 현황 강화 (5/30): 단일 호출로 대시보드 전체 구성 (차트 없이 카드 + 목록).
//   - 상단 4 카드 (판매중 상품/전체 회원/누적 리뷰/누적 주문) — 기존 유지
//   - 운영 알림성 2 카드 (미답변 Q&A / 진행중 경매) — "처리할 일" 강조 색
//   - 상태별 분포 3 패널 (회원/주문/상품) — 가로 배지 나열
//   - 최근 목록 2 패널 (최근 가입 5 / 최근 주문 5)
//
// 디자인: swagkey 화이트 톤. 차트 없음(숫자/목록만) — 별점 분포 차트 자산과 중복 회피.
//
// 상태 처리: loading / error / success 3-상태 (기존 패턴 유지).

import { useState, useEffect } from 'react';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';
import { adminStatsApi } from '../../api/adminStats';

const STATUS_KO = {
  // 주문
  PENDING: '결제대기', PAID: '결제완료', SHIPPING: '배송중', DELIVERED: '배송완료', CANCELLED: '취소',
  // 회원
  ACTIVE: '정상', SUSPENDED: '정지', WITHDRAWN: '탈퇴',
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await adminStatsApi.getStats();
        if (alive) { setStats(data); setError(null); }
      } catch (e) {
        if (alive) setError('통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 상단 4 카드
  const cards = [
    { key: 'activeProductCount', label: '판매중 상품', hint: 'ACTIVE 상태' },
    { key: 'totalUserCount',     label: '전체 회원',   hint: 'USER + ADMIN' },
    { key: 'reviewCount',        label: '누적 리뷰',   hint: '구매 인증 리뷰' },
    { key: 'orderCount',         label: '누적 주문',   hint: '주문 건수' },
  ];

  const num = (v) => {
    if (loading) return '...';
    if (error || v == null) return '—';
    return Number(v).toLocaleString();
  };

  const fmtDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };
  const won = (v) => (v == null ? '-' : `₩${Number(v).toLocaleString()}`);

  const us = stats?.userStatus;
  const os = stats?.orderStatus;
  const ps = stats?.productStatus;

  return (
    <div>
      <div style={S.intro}>
        <h2 style={S.introTitle}>SWACHRON 관리자 대시보드</h2>
        <p style={S.introDesc}>
          운영 현황 한눈에 보기 · 좌측에서 회원 · 상품 · 주문 · 공지 · 플래시 딜 · 감사 로그 관리
        </p>
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      {/* 상단 4 카드 */}
      <div style={S.cardGrid}>
        {cards.map((c) => (
          <div key={c.key} style={S.card}>
            <div style={S.cardLabel}>{c.label}</div>
            <div style={{ ...S.cardValue, color: error ? colors.textOnLightDim : colors.textOnLight }}>
              {num(stats?.[c.key])}
            </div>
            <div style={S.cardHint}>{c.hint}</div>
          </div>
        ))}
      </div>

      {/* 운영 알림성 2 카드 — 처리할 일 강조 */}
      <div style={S.alertGrid}>
        <div style={{ ...S.alertCard, ...(Number(stats?.pendingQnaCount) > 0 ? S.alertCardActive : {}) }}>
          <div style={S.alertLabel}>답변 대기 문의</div>
          <div style={S.alertValue}>{num(stats?.pendingQnaCount)}</div>
          <div style={S.alertHint}>미답변 Q&amp;A — 빠른 응대 필요</div>
        </div>
        <div style={{ ...S.alertCard, ...(Number(stats?.activeAuctionCount) > 0 ? S.alertCardActive : {}) }}>
          <div style={S.alertLabel}>진행 중 경매</div>
          <div style={S.alertValue}>{num(stats?.activeAuctionCount)}</div>
          <div style={S.alertHint}>ACTIVE 상태 경매</div>
        </div>
      </div>

      {/* 상태별 분포 3 패널 */}
      <div style={S.breakdownGrid}>
        <div style={S.panel}>
          <div style={S.panelTitle}>회원 상태</div>
          <div style={S.badgeRow}>
            <Badge label="정상" value={num(us?.active)} tone="ok" />
            <Badge label="정지" value={num(us?.suspended)} tone="warn" />
            <Badge label="탈퇴" value={num(us?.withdrawn)} tone="muted" />
          </div>
        </div>

        <div style={S.panel}>
          <div style={S.panelTitle}>주문 상태</div>
          <div style={S.badgeRow}>
            <Badge label="결제대기" value={num(os?.pending)} tone="muted" />
            <Badge label="결제완료" value={num(os?.paid)} tone="ok" />
            <Badge label="배송중" value={num(os?.shipping)} tone="info" />
            <Badge label="배송완료" value={num(os?.delivered)} tone="ok" />
            <Badge label="취소" value={num(os?.cancelled)} tone="danger" />
          </div>
        </div>

        <div style={S.panel}>
          <div style={S.panelTitle}>상품 상태</div>
          <div style={S.badgeRow}>
            <Badge label="판매중" value={num(ps?.active)} tone="ok" />
            <Badge label="숨김" value={num(ps?.inactive)} tone="muted" />
          </div>
        </div>
      </div>

      {/* 최근 목록 2 패널 */}
      <div style={S.recentGrid}>
        {/* 최근 가입 회원 */}
        <div style={S.panel}>
          <div style={S.panelTitle}>최근 가입 회원</div>
          {loading ? (
            <div style={S.emptyRow}>불러오는 중…</div>
          ) : (stats?.recentUsers?.length ?? 0) === 0 ? (
            <div style={S.emptyRow}>가입 회원이 없습니다.</div>
          ) : (
            <ul style={S.list}>
              {stats.recentUsers.map((u) => (
                <li key={u.id} style={S.listItem}>
                  <div style={S.listMain}>
                    <span style={S.listName}>{u.displayName || u.email}</span>
                    <span style={S.listSub}>{u.email}</span>
                  </div>
                  <div style={S.listMeta}>
                    <span style={S.tagMono}>{u.provider}</span>
                    <span style={S.listDate}>{fmtDate(u.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 최근 주문 */}
        <div style={S.panel}>
          <div style={S.panelTitle}>최근 주문</div>
          {loading ? (
            <div style={S.emptyRow}>불러오는 중…</div>
          ) : (stats?.recentOrders?.length ?? 0) === 0 ? (
            <div style={S.emptyRow}>주문 내역이 없습니다.</div>
          ) : (
            <ul style={S.list}>
              {stats.recentOrders.map((o) => (
                <li key={o.id} style={S.listItem}>
                  <div style={S.listMain}>
                    <span style={S.listName}>{won(o.totalPrice)}</span>
                    <span style={S.listSub}>{o.userName}</span>
                  </div>
                  <div style={S.listMeta}>
                    <span style={S.tagSoft}>{STATUS_KO[o.status] ?? o.status}</span>
                    <span style={S.listDate}>{fmtDate(o.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// 상태 배지 (분포 패널용)
function Badge({ label, value, tone }) {
  const toneStyle = {
    ok:     { color: '#047857', background: 'rgba(16,185,129,0.1)',  borderColor: 'rgba(16,185,129,0.3)' },
    warn:   { color: '#b45309', background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)' },
    danger: { color: '#dc2626', background: '#fef2f2',               borderColor: '#fecaca' },
    info:   { color: '#1d4ed8', background: 'rgba(37,99,235,0.1)',   borderColor: 'rgba(37,99,235,0.3)' },
    muted:  { color: colors.textOnLightDim, background: colors.surfaceMuted, borderColor: colors.borderLight },
  }[tone] || {};
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
      padding: `${spacing[2]} ${spacing[3]}`,
      borderWidth: '1px', borderStyle: 'solid', borderRadius: radius.md,
      minWidth: 64,
      color: toneStyle.color, background: toneStyle.background, borderColor: toneStyle.borderColor,
    }}>
      <span style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium }}>{label}</span>
      <span style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold }}>{value}</span>
    </div>
  );
}

const S = {
  intro: { marginBottom: spacing[6] },
  introTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0, marginBottom: spacing[2],
  },
  introDesc: { fontSize: typography.fontSize.base, color: colors.textOnLightDim, margin: 0 },
  errorBanner: {
    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
    borderRadius: radius.md, padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm, marginBottom: spacing[5],
  },

  cardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing[4],
    marginBottom: spacing[4],
  },
  card: {
    background: colors.white, border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg, padding: spacing[5], boxShadow: shadow.card,
  },
  cardLabel: {
    fontSize: typography.fontSize.sm, color: colors.textOnLightDim,
    fontWeight: typography.fontWeight.medium, marginBottom: spacing[3],
  },
  cardValue: {
    fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight, lineHeight: 1,
  },
  cardHint: { fontSize: typography.fontSize.xs, color: colors.textOnLightDim, marginTop: spacing[2] },

  // 알림성 2 카드
  alertGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing[4],
    marginBottom: spacing[5],
  },
  alertCard: {
    background: colors.white, borderWidth: '1px', borderStyle: 'solid',
    borderColor: colors.borderLight, borderRadius: radius.lg,
    padding: spacing[5], boxShadow: shadow.card,
  },
  alertCardActive: {
    borderColor: 'rgba(245,158,11,0.5)',
    background: 'rgba(245,158,11,0.04)',
  },
  alertLabel: {
    fontSize: typography.fontSize.sm, color: colors.textOnLightDim,
    fontWeight: typography.fontWeight.medium, marginBottom: spacing[3],
  },
  alertValue: {
    fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight, lineHeight: 1,
  },
  alertHint: { fontSize: typography.fontSize.xs, color: colors.textOnLightDim, marginTop: spacing[2] },

  // 분포 3 패널
  breakdownGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing[4],
    marginBottom: spacing[5],
  },

  // 최근 목록 2 패널
  recentGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing[4],
  },

  panel: {
    background: colors.white, border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg, padding: spacing[5], boxShadow: shadow.card,
  },
  panelTitle: {
    fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight, marginBottom: spacing[4],
  },
  badgeRow: { display: 'flex', gap: spacing[2], flexWrap: 'wrap' },

  list: { listStyle: 'none', margin: 0, padding: 0 },
  listItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: `${spacing[3]} 0`,
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: colors.borderLight,
  },
  listMain: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  listName: {
    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
  },
  listSub: {
    fontSize: typography.fontSize.xs, color: colors.textOnLightDim,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200,
  },
  listMeta: { display: 'flex', alignItems: 'center', gap: spacing[2], flexShrink: 0 },
  tagMono: {
    fontSize: typography.fontSize.xs, color: colors.textOnLightDim,
    fontFamily: typography.fontFamily.mono,
  },
  tagSoft: {
    fontSize: typography.fontSize.xs, color: colors.textOnLightDim,
    background: colors.surfaceMuted,
    padding: `2px ${spacing[2]}`, borderRadius: radius.sm,
  },
  listDate: {
    fontSize: typography.fontSize.xs, color: colors.textOnLightDim,
    fontVariantNumeric: 'tabular-nums',
  },
  emptyRow: {
    padding: `${spacing[5]} 0`, textAlign: 'center',
    fontSize: typography.fontSize.sm, color: colors.textOnLightDim,
  },
};
