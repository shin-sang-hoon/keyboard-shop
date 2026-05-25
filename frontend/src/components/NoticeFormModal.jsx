// frontend/src/components/NoticeFormModal.jsx
//
// Phase 7-B (2026-05-25) — 공지 작성/수정 공용 모달.
//
// HomePage(메인 작성) · NoticeDetailPage(메인 수정) · AdminNoticePage(관리자
// 작성/수정)가 모두 이 하나의 모달을 재사용한다. 작성/수정 로직과 첨부 업로드
// UI 가 한 곳에 모여 있어 중복이 없다.
//
// props:
//   - mode     : 'create' | 'edit'
//   - noticeId : edit 모드에서 대상 공지 id
//   - onClose  : 닫기 콜백
//   - onSaved  : 저장 성공 콜백 (저장된 Detail 을 인자로 받음) — 호출 측에서
//                목록/상세를 새로고침한다
//
// 권한: 작성/수정 API(/api/admin/notices)는 ADMIN 가드. 이 모달은 ADMIN 에게만
//   열리도록 호출 측(HomePage/NoticeDetailPage)이 보장한다.

import { useState, useEffect, useRef } from 'react';
import { colors, typography, spacing, radius } from '../styles/tokens';
import { adminNoticeApi } from '../api/adminNotice';

// 첨부 이미지 URL 절대경로화 — 백엔드가 주는 url 은 /uploads/... 상대경로라
// 그대로 쓰면 Vite dev(5173)로 가서 404. API origin(8080)을 앞에 붙인다.
const FILE_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api')
  .replace(/\/api\/?$/, '');
function fileUrl(path) {
  if (!path) return '';
  return /^https?:\/\//.test(path) ? path : FILE_BASE + path;
}

