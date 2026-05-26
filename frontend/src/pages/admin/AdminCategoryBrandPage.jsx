// frontend/src/pages/admin/AdminCategoryBrandPage.jsx
//
// Phase 7-G R9 (2026-05-26) — 카테고리·브랜드 관리 페이지.
//
// 2개 탭 (페이지 내부 상태로 전환, 라우트는 /admin/catalog 하나):
//   1) 카테고리 — 2-depth 트리 목록 + 생성/수정/삭제 (하위·상품 사용 시 삭제 거부)
//   2) 브랜드   — 목록 + 생성/수정/삭제 (상품 사용 시 삭제 거부)
//
// 백엔드는 기존 AdminCategoryController / AdminBrandController 를 그대로 사용.
// 디자인: swagkey 화이트 톤 (AdminLayout / AdminReviewQnaPage 와 일관).

import { useState, useEffect, useCallback } from 'react';
import { colors, typography, spacing, radius, shadow, zIndex } from '../../styles/tokens';
import { adminCategoryApi } from '../../api/adminCategory';
import { adminBrandApi } from '../../api/adminBrand';

const TABS = [
  { id: 'category', label: '카테고리' },
  { id: 'brand', label: '브랜드' },
];

// ────────────────────────────────────────────────────────────────────
// 공통 helper
// ────────────────────────────────────────────────────────────────────
// 백엔드 BusinessException 메시지 추출 (삭제 가드 409 등) — 응답 바디 모양 방어적 처리
function extractErr(e, fallback) {
  return (
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    fallback ||
    '요청 처리에 실패했습니다.'
  );
}

function StatePanel({ children }) {
  return <div style={S.statePanel}>{children}</div>;
}

