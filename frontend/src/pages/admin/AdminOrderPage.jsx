// frontend/src/pages/admin/AdminOrderPage.jsx
//
// Phase 7-G 라운드 6 (2026-05-25) — 관리자 주문 관리.
//
// 기능:
//   - 주문 목록 테이블 (주문번호 / 주문자 / 상품요약 / 총액 / 상태 / 주문일)
//   - 상태 필터 (전체 / 결제대기 / 결제완료 / 배송중 / 배송완료 / 취소)
//   - 페이징 (이전 / 다음)
//   - 주문 상태 변경 — 드롭다운(select)으로 5단계 전환
//
// 디자인: swagkey 화이트 톤. AdminUserPage / AdminProductPage 와 동일 톤.
//
// 주문은 ACTIVE/INACTIVE 2-state 가 아니라 5단계라 토글 버튼이 아닌
// select 드롭다운을 쓴다.

import { useState, useEffect, useCallback } from 'react';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';
import { adminOrderApi } from '../../api/adminOrder';

const PAGE_SIZE = 20;

// status enum → 한글 라벨 + 배지 색
const STATUS_META = {
  PENDING:   { label: '결제대기', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  PAID:      { label: '결제완료', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  SHIPPING:  { label: '배송중',   color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  DELIVERED: { label: '배송완료', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  CANCELLED: { label: '취소',     color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
};

const STATUS_FILTERS = [
  { value: '',          label: '전체' },
  { value: 'PENDING',   label: '결제대기' },
  { value: 'PAID',      label: '결제완료' },
  { value: 'SHIPPING',  label: '배송중' },
  { value: 'DELIVERED', label: '배송완료' },
  { value: 'CANCELLED', label: '취소' },
];

// 드롭다운에서 고를 수 있는 상태 (전체 제외한 5개)
const STATUS_OPTIONS = STATUS_FILTERS.filter((f) => f.value !== '');

export default function AdminOrderPage() {
  const [data, setData] = useState(null);   // PagedResponse
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminOrderApi.list({ status, page, size: PAGE_SIZE });
      setData(res);
    } catch (e) {
      setError('주문 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusFilterChange = (value) => {
    setStatus(value);
    setPage(0);
  };

  // 드롭다운으로 주문 상태 변경
  const handleStatusChange = async (order, nextStatus) => {
    if (nextStatus === order.status) return;
    const curLabel = STATUS_META[order.status]?.label || order.status;
    const nextLabel = STATUS_META[nextStatus]?.label || nextStatus;
    const ok = window.confirm(
      `주문 #${order.id}\n상태를 [${curLabel}] → [${nextLabel}] 로 변경할까요?`
    );
    if (!ok) return;

    setUpdatingId(order.id);
    try {
      await adminOrderApi.updateStatus(order.id, nextStatus);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || '상태 변경에 실패했습니다.';
      window.alert(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const fmtPrice = (v) => (v == null ? '-' : `₩${v.toLocaleString()}`);

  const fmtDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const rows = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const isFirst = data?.first ?? true;
  const isLast = data?.last ?? true;

  return (
    <div>
      {/* 헤더 */}
      <div style={S.header}>
        <h2 style={S.title}>주문 관리</h2>
        <p style={S.desc}>전체 주문 목록 · 상태 필터 · 주문 상태(결제대기 → 결제완료 → 배송중 → 배송완료 / 취소) 변경</p>
      </div>

      {/* 상태 필터 */}
      <div style={S.filterBar}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleStatusFilterChange(f.value)}
            style={{ ...S.filterBtn, ...(status === f.value ? S.filterBtnActive : {}) }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && <div style={S.errorBanner}>{error}</div>}

      {/* 총 건수 */}
      <div style={S.countLine}>
        총 <strong>{totalElements.toLocaleString()}</strong>건
      </div>

      {/* 테이블 */}
      <div style={S.tableCard}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '80px' }}>주문번호</th>
              <th style={{ ...S.th, width: '200px' }}>주문자</th>
              <th style={S.th}>상품</th>
              <th style={{ ...S.th, width: '120px' }}>총액</th>
              <th style={{ ...S.th, width: '100px' }}>상태</th>
              <th style={{ ...S.th, width: '160px' }}>주문일</th>
              <th style={{ ...S.th, width: '150px' }}>상태 변경</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={S.emptyCell}>불러오는 중...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={S.emptyCell}>주문이 없습니다.</td></tr>
            )}
            {!loading && rows.map((o) => {
              const meta = STATUS_META[o.status] || {
                label: o.status, color: colors.textOnLightDim,
                bg: colors.surfaceMuted, border: colors.borderLight,
              };
              return (
                <tr key={o.id} style={S.tr}>
                  <td style={S.td}>#{o.id}</td>
                  <td style={S.td}>{o.userEmail || '(탈퇴 회원)'}</td>
                  <td style={S.td}>{o.itemSummary}</td>
                  <td style={S.td}>{fmtPrice(o.totalPrice)}</td>
                  <td style={S.td}>
                    <span style={{
                      ...S.badge,
                      color: meta.color,
                      background: meta.bg,
                      borderColor: meta.border,
                    }}>
                      {meta.label}
                    </span>
                  </td>
                  <td style={S.td}>{fmtDate(o.createdAt)}</td>
                  <td style={S.td}>
                    <select
                      value={o.status}
                      disabled={updatingId === o.id}
                      onChange={(e) => handleStatusChange(o, e.target.value)}
                      style={{
                        ...S.select,
                        ...(updatingId === o.id ? S.selectDisabled : {}),
                      }}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이징 */}
      {totalPages > 0 && (
        <div style={S.pager}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={isFirst || loading}
            style={{ ...S.pagerBtn, ...((isFirst || loading) ? S.pagerBtnDisabled : {}) }}
          >
            ← 이전
          </button>
          <span style={S.pagerInfo}>
            {totalPages === 0 ? 0 : page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={isLast || loading}
            style={{ ...S.pagerBtn, ...((isLast || loading) ? S.pagerBtnDisabled : {}) }}
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}

const S = {
  header: {
    marginBottom: spacing[5],
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[2],
  },
  desc: {
    fontSize: typography.fontSize.base,
    color: colors.textOnLightDim,
    margin: 0,
  },
  filterBar: {
    display: 'flex',
    gap: spacing[2],
    marginBottom: spacing[4],
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLightDim,
    background: colors.white,
    // border shorthand 대신 longhand 3개로 분리 — filterBtnActive 에서 borderColor 만
    // 덮어써도 React 의 shorthand 충돌 경고(메모 #12)가 안 난다.
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    cursor: 'pointer',
  },
  filterBtnActive: {
    color: colors.white,
    background: colors.accent,
    borderColor: colors.accent,
  },
  errorBanner: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: radius.md,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
  },
  countLine: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    marginBottom: spacing[3],
  },
  tableCard: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    boxShadow: shadow.card,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
    background: colors.surfaceMuted,
    borderBottom: `1px solid ${colors.borderLight}`,
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: `1px solid ${colors.borderLight}`,
  },
  td: {
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    verticalAlign: 'middle',
  },
  emptyCell: {
    padding: `${spacing[6]} ${spacing[4]}`,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 10px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    // border shorthand 대신 longhand 3개로 분리 — 인라인에서 borderColor 만
    // 덮어써도 React 의 shorthand 충돌 경고(메모 #12)가 안 난다.
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: radius.sm,
  },
  select: {
    padding: `${spacing[1]} ${spacing[2]}`,
    fontSize: typography.fontSize.xs,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
    outline: 'none',
  },
  selectDisabled: {
    color: colors.textOnLightDim,
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    marginTop: spacing[5],
  },
  pagerBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    cursor: 'pointer',
  },
  pagerBtnDisabled: {
    color: colors.textOnLightDim,
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  pagerInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    fontVariantNumeric: 'tabular-nums',
  },
};
