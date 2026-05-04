import { useState, useEffect, useRef } from 'react';

/**
 * QnAFormModal — Q&A 작성 모달 (5-H C3)
 *
 * B3 백엔드: POST /api/qna
 *   요청: { productId, content, secret }
 *   인증 필요 (Authorization: Bearer ...)
 *   비로그인 → 403, 미존재 상품 → 404 (BusinessException 4-factory)
 *
 *   주의: title 필드 없음. 네이버 쇼핑/쿠팡 Q&A 패턴.
 *         secret (isSecret 아님) 으로 비밀글 플래그 전달.
 *
 * 면접 자산:
 *  - role="dialog" + aria-modal="true" + aria-labelledby
 *  - ESC 키로 닫기 (useEffect keydown listener)
 *  - 배경 클릭으로 닫기 (e.target === e.currentTarget)
 *  - autoFocus (첫 input)
 *  - Tab 순환 focus trap (간단 버전)
 *  - busy 가드 (이중 제출 방지, B4/C6 패턴 재사용)
 *  - body 스크롤 잠금
 *  - 비밀글 옵션 (체크박스 → isSecret)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function QnAFormModal({ productId, onClose, onSuccess }) {
  const [content, setContent] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const dialogRef = useRef(null);

  // ESC + 단순 focus trap + body 스크롤 잠금
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [busy, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !busy) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    const trimmedContent = content.trim();
    if (trimmedContent.length < 5) {
      setError('내용은 5자 이상 입력해주세요.');
      return;
    }
    if (trimmedContent.length > 2000) {
      setError('내용은 2000자 이하로 입력해주세요.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('로그인이 필요합니다.');
        setBusy(false);
        return;
      }

      const res = await fetch(`${API_BASE}/qna`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          content: trimmedContent,
          // Lombok + Jackson + boolean 함정:
          //   CreateRequest: Boolean isSecret → 요청 키 "isSecret"
          //   Response:      boolean isSecret → 응답 키 "secret" (is prefix 떨어짐)
          //   같은 의미, 다른 키. 요청은 isSecret 사용.
          isSecret,
        }),
      });

      if (!res.ok) {
        let msg = `질문 등록 실패 (${res.status})`;
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch (_) { /* ignore parse error */ }
        if (res.status === 401 || res.status === 403) {
          msg = '로그인이 필요합니다.';
        } else if (res.status === 404) {
          msg = '상품을 찾을 수 없습니다.';
        }
        throw new Error(msg);
      }

      onSuccess?.();
    } catch (err) {
      console.error('[QnAFormModal] submit error:', err);
      setError(err.message || '오류가 발생했습니다.');
      setBusy(false);
    }
  };

  return (
    <div style={S.backdrop} onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qna-modal-title"
        style={S.dialog}
      >
        {/* Header */}
        <div style={S.header}>
          <h2 id="qna-modal-title" style={S.title}>
            상품 Q&A 작성
          </h2>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            style={S.closeBtn}
            aria-label="모달 닫기"
            disabled={busy}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={S.form}>
          <label style={S.label}>
            <span style={S.labelText}>
              <span>
                내용 <span style={S.required}>*</span>
              </span>
              <span style={S.counter}>{content.length} / 2000</span>
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="궁금한 점을 자세히 적어주세요. (스펙, 호환성, 배송, 교환 등)"
              maxLength={2000}
              rows={8}
              style={S.textarea}
              disabled={busy}
              autoFocus
              required
            />
          </label>

          <label style={S.checkboxRow}>
            <input
              type="checkbox"
              checked={isSecret}
              onChange={(e) => setIsSecret(e.target.checked)}
              style={S.checkbox}
              disabled={busy}
            />
            <span style={S.checkboxLabel}>
              <span style={S.checkboxTitle}>🔒 비밀글로 작성</span>
              <span style={S.checkboxHint}>
                작성자와 판매자만 볼 수 있습니다.
              </span>
            </span>
          </label>

          {error && (
            <div role="alert" style={S.errorBox}>
              ⚠ {error}
            </div>
          )}

          <div style={S.actions}>
            <button
              type="button"
              onClick={onClose}
              style={S.cancelBtn}
              disabled={busy}
            >
              취소
            </button>
            <button
              type="submit"
              style={{
                ...S.submitBtn,
                ...(busy ? S.submitBtnBusy : {}),
              }}
              disabled={busy}
            >
              {busy ? '등록 중…' : '질문 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────── 라이트 테마 스타일 ────────────── */
const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(24, 24, 27, 0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
    animation: 'qna-modal-fade 0.18s ease-out',
  },
  dialog: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 14,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'qna-modal-slide 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid #e4e4e7',
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    color: '#18181b',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#71717a',
    fontSize: 28,
    width: 32,
    height: 32,
    borderRadius: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
  },
  form: {
    padding: '20px 24px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    overflowY: 'auto',
  },
  label: { display: 'flex', flexDirection: 'column', gap: 8 },
  labelText: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 600,
    color: '#18181b',
  },
  required: { color: '#dc2626', marginLeft: 2 },
  counter: { fontSize: 11, color: '#a1a1aa', fontWeight: 400, fontVariantNumeric: 'tabular-nums' },
  input: {
    width: '100%',
    padding: '11px 14px',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 8,
    color: '#18181b',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '11px 14px',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 8,
    color: '#18181b',
    fontSize: 14,
    fontFamily: 'inherit',
    lineHeight: 1.55,
    resize: 'vertical',
    minHeight: 120,
    outline: 'none',
    transition: 'border-color 0.15s ease',
    boxSizing: 'border-box',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    background: '#faf5ff',
    border: '1px solid #ddd6fe',
    borderRadius: 8,
    cursor: 'pointer',
  },
  checkbox: {
    marginTop: 3,
    width: 16,
    height: 16,
    accentColor: '#7c3aed',
    cursor: 'pointer',
  },
  checkboxLabel: { display: 'flex', flexDirection: 'column', gap: 2 },
  checkboxTitle: { fontSize: 13.5, fontWeight: 600, color: '#18181b' },
  checkboxHint: { fontSize: 12, color: '#71717a' },

  errorBox: {
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    color: '#dc2626',
    fontSize: 13,
  },

  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    borderTop: '1px dashed #e4e4e7',
    marginTop: 4,
  },
  cancelBtn: {
    background: '#fff',
    border: '1px solid #d4d4d8',
    color: '#52525b',
    padding: '10px 20px',
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
  },
  submitBtn: {
    background: '#18181b',
    border: 'none',
    color: '#fff',
    padding: '10px 24px',
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: 120,
    fontFamily: 'inherit',
  },
  submitBtnBusy: {
    background: '#71717a',
    cursor: 'not-allowed',
  },
};

/* keyframes 한 번만 주입 */
if (typeof document !== 'undefined' && !document.getElementById('qna-modal-keyframes')) {
  const style = document.createElement('style');
  style.id = 'qna-modal-keyframes';
  style.textContent = `
    @keyframes qna-modal-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes qna-modal-slide {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
}
