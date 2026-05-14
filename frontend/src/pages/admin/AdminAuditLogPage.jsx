// frontend/src/pages/admin/AdminAuditLogPage.jsx
//
// Phase 7 [9-2B] - AuditLog 뷰어 프론트 (5/14 학원).
//
// 백엔드 짝꿍:
//   - GET /api/admin/audit-logs (페이징 + 필터)
//   - GET /api/admin/audit-logs/{id} (단건 상세 detail JSON)
//   - AdminAuditLogController (5/12 commit f86df20)
//
// 면접 자산:
//   - 서버 필터링 (클라이언트 필터링 X) → 페이지 컷오프 없이 전체 데이터셋 검색.
//   - detail JSON 은 목록에 안 실어서 페이로드 절감 (5-G PagedResponse 일관성).
//   - password ***MASKED*** 가 detail JSON 안에 보이는 게 7-A 마스킹의 운영 증거.
//   - 필터 변경 시 page=0 으로 리셋 (UX 표준 — 5페이지에서 카테고리 바꿨는데
//     여전히 5페이지 보여주면 결과 비어보임).
//   - 상세 조회는 모달 오픈 시점에만 fetch (목록 클릭 → API 호출 → JSON 렌더).
//
// MVP 범위:
//   - 필터: category / eventType / result / adminId / dateFrom / dateTo
//   - 표: 시각, 관리자, 카테고리, 이벤트, 대상, IP, 결과, 처리시간
//   - 페이징: prev/next + 현재 페이지/총 페이지
//   - 모달: 메타 좌측 + detail JSON 우측 pretty print
//   - 라우트: /admin/audit-logs (ProtectedRoute + ADMIN role 가드)

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import auditLogApi from '../../api/auditLog';
import { colors, typography, spacing, radius } from '../../styles/tokens';

const CATEGORIES = ['', 'PRODUCT', 'USER', 'ORDER', 'CRAWLER', 'CHATBOT'];
const EVENT_TYPES = ['', 'CREATE', 'UPDATE', 'DELETE', 'BLOCK', 'UNBLOCK', 'EXECUTE', 'VIEW'];
const RESULTS = ['', 'SUCCESS', 'FAILURE'];

// 필터 상태 초기값. 빈 문자열은 API 호출 시 자동 제거 (auditLog.js cleaned 로직).
const INITIAL_FILTERS = {
  category: '',
  eventType: '',
  result: '',
  adminId: '',
  dateFrom: '',
  dateTo: '',
};

const PAGE_SIZE = 20;

