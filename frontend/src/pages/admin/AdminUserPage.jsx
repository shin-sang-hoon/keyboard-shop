// frontend/src/pages/admin/AdminUserPage.jsx
//
// Phase 7-G 라운드 4 (2026-05-24) — 관리자 회원 관리.
// 7-H 회원 관리 강화 (2026-05-30) — 상태(정상/정지/탈퇴) 표시 + 정지/해제 + 상태 필터.
//
// 기능:
//   - 회원 목록 테이블 (id / 이메일 / 이름 / 권한 / 상태 / 가입경로 / 가입일)
//   - Provider 필터 (전체 / LOCAL / KAKAO) + Status 필터 (전체 / 정상 / 정지 / 탈퇴)
//   - 페이징 (이전 / 다음)
//   - role 변경 버튼 (USER ↔ ADMIN) — 본인/마지막ADMIN 은 백엔드가 400 차단
//   - 정지 / 정지 해제 버튼 — 본인/ADMIN/탈퇴 계정은 백엔드가 400 차단
//     · 정지 시 사유 입력(prompt). 탈퇴 회원은 버튼 비활성(이미 탈퇴).
//
// 디자인: swagkey 화이트 톤. AdminAuditLogPage 와 동일 톤.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';
import { adminUserApi } from '../../api/adminUser';

const PAGE_SIZE = 20;

// provider 와 status 는 백엔드가 둘 중 하나만 적용 → 단일 통합 필터로 운용.
// value 는 { provider, status } 조합. 빈 객체 = 전체.
const FILTERS = [
  { key: 'ALL',       label: '전체',          provider: '',      status: '' },
  { key: 'LOCAL',     label: '이메일',        provider: 'LOCAL', status: '' },
  { key: 'KAKAO',     label: '카카오',        provider: 'KAKAO', status: '' },
  { key: 'ACTIVE',    label: '정상',          provider: '',      status: 'ACTIVE' },
  { key: 'SUSPENDED', label: '정지',          provider: '',      status: 'SUSPENDED' },
  { key: 'WITHDRAWN', label: '탈퇴',          provider: '',      status: 'WITHDRAWN' },
];

const STATUS_LABEL = {
  ACTIVE:    '정상',
  SUSPENDED: '정지',
  WITHDRAWN: '탈퇴',
};