export default function NoticeFormModal({ mode, noticeId, onClose, onSaved }) {
  const isEdit = mode === 'edit';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);

  // 기존 첨부(edit) 중 삭제 표시하지 않은 것
  const [existingAttachments, setExistingAttachments] = useState([]);
  // 삭제 표시한 기존 첨부 id
  const [deleteIds, setDeleteIds] = useState([]);
  // 새로 추가할 이미지 — { file, preview(objectURL) }
  const [newImages, setNewImages] = useState([]);

  const [loading, setLoading] = useState(isEdit);  // edit 초기 로드
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  // 언마운트 시 objectURL 정리를 위해 최신 newImages 추적
  const newImagesRef = useRef([]);
  useEffect(() => { newImagesRef.current = newImages; }, [newImages]);
  useEffect(() => () => {
    newImagesRef.current.forEach((x) => URL.revokeObjectURL(x.preview));
  }, []);

  // edit: 기존 공지 데이터 로드
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    setLoading(true);
    adminNoticeApi.get(noticeId)
      .then((d) => {
        if (cancelled) return;
        setTitle(d.title ?? '');
        setContent(d.content ?? '');
        setPinned(!!d.pinned);
        setExistingAttachments(d.attachments ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('공지 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isEdit, noticeId]);

  // ─── 첨부 핸들러 ─────────────────────────────────────────
  const handleAddFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const picked = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setNewImages((prev) => [...prev, ...picked]);
    e.target.value = '';   // 같은 파일을 다시 선택할 수 있도록 초기화
  };

  const removeNewImage = (idx) => {
    setNewImages((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const markDeleteExisting = (id) => {
    setDeleteIds((prev) => [...prev, id]);
    setExistingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // ─── 저장 ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return; }
    if (!content.trim()) { setError('본문을 입력해 주세요.'); return; }

    setSaving(true);
    setError('');
    try {
      const images = newImages.map((x) => x.file);
      let saved;
      if (isEdit) {
        saved = await adminNoticeApi.update(noticeId, {
          title: title.trim(),
          content,
          pinned,
          images,
          deleteAttachmentIds: deleteIds,
        });
      } else {
        saved = await adminNoticeApi.create({
          title: title.trim(),
          content,
          pinned,
          images,
        });
      }
      onSaved?.(saved);
    } catch (e) {
      setError(e?.response?.data?.message || '저장에 실패했습니다.');
      setSaving(false);   // 실패 시에만 풀어줌 (성공이면 모달이 닫힘)
    }
  };

  const totalImageCount = existingAttachments.length + newImages.length;

  return (
    <div style={S.overlay} onClick={saving ? undefined : onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={S.title}>{isEdit ? '공지 수정' : '공지 등록'}</h3>

        {loading ? (
          <div style={S.loading}>불러오는 중...</div>
        ) : (
          <>
            {error && <div style={S.error}>{error}</div>}

            {/* 제목 */}
            <div style={S.field}>
              <label style={S.label}>제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="공지 제목"
                maxLength={200}
                style={S.input}
              />
            </div>

            {/* 본문 */}
            <div style={S.field}>
              <label style={S.label}>본문</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="공지 본문을 입력하세요"
                rows={9}
                style={S.textarea}
              />
            </div>

            {/* 첨부 이미지 */}
            <div style={S.field}>
              <label style={S.label}>첨부 이미지 ({totalImageCount})</label>

              {totalImageCount > 0 && (
                <div style={S.thumbGrid}>
                  {/* 기존 첨부 */}
                  {existingAttachments.map((a) => (
                    <div key={`exist-${a.id}`} style={S.thumb}>
                      <img src={fileUrl(a.url)} alt={a.originalName} style={S.thumbImg} />
                      <button
                        type="button"
                        onClick={() => markDeleteExisting(a.id)}
                        style={S.thumbRemove}
                        aria-label="첨부 삭제"
                      >×</button>
                    </div>
                  ))}
                  {/* 새로 추가한 이미지 */}
                  {newImages.map((x, idx) => (
                    <div key={`new-${idx}`} style={S.thumb}>
                      <img src={x.preview} alt={x.file.name} style={S.thumbImg} />
                      <button
                        type="button"
                        onClick={() => removeNewImage(idx)}
                        style={S.thumbRemove}
                        aria-label="이미지 제거"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleAddFiles}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={S.addImageBtn}
              >
                + 이미지 추가
              </button>
              <p style={S.hint}>png · jpg · gif · webp · 파일당 최대 10MB</p>
            </div>

            {/* 상단 고정 */}
            <label style={S.checkLabel}>
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                style={S.checkbox}
              />
              상단 고정 (목록 최상단에 노출)
            </label>

            {/* 액션 */}
            <div style={S.actions}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{ ...S.cancelBtn, ...(saving ? S.disabled : {}) }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ ...S.saveBtn, ...(saving ? S.disabled : {}) }}
              >
                {saving ? '저장 중...' : (isEdit ? '수정 저장' : '등록')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
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
    maxWidth: 560,
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: spacing[6],
    fontFamily: typography.fontFamily.base,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[5],
  },
  loading: {
    padding: `${spacing[10]} 0`,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: colors.danger,
    borderRadius: radius.sm,
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
  },
  field: {
    marginBottom: spacing[5],
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
    borderRadius: radius.sm,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    padding: `${spacing[2]} ${spacing[3]}`,
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.7,
  },
  thumbGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  thumb: {
    position: 'relative',
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    overflow: 'hidden',
    border: `1px solid ${colors.borderLight}`,
    background: colors.surface,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    fontSize: 14,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
  },
  addImageBtn: {
    padding: `${spacing[2]} ${spacing[4]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px dashed ${colors.borderLight}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  hint: {
    margin: `${spacing[2]} 0 0`,
    fontSize: typography.fontSize.xs,
    color: colors.textOnLightDim,
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    fontSize: typography.fontSize.sm,
    color: colors.textOnLight,
    cursor: 'pointer',
    marginBottom: spacing[6],
  },
  checkbox: {
    width: 16,
    height: 16,
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  cancelBtn: {
    padding: `${spacing[3]} ${spacing[6]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: `${spacing[3]} ${spacing[8]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    background: colors.textOnLight,
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  disabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
};