export default function AdminAuditLogPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(0);

  const [data, setData] = useState(null); // PagedResponse
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 상세 모달 상태
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters, page, size: PAGE_SIZE };
      const res = await auditLogApi.list(params);
      setData(res);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError('관리자 권한이 필요합니다. 로그인 상태를 확인해주세요.');
      } else {
        setError('감사 로그를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0); // 필터 바뀌면 page=0 으로 리셋 (UX 표준)
  }

  function handleReset() {
    setFilters(INITIAL_FILTERS);
    setPage(0);
  }

  async function handleRowClick(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const res = await auditLogApi.getDetail(id);
      setDetail(res);
    } catch (err) {
      setDetailError('상세 정보를 불러오지 못했어요.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeModal() {
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <h1 style={S.title}>감사 로그</h1>
          <p style={S.subtitle}>
            관리자 액션 자동 기록 (Phase 7-A AuditLog @Aspect)
          </p>
        </header>

        {/* 필터 영역 */}
        <section style={S.filterBox}>
          <div style={S.filterGrid}>
            <FilterSelect
              label="카테고리"
              value={filters.category}
              onChange={(v) => handleFilterChange('category', v)}
              options={CATEGORIES}
            />
            <FilterSelect
              label="이벤트"
              value={filters.eventType}
              onChange={(v) => handleFilterChange('eventType', v)}
              options={EVENT_TYPES}
            />
            <FilterSelect
              label="결과"
              value={filters.result}
              onChange={(v) => handleFilterChange('result', v)}
              options={RESULTS}
            />
            <FilterInput
              label="관리자 ID"
              type="number"
              value={filters.adminId}
              onChange={(v) => handleFilterChange('adminId', v)}
              placeholder="숫자 입력"
            />
            <FilterInput
              label="시작 시각"
              type="datetime-local"
              value={filters.dateFrom}
              onChange={(v) => handleFilterChange('dateFrom', v)}
            />
            <FilterInput
              label="종료 시각"
              type="datetime-local"
              value={filters.dateTo}
              onChange={(v) => handleFilterChange('dateTo', v)}
            />
          </div>
          <div style={S.filterActions}>
            <button type="button" onClick={handleReset} style={S.resetBtn}>
              초기화
            </button>
          </div>
        </section>

        {/* 결과 요약 */}
        <div style={S.summary}>
          {data
            ? `총 ${data.totalElements ?? data.content?.length ?? 0}건`
            : loading
            ? '불러오는 중...'
            : '—'}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {/* 표 */}
        <section style={S.tableBox}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>시각</th>
                <th style={S.th}>관리자</th>
                <th style={S.th}>카테고리</th>
                <th style={S.th}>이벤트</th>
                <th style={S.th}>대상</th>
                <th style={S.th}>IP</th>
                <th style={S.th}>결과</th>
                <th style={S.thRight}>⏱ ms</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} style={S.tdEmpty}>
                    불러오는 중...
                  </td>
                </tr>
              )}
              {!loading && data?.content?.length === 0 && (
                <tr>
                  <td colSpan={8} style={S.tdEmpty}>
                    조건에 맞는 감사 로그가 없습니다
                  </td>
                </tr>
              )}
              {!loading &&
                data?.content?.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleRowClick(row.id)}
                    style={S.tr}
                  >
                    <td style={S.td}>{formatDateTime(row.createdAt)}</td>
                    <td style={S.td}>{row.adminEmail ?? `#${row.adminId}`}</td>
                    <td style={S.td}>
                      <span style={S.chip}>{row.category}</span>
                    </td>
                    <td style={S.td}>
                      <span style={S.chip}>{row.eventType}</span>
                    </td>
                    <td style={S.td}>
                      {row.targetType}
                      {row.targetId ? ` #${row.targetId}` : ''}
                    </td>
                    <td style={S.tdMono}>{row.ipAddress || '-'}</td>
                    <td style={S.td}>
                      <span style={resultBadgeStyle(row.result)}>
                        {row.result}
                      </span>
                    </td>
                    <td style={S.tdRight}>
                      {row.durationMs != null ? row.durationMs : '-'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        {/* 페이지네이션 */}
        {data && data.totalPages > 0 && (
          <div style={S.pagination}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              style={{
                ...S.pageBtn,
                ...(page === 0 || loading ? S.pageBtnDisabled : {}),
              }}
            >
              ← 이전
            </button>
            <span style={S.pageInfo}>
              {page + 1} / {data.totalPages || 1}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={(data.last ?? page + 1 >= data.totalPages) || loading}
              style={{
                ...S.pageBtn,
                ...((data.last ?? page + 1 >= data.totalPages) || loading
                  ? S.pageBtnDisabled
                  : {}),
              }}
            >
              다음 →
            </button>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedId != null && (
        <div style={S.modalBackdrop} onClick={closeModal}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <header style={S.modalHeader}>
              <h2 style={S.modalTitle}>감사 로그 #{selectedId}</h2>
              <button type="button" onClick={closeModal} style={S.modalClose}>
                ×
              </button>
            </header>

            <div style={S.modalBody}>
              {detailLoading && <p style={S.modalLoading}>불러오는 중...</p>}
              {detailError && <div style={S.errorBox}>{detailError}</div>}

              {detail && (
                <div style={S.modalGrid}>
                  {/* 좌측 메타 */}
                  <div style={S.metaCol}>
                    <MetaRow label="시각" value={formatDateTime(detail.createdAt)} />
                    <MetaRow label="관리자" value={detail.adminEmail || `#${detail.adminId}`} />
                    <MetaRow label="카테고리" value={detail.category} />
                    <MetaRow label="이벤트" value={detail.eventType} />
                    <MetaRow
                      label="대상"
                      value={`${detail.targetType ?? '-'}${
                        detail.targetId ? ` #${detail.targetId}` : ''
                      }`}
                    />
                    <MetaRow label="IP" value={detail.ipAddress || '-'} mono />
                    <MetaRow
                      label="결과"
                      value={
                        <span style={resultBadgeStyle(detail.result)}>
                          {detail.result}
                        </span>
                      }
                    />
                    <MetaRow
                      label="처리 시간"
                      value={detail.durationMs != null ? `${detail.durationMs} ms` : '-'}
                    />
                    <MetaRow label="User-Agent" value={detail.userAgent || '-'} mono small />
                  </div>

                  {/* 우측 detail JSON */}
                  <div style={S.detailCol}>
                    <div style={S.detailLabel}>Detail JSON (마스킹 적용)</div>
                    <pre style={S.detailPre}>{prettyJson(detail.detail)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 보조 컴포넌트
// =====================================================================

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label style={S.filterField}>
      <span style={S.filterLabel}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={S.filterInput}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === '' ? '전체' : opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <label style={S.filterField}>
      <span style={S.filterLabel}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={S.filterInput}
      />
    </label>
  );
}

function MetaRow({ label, value, mono = false, small = false }) {
  return (
    <div style={S.metaRow}>
      <span style={S.metaLabel}>{label}</span>
      <span style={{
        ...S.metaValue,
        ...(mono ? S.metaValueMono : {}),
        ...(small ? S.metaValueSmall : {}),
      }}>
        {value}
      </span>
    </div>
  );
}

// =====================================================================
// 유틸
// =====================================================================

function formatDateTime(iso) {
  if (!iso) return '-';
  // 백엔드가 ISO 8601 보낸다고 가정 (Spring LocalDateTime 직렬화 기본)
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function prettyJson(jsonStr) {
  if (!jsonStr) return '(detail 없음)';
  try {
    const parsed = JSON.parse(jsonStr);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // 파싱 실패해도 원본 보여줌 (백엔드 마스킹 실패 케이스 등 디버그용)
    return jsonStr;
  }
}

function resultBadgeStyle(result) {
  if (result === 'SUCCESS') return S.badgeSuccess;
  if (result === 'FAILURE') return S.badgeFailure;
  return S.badgeNeutral;
}

// =====================================================================
// 스타일 - LIGHT 톤. tokens.js 디자인 시스템 따름.
// =====================================================================

const S = {
  page: {
    minHeight: '100vh',
    background: colors.surface,
    fontFamily: typography.fontFamily.base,
    padding: spacing[6],
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
  },
  header: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    marginTop: spacing[1],
  },

  filterBox: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: spacing[5],
    marginBottom: spacing[4],
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: spacing[3],
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
  },
  filterLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
  },
  filterInput: {
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    color: colors.textOnLight,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  filterActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: spacing[4],
  },
  resetBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    background: colors.white,
    color: colors.textOnLight,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  summary: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    marginBottom: spacing[3],
  },

  errorBox: {
    background: '#fef2f2',
    border: `1px solid #fecaca`,
    color: '#b91c1c',
    padding: spacing[3],
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
  },

  tableBox: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: typography.fontSize.sm,
  },
  th: {
    textAlign: 'left',
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
    borderBottom: `1px solid ${colors.borderLight}`,
    whiteSpace: 'nowrap',
    background: colors.surface,
  },
  thRight: {
    textAlign: 'right',
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
    borderBottom: `1px solid ${colors.borderLight}`,
    whiteSpace: 'nowrap',
    background: colors.surface,
  },
  tr: {
    cursor: 'pointer',
    borderBottom: `1px solid ${colors.borderLight}`,
    transition: 'background 0.1s ease',
  },
  td: {
    padding: `${spacing[3]} ${spacing[4]}`,
    color: colors.textOnLight,
    verticalAlign: 'middle',
  },
  tdRight: {
    padding: `${spacing[3]} ${spacing[4]}`,
    color: colors.textOnLight,
    verticalAlign: 'middle',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  tdMono: {
    padding: `${spacing[3]} ${spacing[4]}`,
    color: colors.textOnLight,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: typography.fontSize.xs,
  },
  tdEmpty: {
    padding: spacing[8],
    textAlign: 'center',
    color: colors.textOnLightDim,
  },

  chip: {
    display: 'inline-block',
    padding: `2px ${spacing[2]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    background: colors.surface,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    color: colors.textOnLight,
  },

  badgeSuccess: {
    display: 'inline-block',
    padding: `2px ${spacing[2]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    background: '#ecfdf5',
    color: '#047857',
    border: `1px solid #a7f3d0`,
    borderRadius: radius.sm,
  },
  badgeFailure: {
    display: 'inline-block',
    padding: `2px ${spacing[2]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    background: '#fef2f2',
    color: '#b91c1c',
    border: `1px solid #fecaca`,
    borderRadius: radius.sm,
  },
  badgeNeutral: {
    display: 'inline-block',
    padding: `2px ${spacing[2]}`,
    fontSize: typography.fontSize.xs,
    background: colors.surface,
    color: colors.textOnLightDim,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
  },

  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[4],
    marginTop: spacing[5],
  },
  pageBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    background: colors.white,
    color: colors.textOnLight,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  pageBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  pageInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 80,
    textAlign: 'center',
  },

  // 모달
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    zIndex: 1000,
  },
  modalCard: {
    background: colors.white,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 1000,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing[5]} ${spacing[6]}`,
    borderBottom: `1px solid ${colors.borderLight}`,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    fontSize: 28,
    cursor: 'pointer',
    color: colors.textOnLightDim,
    lineHeight: 1,
    padding: 0,
    width: 32,
    height: 32,
  },
  modalBody: {
    padding: spacing[6],
    overflow: 'auto',
  },
  modalLoading: {
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    padding: spacing[6],
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: spacing[6],
  },
  metaCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[3],
  },
  metaRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
  },
  metaLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
  },
  metaValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    wordBreak: 'break-word',
  },
  metaValueMono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  metaValueSmall: {
    fontSize: typography.fontSize.xs,
  },
  detailCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    minWidth: 0, // grid 자식 overflow 방지
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
  },
  detailPre: {
    margin: 0,
    padding: spacing[4],
    background: colors.surface,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.xs,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: colors.textOnLight,
    lineHeight: 1.6,
    maxHeight: 500,
    overflow: 'auto',
    whiteSpace: 'pre',
  },
};
