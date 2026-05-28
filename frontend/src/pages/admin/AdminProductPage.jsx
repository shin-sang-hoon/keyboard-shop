// frontend/src/pages/admin/AdminProductPage.jsx
//
// Phase 7-G 라운드 5 (2026-05-25) — 관리자 상품 관리.
// P1 (2026-05-27) — 브랜드 연동: 브랜드 컬럼을 읽기전용 → 드롭다운으로 전환.
// P1 (2026-05-28) — 재고/품절 (B-1 방식):
//   · 라벨 '타입' → '카테고리'
//   · 상태 필터에 [품절] 추가 (status=ACTIVE & soldOut=true)
//   · 상태 표시 3가지: 판매중(ACTIVE+stock>0) / 품절(ACTIVE+stock=0) / 숨김(INACTIVE)
//   · 재고 컬럼 + [품절 처리]/[판매 재개] 버튼 (stock 0↔양수, status 는 안 건드림)
//
// 기능:
//   - 상품 목록 테이블 (썸네일 / 이름 / 브랜드 / 카테고리 / 가격 / 재고 / 상태)
//   - 검색 (상품명) — 입력 후 Enter 또는 검색 버튼
//   - status/품절 필터 (전체 / 판매중 / 품절 / 숨김)
//   - productType 필터 (전체 / KEYBOARD / KEYCAP / SWITCH_PART / ACCESSORY)
//   - 페이징 (이전 / 다음)
//   - 노출 토글 버튼 (ACTIVE ↔ INACTIVE) — 기존 숨김 기능 그대로
//   - 재고 토글 버튼 (품절 ↔ 판매 재개) — stock 0↔양수
//   - [P1] 브랜드 드롭다운 — 선택 즉시 PATCH /api/admin/products/{id}/brand 저장
//
// 디자인: swagkey 화이트 톤. AdminUserPage 와 동일 톤.

import { useState, useEffect, useCallback } from 'react';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';
import { adminProductApi, DEFAULT_RESTOCK } from '../../api/adminProduct';
import { adminBrandApi } from '../../api/adminBrand';

const PAGE_SIZE = 20;

// 상태/품절 필터.
//   - 'ALL'      : 전체 (status 없음, soldOut 없음)
//   - 'ACTIVE'   : 판매중 — status=ACTIVE, soldOut=false (재고 있는 ACTIVE 만)
//   - 'SOLDOUT'  : 품절   — status=ACTIVE, soldOut=true  (재고 0 인 ACTIVE 만)
//   - 'INACTIVE' : 숨김   — status=INACTIVE
// 품절은 ProductStatus 값이 아니라 stock 으로 판정하므로(B-1), 단순 status 값이 아닌
// '필터 키' 로 관리하고 load() 에서 status/soldOut 쿼리로 변환한다.
const STATUS_FILTERS = [
  { key: 'ALL',      label: '전체' },
  { key: 'ACTIVE',   label: '판매중' },
  { key: 'SOLDOUT',  label: '품절' },
  { key: 'INACTIVE', label: '숨김' },
];

const TYPE_FILTERS = [
  { value: '',            label: '전체 카테고리' },
  { value: 'KEYBOARD',    label: '키보드' },
  { value: 'KEYCAP',      label: '키캡' },
  { value: 'SWITCH_PART', label: '스위치' },
  { value: 'ACCESSORY',   label: '액세서리' },
];

// 필터 키 → 백엔드 쿼리 파라미터 변환.
function filterKeyToParams(key) {
  switch (key) {
    case 'ACTIVE':   return { status: 'ACTIVE',   soldOut: false };
    case 'SOLDOUT':  return { status: 'ACTIVE',   soldOut: true };
    case 'INACTIVE': return { status: 'INACTIVE', soldOut: undefined };
    case 'ALL':
    default:         return { status: '',          soldOut: undefined };
  }
}

// 상품 1행의 표시 상태 판정 (B-1):
//   INACTIVE            → '숨김'
//   ACTIVE & stock===0  → '품절'
//   ACTIVE & stock>0/NULL → '판매중'
function deriveDisplayStatus(p) {
  if (p.status === 'INACTIVE') return 'HIDDEN';
  if (p.status === 'ACTIVE' && p.stock === 0) return 'SOLDOUT';
  if (p.status === 'ACTIVE') return 'ONSALE';
  return 'OTHER'; // SOLD_OUT enum 등 예외 — 거의 없음
}

