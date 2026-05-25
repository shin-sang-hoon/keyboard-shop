// frontend/src/pages/admin/AdminNoticePage.jsx
//
// Phase 7-G 라운드 7 (2026-05-25) — 관리자 공지 관리. 7-G 마지막 라운드.
//
// 기능:
//   - 공지 목록 테이블 (제목 / 고정 / 조회수 / 작성일 / 수정일 / 관리)
//   - 제목 검색 + 페이징
//   - 등록 모달 (제목 / 본문 / 상단고정 체크)
//   - 수정 모달 (상세 조회 후 폼 채움)
//   - 삭제 (confirm)
//
// 디자인: swagkey 화이트 톤. AdminUserPage / AdminProductPage / AdminOrderPage 동일 톤.
//
// 정렬은 백엔드가 pinned DESC → id DESC 로 내려준다 (고정 공지 최상단).

import { useState, useEffect, useCallback } from 'react';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';
import { adminNoticeApi } from '../../api/adminNotice';

const PAGE_SIZE = 20;

// 모달 모드
const MODAL = { CLOSED: 'CLOSED', CREATE: 'CREATE', EDIT: 'EDIT' };

const EMPTY_FORM = { title: '', content: '', pinned: false };

export default function AdminNoticePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 검색
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // 모달
  const [modal, setModal] = useState(MODAL.CLOSED);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // 삭제 중인 행
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminNoticeApi.list({ search, page, size: PAGE_SIZE });
      setData(res);
    } catch (e) {
      setError('공지 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(0);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // ─── 모달 열기 ───────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError(null);
    setModal(MODAL.CREATE);
  };

  const openEdit = async (id) => {
    setFormError(null);
    setEditId(id);
    setModal(MODAL.EDIT);
    setForm(EMPTY_FORM);
    try {
      const detail = await adminNoticeApi.get(id);
      setForm({
        title: detail.title ?? '',
        content: detail.content ?? '',
        pinned: !!detail.pinned,
      });
    } catch (e) {
      setFormError('공지 정보를 불러오지 못했습니다.');
    }
  };

  const closeModal = () => {
    if (saving) return;
    setModal(MODAL.CLOSED);
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError(null);
  };

  // ─── 저장 (등록 / 수정) ──────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('제목을 입력해 주세요.');
      return;
    }
    if (!form.content.trim()) {
      setFormError('본문을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const body = {
        title: form.title.trim(),
        content: form.content,
        pinned: form.pinned,
      };
      if (modal === MODAL.CREATE) {
        await adminNoticeApi.create(body);
      } else {
        await adminNoticeApi.update(editId, body);
      }
      setModal(MODAL.CLOSED);
      setForm(EMPTY_FORM);
      setEditId(null);
      // 등록이면 1페이지로, 수정이면 현재 페이지 유지
      if (modal === MODAL.CREATE) {
        setPage(0);
        setSearch('');
        setSearchInput('');
      }
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || '저장에 실패했습니다.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ─── 삭제 ────────────────────────────────────────────────
  const handleDelete = async (notice) => {
    const ok = window.confirm(
      `공지 #${notice.id}\n"${notice.title}"\n\n정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
    );
    if (!ok) return;

    setDeletingId(notice.id);
    try {
      await adminNoticeApi.remove(notice.id);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.message || '삭제에 실패했습니다.';
      window.alert(msg);
    } finally {
      setDeletingId(null);
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
        <h2 style={S.title}>공지 관리</h2>
        <p style={S.desc}>공지사항 등록 · 수정 · 삭제 · 상단 고정 · 제목 검색</p>
      </div>

      {/* 검색 + 등록 버튼 */}
      <div style={S.toolbar}>
        <div style={S.searchGroup}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="제목 검색"
            style={S.searchInput}
          />
          <button type="button" onClick={handleSearch} style={S.searchBtn}>
            검색
          </button>
        </div>
        <button type="button" onClick={openCreate} style={S.createBtn}>
          + 공지 등록
        </button>
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      <div style={S.countLine}>
        총 <strong>{totalElements.toLocaleString()}</strong>건
      </div>

      {/* 테이블 */}
      <div style={S.tableCard}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '70px' }}>번호</th>
              <th style={{ ...S.th, width: '70px' }}>고정</th>
              <th style={S.th}>제목</th>
              <th style={{ ...S.th, width: '90px' }}>조회수</th>
              <th style={{ ...S.th, width: '160px' }}>작성일</th>
              <th style={{ ...S.th, width: '160px' }}>수정일</th>
              <th style={{ ...S.th, width: '150px' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={S.emptyCell}>불러오는 중...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={S.emptyCell}>등록된 공지가 없습니다.</td></tr>
            )}
            {!loading && rows.map((n) => (
              <tr key={n.id} style={S.tr}>
                <td style={S.td}>#{n.id}</td>
                <td style={S.td}>
                  {n.pinned
                    ? <span style={S.pinBadge}>📌 고정</span>
                    : <span style={S.tdDim}>-</span>}
                </td>
                <td style={{ ...S.td, fontWeight: n.pinned ? typography.fontWeight.semibold : typography.fontWeight.regular }}>
                  {n.title}
                </td>
                <td style={S.td}>{n.viewCount?.toLocaleString() ?? 0}</td>
                <td style={S.td}>{fmtDate(n.createdAt)}</td>
                <td style={S.td}>{fmtDate(n.updatedAt)}</td>
                <td style={S.td}>
                  <div style={S.actionGroup}>
                    <button
                      type="button"
                      onClick={() => openEdit(n.id)}
                      style={S.editBtn}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(n)}
                      disabled={deletingId === n.id}
                      style={{
                        ...S.deleteBtn,
                        ...(deletingId === n.id ? S.btnDisabled : {}),
                      }}
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

      {/* 페이징 */}
      {totalPages > 0 && (
        <div style={S.pager}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={isFirst || loading}
            style={{ ...S.pagerBtn, ...((isFirst || loading) ? S.btnDisabled : {}) }}
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
            style={{ ...S.pagerBtn, ...((isLast || loading) ? S.btnDisabled : {}) }}
          >
            다음 →
          </button>
        </div>
      )}

      {/* ─── 등록 / 수정 모달 ─────────────────────────────── */}
      {modal !== MODAL.CLOSED && (
        <div style={S.overlay} onClick={closeModal}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={S.modalTitle}>
              {modal === MODAL.CREATE ? '공지 등록' : '공지 수정'}
            </h3>

            {formError && <div style={S.formError}>{formError}</div>}

            <div style={S.field}>
              <label style={S.label}>제목</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="공지 제목"
                maxLength={200}
                style={S.input}
              />
            </div>

            <div style={S.field}>
              <label style={S.label}>본문</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="공지 본문을 입력하세요"
                rows={10}
                style={S.textarea}
              />
            </div>

            <div style={S.checkRow}>
              <label style={S.checkLabel}>
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                  style={S.checkbox}
                />
                상단 고정 (목록 최상단에 노출)
              </label>
            </div>

            <div style={S.modalActions}>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                style={{ ...S.cancelBtn, ...(saving ? S.btnDisabled : {}) }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ ...S.saveBtn, ...(saving ? S.btnDisabled : {}) }}
              >
                {saving ? '저장 중...' : (modal === MODAL.CREATE ? '등록' : '수정 저장')}
              </button>
            </div>
          </div>
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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginBottom: spacing[4],
    flexWrap: 'wrap',
  },
  searchGroup: {
    display: 'flex',
    gap: spacing[2],
  },
  searchInput: {
    width: '260px',
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
  createBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    background: '#111827',
    border: '1px solid #111827',
    borderRadius: radius.md,
    cursor: 'pointer',
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
  tdDim: {
    color: colors.textOnLightDim,
  },
  emptyCell: {
    padding: `${spacing[6]} ${spacing[4]}`,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  pinBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#b45309',
    background: '#fffbeb',
    borderRadius: radius.sm,
    whiteSpace: 'nowrap',
  },
  actionGroup: {
    display: 'flex',
    gap: spacing[2],
  },
  editBtn: {
    padding: `${spacing[1]} ${spacing[3]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: `${spacing[1]} ${spacing[3]}`,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: '#dc2626',
    background: colors.white,
    border: '1px solid #fecaca',
    borderRadius: radius.sm,
    cursor: 'pointer',
  },
  btnDisabled: {
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
  pagerInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    fontVariantNumeric: 'tabular-nums',
  },

  // ─── 모달 ───────────────────────────────────────────────
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: spacing[4],
  },
  modal: {
    background: colors.white,
    borderRadius: radius.lg,
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: spacing[6],
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[4],
  },
  formError: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: radius.md,
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[3],
  },
  field: {
    marginBottom: spacing[4],
  },
  label: {
    display: 'block',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    marginBottom: spacing[2],
  },
  input: {
    width: '100%',
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.6,
  },
  checkRow: {
    marginBottom: spacing[5],
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  cancelBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: `${spacing[2]} ${spacing[5]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    background: '#111827',
    border: '1px solid #111827',
    borderRadius: radius.md,
    cursor: 'pointer',
  },
};
