// frontend/src/pages/admin/AdminProductPage.jsx
//
// Phase 7-G 라운드 5 (2026-05-25) — 관리자 상품 관리.
// P1 (2026-05-27) — 브랜드 연동: 브랜드 컬럼을 읽기전용 → 드롭다운으로 전환.
//
// 기능:
//   - 상품 목록 테이블 (썸네일 / 이름 / 브랜드 / 타입 / 가격 / 재고 / 상태)
//   - 검색 (상품명) — 입력 후 Enter 또는 검색 버튼
//   - status 필터 (전체 / ACTIVE / INACTIVE)
//   - productType 필터 (전체 / KEYBOARD / KEYCAP / SWITCH_PART / ACCESSORY)
//   - 페이징 (이전 / 다음)
//   - 상태 토글 버튼 (ACTIVE ↔ INACTIVE)
//   - [P1] 브랜드 드롭다운 — 선택 즉시 PATCH /api/admin/products/{id}/brand 저장
//
// 디자인: swagkey 화이트 톤. AdminUserPage 와 동일 톤.

import { useState, useEffect, useCallback } from 'react';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';
import { adminProductApi } from '../../api/adminProduct';
import { adminBrandApi } from '../../api/adminBrand';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: '',         label: '전체' },
  { value: 'ACTIVE',   label: '판매중' },
  { value: 'INACTIVE', label: '숨김' },
];

const TYPE_FILTERS = [
  { value: '',            label: '전체 타입' },
  { value: 'KEYBOARD',    label: '키보드' },
  { value: 'KEYCAP',      label: '키캡' },
  { value: 'SWITCH_PART', label: '스위치' },
  { value: 'ACCESSORY',   label: '액세서리' },
];