export default function AdminProductPage() {
  const [data, setData] = useState(null);   // PagedResponse
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterKey, setFilterKey] = useState('ALL');   // ALL / ACTIVE / SOLDOUT / INACTIVE
  const [productType, setProductType] = useState('');
  const [searchInput, setSearchInput] = useState('');   // 입력 중인 값
  const [search, setSearch] = useState('');             // 실제 적용된 검색어
  const [page, setPage] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);       // 노출 토글 중
  const [stockUpdatingId, setStockUpdatingId] = useState(null); // 재고 토글 중

  // [P1] 브랜드 드롭다운 — 옵션 목록 + 변경 중 행 표시
  const [brands, setBrands] = useState([]);
  const [brandUpdatingId, setBrandUpdatingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status, soldOut } = filterKeyToParams(filterKey);
      const res = await adminProductApi.list({
        status, productType, search, soldOut, page, size: PAGE_SIZE,
      });
      setData(res);
    } catch (e) {
      setError('상품 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filterKey, productType, search, page]);

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
  const handleFilterChange = (key) => {
    setFilterKey(key);
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

  // 상태 토글 (ACTIVE ↔ INACTIVE) — 기존 숨김 기능 그대로 (안 건드림)
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

  // 재고 토글 (품절 처리 ↔ 판매 재개) — stock 0↔양수. status 는 안 건드림 (B-1)
  const handleToggleStock = async (product) => {
    const isSoldOut = product.stock === 0;
    const nextStock = isSoldOut ? DEFAULT_RESTOCK : 0;
    const actionLabel = isSoldOut
      ? `판매 재개할까요? (재고 ${DEFAULT_RESTOCK}개로 설정)`
      : '품절 처리할까요? (재고 0)';
    const ok = window.confirm(`[${product.name}]\n${actionLabel}`);
    if (!ok) return;

    setStockUpdatingId(product.id);
    try {
      await adminProductApi.updateStock(product.id, nextStock);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || '재고 변경에 실패했습니다.';
      window.alert(msg);
    } finally {
      setStockUpdatingId(null);
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

  // productType enum → 한글 카테고리 라벨 (TYPE_FILTERS 재사용, 없으면 원문)
  const fmtCategory = (type) => {
    if (!type) return '-';
    const found = TYPE_FILTERS.find((f) => f.value === type);
    return found ? found.label : type;
  };

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
        <p style={S.desc}>전체 상품 목록 · 카테고리/상태 필터 · 검색 · 노출 토글(판매중 / 숨김) · 재고 토글(품절 / 판매 재개) · 브랜드 연동</p>
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
              key={f.key}
              type="button"
              onClick={() => handleFilterChange(f.key)}
              style={{ ...S.filterBtn, ...(filterKey === f.key ? S.filterBtnActive : {}) }}
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
              <th style={{ ...S.th, width: '100px' }}>카테고리</th>
              <th style={{ ...S.th, width: '100px' }}>가격</th>
              <th style={{ ...S.th, width: '80px' }}>재고</th>
              <th style={{ ...S.th, width: '90px' }}>상태</th>
              <th style={{ ...S.th, width: '200px' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={S.emptyCell}>불러오는 중...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} style={S.emptyCell}>상품이 없습니다.</td></tr>
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
                  <span style={S.typeText}>{fmtCategory(p.productType)}</span>
                </td>
                <td style={S.td}>{fmtPrice(p.price)}</td>
                <td style={S.td}>
                  {/* 재고: NULL=정보없음, 0=품절(빨강), 양수=개수 */}
                  {p.stock == null ? (
                    <span style={S.stockNull}>—</span>
                  ) : p.stock === 0 ? (
                    <span style={S.stockZero}>품절</span>
                  ) : (
                    <span style={S.stockNormal}>{p.stock}개</span>
                  )}
                </td>
                <td style={S.td}>
                  {/* 상태 3표시 (B-1): 숨김 / 품절 / 판매중 */}
                  {(() => {
                    const ds = deriveDisplayStatus(p);
                    if (ds === 'HIDDEN') return <span style={S.badgeInactive}>숨김</span>;
                    if (ds === 'SOLDOUT') return <span style={S.badgeSoldOut}>품절</span>;
                    if (ds === 'ONSALE') return <span style={S.badgeActive}>판매중</span>;
                    return <span style={S.badgeInactive}>{p.status || '-'}</span>;
                  })()}
                </td>
                <td style={S.td}>
                  <div style={S.actionCell}>
                    {/* 노출 토글 (ACTIVE↔INACTIVE) — 기존 숨김 기능 */}
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
                    {/* 재고 토글 (품절↔판매재개) — ACTIVE 상품만 의미있음 */}
                    {p.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => handleToggleStock(p)}
                        disabled={stockUpdatingId === p.id}
                        style={{
                          ...S.toggleBtn,
                          ...(p.stock === 0 ? S.restockBtn : S.soldOutBtn),
                          ...(stockUpdatingId === p.id ? S.toggleBtnDisabled : {}),
                        }}
                      >
                        {stockUpdatingId === p.id
                          ? '변경 중...'
                          : p.stock === 0 ? '판매 재개' : '품절 처리'}
                      </button>
                    )}
                  </div>
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
  badgeSoldOut: {
    display: 'inline-block',
    padding: '2px 10px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#b91c1c',
    background: '#fef2f2',
    border: '1px solid #fecaca',
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
  stockNull: {
    color: colors.textOnLightDim,
  },
  stockZero: {
    color: '#b91c1c',
    fontWeight: typography.fontWeight.semibold,
  },
  stockNormal: {
    color: colors.textOnLight,
    fontVariantNumeric: 'tabular-nums',
  },
  actionCell: {
    display: 'flex',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  toggleBtn: {
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
  toggleBtnDisabled: {
    color: colors.textOnLightDim,
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  soldOutBtn: {
    color: '#b91c1c',
    borderColor: '#fecaca',
  },
  restockBtn: {
    color: '#047857',
    borderColor: '#a7f3d0',
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
