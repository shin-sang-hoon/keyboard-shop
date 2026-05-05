import { useState, useEffect, useRef } from 'react';
import RatingInput from './RatingInput';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * ReviewFormModal — 리뷰 작성 모달 (5-H C2).
 *
 * B2 백엔드: POST /api/reviews
 *   요청: { orderItemId, rating, content }
 *   인증 필요. 구매 인증 검증 4단계:
 *     1) orderItem 존재 / 본인 소유
 *     2) order status = DELIVERED
 *     3) 1 OrderItem = max 1 Review (UNIQUE)
 *     4) rating 1.0~5.0 + 0.5 단위
 *
 * 면접 자산 (C3 패턴 그대로 + RatingInput):
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - ESC + Tab focus trap + 배경 클릭 닫기 + body 스크롤 잠금
 *   - busy 가드 (이중 제출 방지)
 *   - RatingInput 별도 컴포넌트로 분리 (재사용 가능)
 *   - orderItemId 입력은 임시 — 5-D 마이페이지 주문내역 → 리뷰작성 진입 시
 *     자동으로 채워질 자리 (지금은 수동 입력으로 풀 플로우 검증 가능)
 */
export default function ReviewFormModal({ productId, onClose, onSuccess }) {
  const [orderItemId, setOrderItemId] = useState('');
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
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

    // 검증
    const orderItemIdNum = Number(orderItemId);
    if (!orderItemIdNum || orderItemIdNum <= 0) {
      setError('주문 상품 ID 를 입력해주세요. (마이페이지 주문내역에서 확인)');
      return;
    }
    if (rating < 1 || rating > 5) {
      setError('별점을 1점 이상 선택해주세요.');
      return;
    }
    const trimmedContent = content.trim();
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

      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderItemId: orderItemIdNum,
          rating,
          content: trimmedContent || null,
        }),
      });

      if (!res.ok) {
        let msg = `리뷰 등록 실패 (${res.status})`;
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch (_) { /* ignore parse error */ }
        if (res.status === 401 || res.status === 403) {
          msg = '로그인이 필요하거나 권한이 없습니다.';
        } else if (res.status === 404) {
          msg = '주문 상품을 찾을 수 없습니다.';
        } else if (res.status === 409) {
          msg = '이미 리뷰를 작성한 주문 상품입니다.';
        }
        throw new Error(msg);
      }

      onSuccess?.();
    } catch (err) {
      console.error('[ReviewFormModal] submit error:', err);
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
        aria-labelledby="review-modal-title"
        style={S.dialog}
      >
        {/* Header */}
        <div style={S.header}>
          <h2 id="review-modal-title" style={S.title}>
            리뷰 작성
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
          {/* 안내 박스 */}
          <div style={S.infoBox}>
            <span style={S.infoIcon}>ℹ️</span>
            <div>
              <p style={S.infoTitle}>구매 인증 리뷰</p>
              <p style={S.infoText}>
                리뷰는 본인이 구매하고 배송 완료된 상품에 한해서만 작성할 수 있습니다.
                마이페이지 → 주문내역 에서 주문 상품 ID 를 확인해주세요.
              </p>
            </div>
          </div>

          {/* 주문 상품 ID */}
          <label style={S.label}>
            <span style={S.labelText}>
              <span>
                주문 상품 ID <span style={S.required}>*</span>
              </span>
            </span>
            <input
              type="number"
              value={orderItemId}
              onChange={(e) => setOrderItemId(e.target.value)}
              placeholder="예: 12 (주문내역에서 확인)"
              style={S.input}
              disabled={busy}
              autoFocus
              required
              min="1"
            />
          </label>

          {/* 별점 */}
          <label style={S.label}>
            <span style={S.labelText}>
              <span>
                별점 <span style={S.required}>*</span>
              </span>
            </span>
            <div style={S.ratingWrap}>
              <RatingInput
                value={rating}
                onChange={setRating}
                size={32}
              />
            </div>
          </label>

          {/* 내용 */}
          <label style={S.label}>
            <span style={S.labelText}>
              <span>내용</span>
              <span style={S.counter}>{content.length} / 2000</span>
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="상품 사용 경험을 자세히 들려주세요. (선택사항)"
              maxLength={2000}
              rows={6}
              style={S.textarea}
              disabled={busy}
            />
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
              {busy ? '등록 중…' : '리뷰 등록'}
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
    animation: 'review-modal-fade 0.18s ease-out',
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
    animation: 'review-modal-slide 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
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
    gap: 16,
    overflowY: 'auto',
  },

  infoBox: {
    display: 'flex',
    gap: 10,
    padding: '12px 14px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 8,
  },
  infoIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1e40af',
    margin: '2px 0 4px',
  },
  infoText: {
    fontSize: 12,
    color: '#1e3a8a',
    lineHeight: 1.55,
    margin: 0,
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
    minHeight: 100,
    outline: 'none',
    boxSizing: 'border-box',
  },
  ratingWrap: {
    padding: '8px 0',
  },

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

/* keyframes */
if (typeof document !== 'undefined' && !document.getElementById('review-modal-keyframes')) {
  const style = document.createElement('style');
  style.id = 'review-modal-keyframes';
  style.textContent = `
    @keyframes review-modal-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes review-modal-slide {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
}