export default function AdminProductPage() {
  const [data, setData] = useState(null);   // PagedResponse
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [productType, setProductType] = useState('');
  const [searchInput, setSearchInput] = useState('');   // 입력 중인 값
  const [search, setSearch] = useState('');             // 실제 적용된 검색어
  const [page, setPage] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);

  // [P1] 브랜드 드롭다운 — 옵션 목록 + 변경 중 행 표시
  const [brands, setBrands] = useState([]);
  const [brandUpdatingId, setBrandUpdatingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminProductApi.list({
        status, productType, search, page, size: PAGE_SIZE,
      });
      setData(res);
    } catch (e) {
      setError('상품 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [status, productType, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // [P1] 브랜드 드롭다운 옵션 — 마운트 시 1회 로드
  useEffect(() => {
    let cancelled = false;
    adminBrandApi.list()
      .then((list) => { if (!cancelled) setBrands(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setBrands([]); });
    return () => { cancelled = true; };
  }, []);

  // 필터 변경 → 0페이지로 리셋
  const handleStatusChange = (value) => {
    setStatus(value);
    setPage(0);
  };
  const handleTypeChange = (value) => {
    setProductType(value);
    setPage(0);
  };

  // 검색 실행 (Enter 또는 버튼)
  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(0);
  };
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };
  const handleSearchReset = () => {
    setSearchInput('');
    setSearch('');
    setPage(0);
  };

  // 상태 토글 (ACTIVE ↔ INACTIVE)
  const handleToggleStatus = async (product) => {
    const nextStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = nextStatus === 'ACTIVE' ? '판매중으로' : '숨김으로';
    const ok = window.confirm(
      `[${product.name}]\n상품을 ${actionLabel} 변경할까요?`
    );
    if (!ok) return;

    setUpdatingId(product.id);
    try {
      await adminProductApi.updateStatus(product.id, nextStatus);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || '상태 변경에 실패했습니다.';
      window.alert(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  // [P1] 브랜드 변경 (드롭다운 선택 → 즉시 저장)
  const handleBrandChange = async (product, rawValue) => {
    // rawValue: '' (미지정) 또는 brandId 문자열
    const newBrandId = rawValue === '' ? null : Number(rawValue);
    // 현재 값과 같으면 무시 (불필요한 요청 방지)
    if ((product.brandId ?? null) === newBrandId) return;

    setBrandUpdatingId(product.id);
    try {
      await adminProductApi.updateBrand(product.id, newBrandId);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || '브랜드 변경에 실패했습니다.';
      window.alert(msg);
    } finally {
      setBrandUpdatingId(null);
    }
  };

  const fmtPrice = (v) => (v == null ? '-' : `₩${v.toLocaleString()}`);

  const fmtDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
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
        <h2 style={S.title}>상품 관리</h2>
        <p style={S.desc}>전체 상품 목록 · 타입/상태 필터 · 검색 · 노출 상태(판매중 / 숨김) 토글 · 브랜드 연동</p>
      </div>

      {/* 검색 + 필터 */}
      <div style={S.controls}>
        <div style={S.searchRow}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="상품명 검색"
            style={S.searchInput}
          />
          <button type="button" onClick={handleSearch} style={S.searchBtn}>검색</button>
          {search && (
            <button type="button" onClick={handleSearchReset} style={S.resetBtn}>
              초기화
            </button>
          )}
        </div>

        <div style={S.filterRow}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => handleStatusChange(f.value)}
              style={{ ...S.filterBtn, ...(status === f.value ? S.filterBtnActive : {}) }}
            >
              {f.label}
            </button>
          ))}
          <span style={S.filterDivider} />
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => handleTypeChange(f.value)}
              style={{ ...S.filterBtn, ...(productType === f.value ? S.filterBtnActive : {}) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 에러 */}
      {error && <div style={S.errorBanner}>{error}</div>}

      {/* 총 건수 */}
      <div style={S.countLine}>
        총 <strong>{totalElements.toLocaleString()}</strong>개
      </div>

      {/* 테이블 */}
      <div style={S.tableCard}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '60px' }}>ID</th>
              <th style={{ ...S.th, width: '64px' }}>이미지</th>
              <th style={S.th}>상품명</th>
              <th style={{ ...S.th, width: '160px' }}>브랜드</th>
              <th style={{ ...S.th, width: '110px' }}>타입</th>
              <th style={{ ...S.th, width: '110px' }}>가격</th>
              <th style={{ ...S.th, width: '90px' }}>상태</th>
              <th style={{ ...S.th, width: '140px' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={S.emptyCell}>불러오는 중...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} style={S.emptyCell}>상품이 없습니다.</td></tr>
            )}
            {!loading && rows.map((p) => (
              <tr key={p.id} style={S.tr}>
                <td style={S.td}>{p.id}</td>
                <td style={S.td}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" style={S.thumb} />
                  ) : (
                    <div style={S.thumbEmpty}>—</div>
                  )}
                </td>
                <td style={S.td}>{p.name}</td>
                <td style={S.td}>
                  {/* [P1] 브랜드 드롭다운 — 선택 즉시 저장 */}
                  <select
                    value={p.brandId ?? ''}
                    onChange={(e) => handleBrandChange(p, e.target.value)}
                    disabled={brandUpdatingId === p.id}
                    style={{
                      ...S.brandSelect,
                      ...(brandUpdatingId === p.id ? S.brandSelectDisabled : {}),
                    }}
                    aria-label="브랜드 선택"
                  >
                    <option value="">(미지정)</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </td>
                <td style={S.td}>
                  <span style={S.typeText}>{p.productType || '-'}</span>
                </td>
                <td style={S.td}>{fmtPrice(p.price)}</td>
                <td style={S.td}>
                  <span style={p.status === 'ACTIVE' ? S.badgeActive : S.badgeInactive}>
                    {p.status === 'ACTIVE' ? '판매중' : p.status === 'INACTIVE' ? '숨김' : p.status}
                  </span>
                </td>
                <td style={S.td}>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(p)}
                    disabled={updatingId === p.id}
                    style={{ ...S.toggleBtn, ...(updatingId === p.id ? S.toggleBtnDisabled : {}) }}
                  >
                    {updatingId === p.id
                      ? '변경 중...'
                      : p.status === 'ACTIVE' ? '숨김 처리' : '판매 활성화'}
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
  controls: {
    marginBottom: spacing[4],
  },
  searchRow: {
    display: 'flex',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  searchInput: {
    width: '280px',
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    outline: 'none',
  },
  searchBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.white,
    background: colors.accent,
    border: `1px solid ${colors.accent}`,
    borderRadius: radius.md,
    cursor: 'pointer',
  },
  resetBtn: {
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    cursor: 'pointer',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: `${spacing[2]} ${spacing[3]}`,
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
  filterDivider: {
    width: '1px',
    height: '20px',
    background: colors.borderLight,
    margin: `0 ${spacing[1]}`,
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
  thumb: {
    width: '40px',
    height: '40px',
    objectFit: 'cover',
    borderRadius: radius.sm,
    border: `1px solid ${colors.borderLight}`,
    background: colors.surfaceMuted,
  },
  thumbEmpty: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    border: `1px solid ${colors.borderLight}`,
    background: colors.surfaceMuted,
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.xs,
  },
  emptyCell: {
    padding: `${spacing[6]} ${spacing[4]}`,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  typeText: {
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
    fontFamily: typography.fontFamily.mono,
  },
  // [P1] 브랜드 드롭다운
  brandSelect: {
    width: '100%',
    padding: `${spacing[1]} ${spacing[2]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
  },
  brandSelectDisabled: {
    color: colors.textOnLightDim,
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  badgeActive: {
    display: 'inline-block',
    padding: '2px 10px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#047857',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: radius.sm,
  },
  badgeInactive: {
    display: 'inline-block',
    padding: '2px 10px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
    background: colors.surfaceMuted,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
  },
  toggleBtn: {
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
  toggleBtnDisabled: {
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