export default function AdminUserPage() {
  const [data, setData] = useState(null);   // PagedResponse
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterKey, setFilterKey] = useState('ALL');
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState(null);  // 작업(role/정지/해제) 중인 회원 id

  // 검색: 입력값(searchInput)과 적용된 검색어(keyword) 분리.
  // keyword 가 set 되면 list 가 검색 모드 (status/provider 무시).
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');

  const navigate = useNavigate();
  const activeFilter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUserApi.list({
        keyword,                       // 있으면 백엔드가 최우선 적용 (status/provider 무시)
        provider: activeFilter.provider,
        status: activeFilter.status,
        page,
        size: PAGE_SIZE,
      });
      setData(res);
    } catch (e) {
      setError('회원 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [keyword, activeFilter.provider, activeFilter.status, page]);

  useEffect(() => {
    load();
  }, [load]);

  // 필터 변경 → 0페이지로 리셋. 검색 모드도 해제(필터와 검색은 배타적).
  const handleFilterChange = (key) => {
    setFilterKey(key);
    setKeyword('');
    setSearchInput('');
    setPage(0);
  };

  // 검색 실행 → keyword 적용 + 필터는 '전체'로 리셋(검색이 우선이므로 UI 의미 일치).
  const handleSearch = () => {
    const kw = searchInput.trim();
    setKeyword(kw);
    setFilterKey('ALL');
    setPage(0);
  };

  // 검색 초기화
  const handleClearSearch = () => {
    setSearchInput('');
    setKeyword('');
    setPage(0);
  };

  // 회원 수정 페이지로 이동
  const goEdit = (userId) => navigate(`/admin/users/${userId}/edit`);

  // role 토글 (USER ↔ ADMIN)
  const handleToggleRole = async (user) => {
    const nextRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const ok = window.confirm(
      `${user.name} (${user.email}) 님의 권한을\n${user.role} → ${nextRole} 로 변경할까요?`
    );
    if (!ok) return;

    setBusyId(user.id);
    try {
      await adminUserApi.updateRole(user.id, nextRole);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || '권한 변경에 실패했습니다.';
      window.alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  // 정지
  const handleSuspend = async (user) => {
    const reason = window.prompt(
      `${user.name} (${user.email}) 님을 정지합니다.\n정지 사유를 입력하세요. (선택, 비워도 됨)`,
      ''
    );
    // prompt 취소 시 null → 중단. 빈 문자열("")은 사유 없이 정지 진행.
    if (reason === null) return;

    setBusyId(user.id);
    try {
      await adminUserApi.suspend(user.id, reason);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || '정지에 실패했습니다.';
      window.alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  // 정지 해제
  const handleUnsuspend = async (user) => {
    const ok = window.confirm(
      `${user.name} (${user.email}) 님의 정지를 해제할까요?`
    );
    if (!ok) return;

    setBusyId(user.id);
    try {
      await adminUserApi.unsuspend(user.id);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || '정지 해제에 실패했습니다.';
      window.alert(msg);
    } finally {
      setBusyId(null);
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

  const statusBadgeStyle = (status) => {
    if (status === 'SUSPENDED') return S.badgeSuspended;
    if (status === 'WITHDRAWN') return S.badgeWithdrawn;
    return S.badgeActive;
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
        <p style={S.desc}>회원 목록 · 가입 경로/상태 필터 · 권한 변경 · 정지/해제</p>
      </div>

      {/* 통합 필터 (provider + status) */}
      <div style={S.filterBar}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => handleFilterChange(f.key)}
            style={{
              ...S.filterBtn,
              ...(filterKey === f.key ? S.filterBtnActive : {}),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 검색창 (이름/이메일) */}
      <div style={S.searchBar}>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="이름 또는 이메일로 검색"
          style={S.searchInput}
        />
        <button type="button" onClick={handleSearch} style={S.searchBtn}>검색</button>
        {keyword && (
          <button type="button" onClick={handleClearSearch} style={S.clearBtn}>
            검색 해제
          </button>
        )}
      </div>
      {keyword && (
        <div style={S.searchNotice}>
          '<strong>{keyword}</strong>' 검색 결과 (상태/경로 필터는 적용되지 않습니다)
        </div>
      )}

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
              <th style={{ ...S.th, width: '56px' }}>ID</th>
              <th style={S.th}>이메일</th>
              <th style={{ ...S.th, width: '110px' }}>이름</th>
              <th style={{ ...S.th, width: '90px' }}>권한</th>
              <th style={{ ...S.th, width: '150px' }}>상태</th>
              <th style={{ ...S.th, width: '100px' }}>가입 경로</th>
              <th style={{ ...S.th, width: '150px' }}>가입일</th>
              <th style={{ ...S.th, width: '180px' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} style={S.emptyCell}>불러오는 중...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} style={S.emptyCell}>회원이 없습니다.</td>
              </tr>
            )}
            {!loading && rows.map((u) => {
              const isWithdrawn = u.status === 'WITHDRAWN';
              const isSuspended = u.status === 'SUSPENDED';
              const isAdmin = u.role === 'ADMIN';
              const busy = busyId === u.id;
              return (
                <tr key={u.id} style={S.tr}>
                  <td style={S.td}>{u.id}</td>
                  <td style={S.td}>{u.email}</td>
                  <td style={S.td}>{u.name}</td>
                  <td style={S.td}>
                    <span style={isAdmin ? S.badgeAdmin : S.badgeUser}>{u.role}</span>
                  </td>
                  <td style={S.td}>
                    <span style={statusBadgeStyle(u.status)}>
                      {STATUS_LABEL[u.status] ?? u.status}
                    </span>
                    {isSuspended && u.suspendReason && (
                      <div style={S.reasonText} title={u.suspendReason}>
                        {u.suspendReason}
                      </div>
                    )}
                  </td>
                  <td style={S.td}>
                    <span style={S.providerText}>{u.provider}</span>
                  </td>
                  <td style={S.td}>{fmtDate(u.createdAt)}</td>
                  <td style={S.td}>
                    <div style={S.actionCol}>
                      {/* 수정 — 탈퇴 회원은 비활성(백엔드도 차단) */}
                      <button
                        type="button"
                        onClick={() => goEdit(u.id)}
                        disabled={isWithdrawn}
                        style={{
                          ...S.actionBtn, ...S.editBtn,
                          ...(isWithdrawn ? S.actionBtnDisabled : {}),
                        }}
                      >
                        수정
                      </button>

                      {/* role 변경 — 탈퇴 회원은 비활성 */}
                      <button
                        type="button"
                        onClick={() => handleToggleRole(u)}
                        disabled={busy || isWithdrawn}
                        style={{
                          ...S.actionBtn,
                          ...((busy || isWithdrawn) ? S.actionBtnDisabled : {}),
                        }}
                      >
                        {isAdmin ? 'USER 로' : 'ADMIN 으로'}
                      </button>

                      {/* 정지 / 해제 — 탈퇴 회원은 비활성, ADMIN 은 정지 숨김 */}
                      {isSuspended ? (
                        <button
                          type="button"
                          onClick={() => handleUnsuspend(u)}
                          disabled={busy}
                          style={{
                            ...S.actionBtn, ...S.unsuspendBtn,
                            ...(busy ? S.actionBtnDisabled : {}),
                          }}
                        >
                          정지 해제
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSuspend(u)}
                          disabled={busy || isWithdrawn || isAdmin}
                          style={{
                            ...S.actionBtn, ...S.suspendBtn,
                            ...((busy || isWithdrawn || isAdmin) ? S.actionBtnDisabled : {}),
                          }}
                          title={isAdmin ? '관리자는 정지할 수 없습니다 (먼저 USER 로 변경)' : ''}
                        >
                          정지
                        </button>
                      )}
                    </div>
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
  header: { marginBottom: spacing[5] },
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
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLightDim,
    background: colors.white,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    cursor: 'pointer',
  },
  filterBtnActive: {
    color: colors.white,
    background: colors.textOnLight,
    borderColor: colors.textOnLight,
  },
  searchBar: {
    display: 'flex',
    gap: spacing[2],
    marginBottom: spacing[3],
    maxWidth: 480,
  },
  searchInput: {
    flex: 1,
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    fontFamily: 'inherit',
    color: colors.textOnLight,
    background: colors.white,
    boxSizing: 'border-box',
  },
  searchBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    background: colors.textOnLight,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.textOnLight,
    borderRadius: radius.md,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  clearBtn: {
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    background: colors.white,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  searchNotice: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    marginBottom: spacing[3],
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
  table: { width: '100%', borderCollapse: 'collapse' },
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
  tr: { borderBottom: `1px solid ${colors.borderLight}` },
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
  // 상태 뱃지 — 정상(회색)/정지(주황)/탈퇴(빨강 흐림)
  badgeActive: {
    display: 'inline-block',
    padding: '2px 10px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#047857',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: radius.sm,
  },
  badgeSuspended: {
    display: 'inline-block',
    padding: '2px 10px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#b45309',
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    borderRadius: radius.sm,
  },
  badgeWithdrawn: {
    display: 'inline-block',
    padding: '2px 10px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#94a3b8',
    background: colors.surfaceMuted,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
  },
  reasonText: {
    marginTop: '4px',
    fontSize: '11px',
    color: '#b45309',
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  providerText: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
    fontFamily: typography.fontFamily.mono,
  },
  actionCol: {
    display: 'flex',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  actionBtn: {
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    background: colors.white,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.borderLight,
    borderRadius: radius.sm,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  editBtn: {
    color: colors.textOnLight,
    borderColor: colors.textOnLight,
    fontWeight: typography.fontWeight.semibold,
  },
  suspendBtn: {
    color: '#b45309',
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  unsuspendBtn: {
    color: '#047857',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  actionBtnDisabled: {
    color: colors.textOnLightDim,
    cursor: 'not-allowed',
    opacity: 0.5,
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