// ────────────────────────────────────────────────────────────────────
// 1) 카테고리 탭
// ────────────────────────────────────────────────────────────────────
function CategoryTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { mode:'create'|'edit', category?, presetParentId? }
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminCategoryApi.list();
      setData(res);
    } catch (e) {
      setError(extractErr(e, '카테고리 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 최상위 카테고리 = parent 선택 옵션 (2-depth 유지 — 하위 카테고리는 부모가 될 수 없음)
  const topLevel = data || [];

  const handleDelete = async (cat) => {
    const ok = window.confirm(
      `'${cat.name}' 카테고리를 삭제할까요?\n하위 카테고리나 이 카테고리를 사용하는 상품이 있으면 삭제되지 않습니다.`
    );
    if (!ok) return;
    setBusyId(cat.id);
    try {
      await adminCategoryApi.remove(cat.id);
      await load();
    } catch (e) {
      window.alert(extractErr(e, '삭제에 실패했습니다.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        parentId: form.parentId === '' ? null : Number(form.parentId),
      };
      if (modal.mode === 'create') await adminCategoryApi.create(body);
      else await adminCategoryApi.update(modal.category.id, body);
      setModal(null);
      await load();
    } catch (e) {
      window.alert(extractErr(e, '저장에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  // 트리 → 평탄화 (최상위 행 + 하위 행 들여쓰기)
  const renderRow = (cat, depth) => (
    <tr key={cat.id}>
      <td style={S.td}>
        <span style={{ paddingLeft: depth * 22 }}>
          {depth > 0 && <span style={S.treeBranch}>└ </span>}
          <strong>{cat.name}</strong>
        </span>
      </td>
      <td style={{ ...S.td, ...S.tdMono }}>{cat.slug}</td>
      <td style={{ ...S.td, ...S.tdDim }}>
        {depth === 0 ? '최상위' : '하위'}
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        <div style={S.rowActions}>
          {depth === 0 && (
            <button
              type="button"
              style={{ ...S.actionBtn, ...S.actionBtnNeutral }}
              onClick={() => setModal({ mode: 'create', presetParentId: String(cat.id) })}
            >
              + 하위
            </button>
          )}
          <button
            type="button"
            style={{ ...S.actionBtn, ...S.actionBtnNeutral }}
            onClick={() => setModal({ mode: 'edit', category: cat })}
          >
            수정
          </button>
          <button
            type="button"
            disabled={busyId === cat.id}
            style={{
              ...S.actionBtn, ...S.actionBtnDanger,
              ...(busyId === cat.id ? S.actionBtnBusy : null),
            }}
            onClick={() => handleDelete(cat)}
          >
            삭제
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div>
      <div style={S.tabToolbar}>
        <span style={S.toolbarHint}>
          카테고리는 2단계(최상위 / 하위)로 구성됩니다.
        </span>
        <button
          type="button"
          style={{ ...S.actionBtn, ...S.actionBtnPrimary }}
          onClick={() => setModal({ mode: 'create' })}
        >
          + 새 카테고리
        </button>
      </div>

      {loading && <StatePanel>불러오는 중…</StatePanel>}
      {error && <StatePanel><span style={{ color: colors.danger }}>{error}</span></StatePanel>}
      {!loading && !error && topLevel.length === 0 && (
        <StatePanel>등록된 카테고리가 없습니다.</StatePanel>
      )}

      {!loading && !error && topLevel.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>카테고리명</th>
                <th style={{ ...S.th, width: 220 }}>slug</th>
                <th style={{ ...S.th, width: 90 }}>구분</th>
                <th style={{ ...S.th, width: 220, textAlign: 'right' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {topLevel.flatMap((parent) => [
                renderRow(parent, 0),
                ...(parent.children || []).map((child) => renderRow(child, 1)),
              ])}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <CategoryModal
          modal={modal}
          topLevel={topLevel}
          submitting={submitting}
          onClose={() => !submitting && setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function CategoryModal({ modal, topLevel, submitting, onClose, onSubmit }) {
  const isEdit = modal.mode === 'edit';
  const [name, setName] = useState(isEdit ? modal.category.name : '');
  const [slug, setSlug] = useState(isEdit ? modal.category.slug : '');
  const [parentId, setParentId] = useState(
    isEdit
      ? (modal.category.parentId == null ? '' : String(modal.category.parentId))
      : (modal.presetParentId || '')
  );

  // 부모 선택지 = 최상위 카테고리. 수정 시 자기 자신은 제외 (자기참조 방지)
  const parentOptions = topLevel.filter((c) => !isEdit || c.id !== modal.category.id);

  const handleSubmit = () => {
    if (!name.trim()) { window.alert('카테고리명을 입력해 주세요.'); return; }
    if (!slug.trim()) { window.alert('slug 를 입력해 주세요.'); return; }
    onSubmit({ name, slug, parentId });
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={S.modalTitle}>{isEdit ? '카테고리 수정' : '새 카테고리'}</h3>

        <label style={S.label}>카테고리명</label>
        <input
          style={S.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 키보드"
          autoFocus
        />

        <label style={S.label}>slug (URL 식별자, 영문/하이픈)</label>
        <input
          style={S.input}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="예: keyboards"
        />

        <label style={S.label}>상위 카테고리</label>
        <select
          style={S.input}
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">(최상위 카테고리)</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>

        <div style={S.modalActions}>
          <button
            type="button"
            style={{ ...S.actionBtn, ...S.actionBtnNeutral }}
            onClick={onClose}
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="button"
            style={{
              ...S.actionBtn, ...S.actionBtnPrimary,
              ...(submitting ? S.actionBtnBusy : null),
            }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '저장 중…' : (isEdit ? '수정' : '등록')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 2) 브랜드 탭
// ────────────────────────────────────────────────────────────────────
function BrandTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { mode:'create'|'edit', brand? }
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminBrandApi.list();
      setData(res);
    } catch (e) {
      setError(extractErr(e, '브랜드 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (brand) => {
    const ok = window.confirm(
      `'${brand.name}' 브랜드를 삭제할까요?\n이 브랜드를 사용하는 상품이 있으면 삭제되지 않습니다.`
    );
    if (!ok) return;
    setBusyId(brand.id);
    try {
      await adminBrandApi.remove(brand.id);
      await load();
    } catch (e) {
      window.alert(extractErr(e, '삭제에 실패했습니다.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        logoUrl: form.logoUrl.trim() || null,
        description: form.description.trim() || null,
      };
      if (modal.mode === 'create') await adminBrandApi.create(body);
      else await adminBrandApi.update(modal.brand.id, body);
      setModal(null);
      await load();
    } catch (e) {
      window.alert(extractErr(e, '저장에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  const brands = data || [];

  return (
    <div>
      <div style={S.tabToolbar}>
        <span style={S.toolbarHint}>
          {brands.length > 0 ? `총 ${brands.length}개 브랜드` : ''}
        </span>
        <button
          type="button"
          style={{ ...S.actionBtn, ...S.actionBtnPrimary }}
          onClick={() => setModal({ mode: 'create' })}
        >
          + 새 브랜드
        </button>
      </div>

      {loading && <StatePanel>불러오는 중…</StatePanel>}
      {error && <StatePanel><span style={{ color: colors.danger }}>{error}</span></StatePanel>}
      {!loading && !error && brands.length === 0 && (
        <StatePanel>등록된 브랜드가 없습니다.</StatePanel>
      )}

      {!loading && !error && brands.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 64 }}>로고</th>
                <th style={{ ...S.th, width: 200 }}>브랜드명</th>
                <th style={S.th}>설명</th>
                <th style={{ ...S.th, width: 160, textAlign: 'right' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td style={S.td}>
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.name} style={S.logoImg} />
                    ) : (
                      <div style={S.logoPlaceholder}>—</div>
                    )}
                  </td>
                  <td style={S.td}><strong>{b.name}</strong></td>
                  <td style={{ ...S.td, ...S.tdDim }}>
                    {b.description || <em style={S.muted}>(설명 없음)</em>}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <div style={S.rowActions}>
                      <button
                        type="button"
                        style={{ ...S.actionBtn, ...S.actionBtnNeutral }}
                        onClick={() => setModal({ mode: 'edit', brand: b })}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        style={{
                          ...S.actionBtn, ...S.actionBtnDanger,
                          ...(busyId === b.id ? S.actionBtnBusy : null),
                        }}
                        onClick={() => handleDelete(b)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <BrandModal
          modal={modal}
          submitting={submitting}
          onClose={() => !submitting && setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function BrandModal({ modal, submitting, onClose, onSubmit }) {
  const isEdit = modal.mode === 'edit';
  const [name, setName] = useState(isEdit ? modal.brand.name : '');
  const [logoUrl, setLogoUrl] = useState(isEdit ? (modal.brand.logoUrl || '') : '');
  const [description, setDescription] = useState(isEdit ? (modal.brand.description || '') : '');

  const handleSubmit = () => {
    if (!name.trim()) { window.alert('브랜드명을 입력해 주세요.'); return; }
    onSubmit({ name, logoUrl, description });
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={S.modalTitle}>{isEdit ? '브랜드 수정' : '새 브랜드'}</h3>

        <label style={S.label}>브랜드명</label>
        <input
          style={S.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: Keychron"
          autoFocus
        />

        <label style={S.label}>로고 URL (선택)</label>
        <input
          style={S.input}
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://..."
        />

        <label style={S.label}>설명 (선택)</label>
        <textarea
          style={{ ...S.input, resize: 'vertical', minHeight: 72 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="브랜드 소개"
          rows={3}
        />

        <div style={S.modalActions}>
          <button
            type="button"
            style={{ ...S.actionBtn, ...S.actionBtnNeutral }}
            onClick={onClose}
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="button"
            style={{
              ...S.actionBtn, ...S.actionBtnPrimary,
              ...(submitting ? S.actionBtnBusy : null),
            }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '저장 중…' : (isEdit ? '수정' : '등록')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 메인 — 탭 셸
// ────────────────────────────────────────────────────────────────────
export default function AdminCategoryBrandPage() {
  const [tab, setTab] = useState('category');

  return (
    <div style={S.root}>
      <div style={S.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{ ...S.tab, ...(tab === t.id ? S.tabActive : null) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={S.tabBody}>
        {tab === 'category' && <CategoryTab />}
        {tab === 'brand' && <BrandTab />}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 스타일 — swagkey 화이트 톤
// ────────────────────────────────────────────────────────────────────
const S = {
  root: { fontFamily: typography.fontFamily.base },

  tabBar: {
    display: 'flex',
    gap: spacing[1],
    borderBottom: `1px solid ${colors.borderLight}`,
    marginBottom: spacing[5],
  },
  tab: {
    padding: `10px ${spacing[5]}`,
    border: 'none',
    background: 'transparent',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLightDim,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    transition: 'all 0.12s ease',
  },
  tabActive: {
    color: colors.accent,
    fontWeight: typography.fontWeight.bold,
    borderBottom: `2px solid ${colors.accent}`,
  },
  tabBody: { minHeight: 200 },

  tabToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  toolbarHint: { fontSize: typography.fontSize.sm, color: colors.textOnLightDim },

  statePanel: {
    padding: `${spacing[12]} ${spacing[6]}`,
    textAlign: 'center',
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.base,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
  },

  tableWrap: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    overflow: 'hidden',
    boxShadow: shadow.card,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.base },
  th: {
    textAlign: 'left',
    padding: `11px ${spacing[3]}`,
    background: colors.surfaceMuted,
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    borderBottom: `1px solid ${colors.borderLight}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: `11px ${spacing[3]}`,
    borderBottom: `1px solid ${colors.borderLight}`,
    color: colors.textOnLight,
    verticalAlign: 'middle',
  },
  tdDim: { color: colors.textOnLightDim },
  tdMono: { fontFamily: typography.fontFamily.mono, fontSize: typography.fontSize.sm, color: colors.textOnLightDim },
  muted: { color: colors.textOnLightDim },
  treeBranch: { color: colors.textOnLightDim },

  rowActions: { display: 'inline-flex', gap: spacing[2], justifyContent: 'flex-end' },

  logoImg: {
    width: 40, height: 40, objectFit: 'contain',
    borderRadius: radius.sm, background: colors.surfaceMuted,
  },
  logoPlaceholder: {
    width: 40, height: 40, borderRadius: radius.sm,
    background: colors.surfaceMuted, color: colors.textOnLightDim,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: typography.fontSize.sm,
  },

  // ─── 액션 버튼 ───
  actionBtn: {
    padding: `6px ${spacing[3]}`,
    borderRadius: radius.md,
    border: '1px solid transparent',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.12s ease',
  },
  actionBtnPrimary: { background: colors.accent, color: '#fff' },
  actionBtnDanger: { background: colors.danger, color: '#fff' },
  actionBtnNeutral: {
    background: colors.white, color: colors.textOnLightDim,
    borderColor: colors.borderLight,
  },
  actionBtnBusy: { opacity: 0.55, cursor: 'progress' },

  // ─── 모달 ───
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: zIndex.modalBackdrop,
    padding: spacing[4],
  },
  modal: {
    background: colors.white,
    borderRadius: radius.xl,
    padding: spacing[6],
    width: '100%', maxWidth: 460,
    boxShadow: shadow.lg,
    zIndex: zIndex.modal,
  },
  modalTitle: {
    margin: 0, marginBottom: spacing[4],
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
  },
  label: {
    display: 'block',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
    margin: `${spacing[3]}px 0 6px`,
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: `9px ${spacing[3]}`,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.base,
    color: colors.textOnLight,
    background: colors.white,
  },
  modalActions: {
    display: 'flex', justifyContent: 'flex-end',
    gap: spacing[2], marginTop: spacing[5],
  },
};
