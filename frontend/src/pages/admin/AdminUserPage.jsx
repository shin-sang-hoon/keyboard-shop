// frontend/src/pages/admin/AdminUserPage.jsx
//
// Phase 7-G 라운드 4 (2026-05-24) — 관리자 회원 관리.
//
// 기능:
//   - 회원 목록 테이블 (id / 이메일 / 이름 / 권한 / 가입경로 / 가입일)
//   - Provider 필터 (전체 / LOCAL / KAKAO)
//   - 페이징 (이전 / 다음)
//   - role 변경 버튼 (USER ↔ ADMIN) — 본인은 백엔드가 400 으로 차단
//
// 디자인: swagkey 화이트 톤. AdminAuditLogPage 와 동일 톤.

import { useState, useEffect, useCallback } from 'react';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';
import { adminUserApi } from '../../api/adminUser';

const PAGE_SIZE = 20;

const PROVIDER_FILTERS = [
  { value: '',      label: '전체' },
  { value: 'LOCAL', label: '이메일 (LOCAL)' },
  { value: 'KAKAO', label: '카카오 (KAKAO)' },
];

export default function AdminUserPage() {
  const [data, setData] = useState(null);   // PagedResponse
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('');
  const [page, setPage] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);  // role 변경 중인 회원 id

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUserApi.list({ provider, page, size: PAGE_SIZE });
      setData(res);
    } catch (e) {
      setError('회원 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [provider, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Provider 필터 변경 → 0페이지로 리셋
  const handleProviderChange = (value) => {
    setProvider(value);
    setPage(0);
  };

  // role 토글 (USER ↔ ADMIN)
  const handleToggleRole = async (user) => {
    const nextRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const ok = window.confirm(
      `${user.name} (${user.email}) 님의 권한을\n${user.role} → ${nextRole} 로 변경할까요?`
    );
    if (!ok) return;

    setUpdatingId(user.id);
    try {
      await adminUserApi.updateRole(user.id, nextRole);
      await load();  // 변경 후 목록 새로고침
    } catch (e) {
      // 백엔드 400 (본인 권한 변경 차단 등) 메시지 노출
      const msg = e?.response?.data?.message || '권한 변경에 실패했습니다.';
      window.alert(msg);
    } finally {
      setUpdatingId(null);
    }
  };

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
        <h2 style={S.title}>회원 관리</h2>
        <p style={S.desc}>전체 회원 목록 · 가입 경로 필터 · 권한(USER / ADMIN) 변경</p>
      </div>

      {/* Provider 필터 */}
      <div style={S.filterBar}>
        {PROVIDER_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleProviderChange(f.value)}
            style={{
              ...S.filterBtn,
              ...(provider === f.value ? S.filterBtnActive : {}),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && <div style={S.errorBanner}>{error}</div>}

      {/* 총 건수 */}
      <div style={S.countLine}>
        총 <strong>{totalElements.toLocaleString()}</strong>명
      </div>

      {/* 테이블 */}
      <div style={S.tableCard}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '60px' }}>ID</th>
              <th style={S.th}>이메일</th>
              <th style={{ ...S.th, width: '120px' }}>이름</th>
              <th style={{ ...S.th, width: '100px' }}>권한</th>
              <th style={{ ...S.th, width: '120px' }}>가입 경로</th>
              <th style={{ ...S.th, width: '160px' }}>가입일</th>
              <th style={{ ...S.th, width: '140px' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={S.emptyCell}>불러오는 중...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} style={S.emptyCell}>회원이 없습니다.</td>
              </tr>
            )}
            {!loading && rows.map((u) => (
              <tr key={u.id} style={S.tr}>
                <td style={S.td}>{u.id}</td>
                <td style={S.td}>{u.email}</td>
                <td style={S.td}>{u.name}</td>
                <td style={S.td}>
                  <span style={u.role === 'ADMIN' ? S.badgeAdmin : S.badgeUser}>
                    {u.role}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={S.providerText}>{u.provider}</span>
                </td>
                <td style={S.td}>{fmtDate(u.createdAt)}</td>
                <td style={S.td}>
                  <button
                    type="button"
                    onClick={() => handleToggleRole(u)}
                    disabled={updatingId === u.id}
                    style={{
                      ...S.roleBtn,
                      ...(updatingId === u.id ? S.roleBtnDisabled : {}),
                    }}
                  >
                    {updatingId === u.id
                      ? '변경 중...'
                      : u.role === 'ADMIN' ? 'USER 로 변경' : 'ADMIN 으로 변경'}
                  </button>
                </td>
              </tr>
            ))}
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
  },
  filterBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLightDim,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
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
  badgeAdmin: {
    display: 'inline-block',
    padding: '2px 10px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#dc2626',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: radius.sm,
  },
  badgeUser: {
    display: 'inline-block',
    padding: '2px 10px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
    background: colors.surfaceMuted,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
  },
  providerText: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
    fontFamily: typography.fontFamily.mono,
  },
  roleBtn: {
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  roleBtnDisabled: {
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
