import { useState, useEffect, useRef } from 'react';
import RatingInput from './RatingInput';
import { useAuthStore } from '../stores/authStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * ReviewFormModal — 리뷰 작성 모달 (UX P0, 5/28 검색식 → 자동 매칭 전환).
 *
 * 변경 배경:
 *   기존: 사용자가 "주문 상품 ID" 숫자를 직접 입력 → 외워서 적어야 하는 UX 마찰.
 *   변경: 모달 진입 시 GET /api/orders/my/reviewable-items?productId=X 자동 호출 →
 *         후보 OrderItem 카드로 표시 → 자동 선택 또는 라디오 선택.
 *
 * 백엔드 검증 (5-H A6 구매 인증 4단계):
 *   1) orderItem 존재 / 본인 소유
 *   2) order status = DELIVERED
 *   3) 1 OrderItem = max 1 Review (UNIQUE)
 *   4) rating 1.0~5.0 + 0.5 단위
 *   → 서버측 가드는 그대로. 프론트는 "후보 미리 보여주기" 만 추가 (defense in depth).
 *
 * 상태 머신:
 *   loading=true                        → 스피너
 *   loading=false, candidates.length=0  → "구매 이력 없음" 안내 + 등록 disabled
 *   loading=false, candidates.length=1  → 자동 선택, 카드 1개 표시
 *   loading=false, candidates.length>1  → 라디오 카드 선택 (재구매)
 */
export default function ReviewFormModal({ productId, onClose, onSuccess }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const dialogRef = useRef(null);
  const fetchedRef = useRef(false);  // StrictMode 이중 호출 가드 (자산 #21 패턴 재사용)

  // ────── reviewable 후보 fetch ──────
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchCandidates = async () => {
      try {
        const token = useAuthStore.getState().accessToken;
        if (!token) {
          setLoadError('로그인이 필요합니다.');
          setLoading(false);
          return;
        }
        const res = await fetch(
          `${API_BASE}/orders/my/reviewable-items?productId=${productId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          throw new Error(`후보 조회 실패 (${res.status})`);
        }
        const data = await res.json();
        setCandidates(data);
        // 1개면 자동 선택
        if (data.length === 1) {
          setSelectedOrderItemId(data[0].orderItemId);
        }
        setLoading(false);
      } catch (err) {
        console.error('[ReviewFormModal] fetch candidates error:', err);
        setLoadError(err.message || '후보 조회 중 오류가 발생했습니다.');
        setLoading(false);
      }
    };
    fetchCandidates();
  }, [productId]);

  // ────── ESC + Tab focus trap + body 스크롤 잠금 ──────
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
    if (!selectedOrderItemId) {
      setError('리뷰를 작성할 주문을 선택해주세요.');
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
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        setError('로그인이 필요합니다.');
        setBusy(false);
        return;
      }

      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderItemId: selectedOrderItemId,
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

  // ────── 날짜·가격 포맷 ──────
  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };
  const formatPrice = (n) => `₩${Number(n).toLocaleString('ko-KR')}`;

  const canSubmit = !loading && !loadError && candidates.length > 0 && selectedOrderItemId && rating >= 1;

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
          <h2 id="review-modal-title" style={S.title}>리뷰 작성</h2>
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
                본인이 구매하고 배송 완료된 상품에 한해서만 작성할 수 있습니다.
                아래에서 리뷰를 작성할 주문을 선택해주세요.
              </p>
            </div>
          </div>

          {/* ────── 주문 선택 영역 (loading / empty / single / multiple) ────── */}
          <div style={S.section}>
            <div style={S.sectionLabel}>
              주문 선택 <span style={S.required}>*</span>
            </div>

            {loading && (
              <div style={S.placeholderBox}>
                <span style={S.placeholderText}>주문 내역을 불러오는 중...</span>
              </div>
            )}

            {!loading && loadError && (
              <div role="alert" style={S.errorBox}>⚠ {loadError}</div>
            )}

            {!loading && !loadError && candidates.length === 0 && (
              <div style={S.emptyBox}>
                <span style={S.emptyIcon}>📦</span>
                <div>
                  <p style={S.emptyTitle}>리뷰를 작성할 수 있는 주문이 없습니다</p>
                  <p style={S.emptyText}>
                    이 상품을 구매하지 않았거나, 배송이 완료되지 않았거나,
                    이미 리뷰를 작성한 경우 후보에 나타나지 않습니다.
                  </p>
                </div>
              </div>
            )}

            {!loading && !loadError && candidates.length > 0 && (
              <div style={S.candidatesList} role="radiogroup" aria-label="리뷰 작성할 주문 선택">
                {candidates.map((c) => {
                  const selected = c.orderItemId === selectedOrderItemId;
                  return (
                    <button
                      key={c.orderItemId}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => !busy && setSelectedOrderItemId(c.orderItemId)}
                      disabled={busy}
                      style={{
                        ...S.candidateCard,
                        ...(selected ? S.candidateCardSelected : {}),
                      }}
                    >
                      {/* 라디오 점 */}
                      <span style={{
                        ...S.radioDot,
                        ...(selected ? S.radioDotSelected : {}),
                      }} aria-hidden="true">
                        {selected && <span style={S.radioDotInner} />}
                      </span>

                      {/* 썸네일 */}
                      {c.productImage ? (
                        <img src={c.productImage} alt="" style={S.candidateImage} />
                      ) : (
                        <div style={S.candidateImagePlaceholder}>📦</div>
                      )}

                      {/* 정보 */}
                      <div style={S.candidateInfo}>
                        <div style={S.candidateName}>{c.productName}</div>
                        <div style={S.candidateMeta}>
                          <span>주문일 {formatDate(c.orderedAt)}</span>
                          <span style={S.candidateMetaDot}>·</span>
                          <span>{formatPrice(c.price)}</span>
                          {c.quantity > 1 && (
                            <>
                              <span style={S.candidateMetaDot}>·</span>
                              <span>{c.quantity}개</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ────── 별점 ────── */}
          <label style={S.label}>
            <span style={S.labelText}>
              <span>별점 <span style={S.required}>*</span></span>
            </span>
            <div style={S.ratingWrap}>
              <RatingInput value={rating} onChange={setRating} size={32} />
            </div>
          </label>

          {/* ────── 내용 ────── */}
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
            <div role="alert" style={S.errorBox}>⚠ {error}</div>
          )}

          <div style={S.actions}>
            <button type="button" onClick={onClose} style={S.cancelBtn} disabled={busy}>
              취소
            </button>
            <button
              type="submit"
              style={{
                ...S.submitBtn,
                ...(!canSubmit || busy ? S.submitBtnBusy : {}),
              }}
              disabled={!canSubmit || busy}
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
  infoIcon: { fontSize: 18, flexShrink: 0 },
  infoTitle: { fontSize: 13, fontWeight: 700, color: '#1e40af', margin: '2px 0 4px' },
  infoText: { fontSize: 12, color: '#1e3a8a', lineHeight: 1.55, margin: 0 },

  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#18181b',
  },

  placeholderBox: {
    padding: '20px 14px',
    background: '#fafafa',
    border: '1px dashed #e4e4e7',
    borderRadius: 8,
    textAlign: 'center',
  },
  placeholderText: { fontSize: 13, color: '#71717a' },

  emptyBox: {
    display: 'flex',
    gap: 12,
    padding: '14px 16px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 8,
  },
  emptyIcon: { fontSize: 22, flexShrink: 0 },
  emptyTitle: { fontSize: 13, fontWeight: 700, color: '#92400e', margin: '2px 0 4px' },
  emptyText: { fontSize: 12, color: '#78350f', lineHeight: 1.55, margin: 0 },

  candidatesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 240,
    overflowY: 'auto',
  },
  candidateCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    textAlign: 'left',
    width: '100%',
  },
  candidateCardSelected: {
    background: '#f4f4f5',
    borderColor: '#18181b',
    boxShadow: '0 0 0 1px #18181b',
  },
  radioDot: {
    flexShrink: 0,
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '1.5px solid #d4d4d8',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotSelected: {
    borderColor: '#18181b',
  },
  radioDotInner: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#18181b',
  },
  candidateImage: {
    width: 48,
    height: 48,
    objectFit: 'cover',
    borderRadius: 6,
    border: '1px solid #f4f4f5',
    flexShrink: 0,
    background: '#fafafa',
  },
  candidateImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 6,
    background: '#fafafa',
    border: '1px solid #f4f4f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    flexShrink: 0,
  },
  candidateInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  candidateName: {
    fontSize: 13.5,
    fontWeight: 600,
    color: '#18181b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  candidateMeta: {
    fontSize: 12,
    color: '#71717a',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  candidateMetaDot: { color: '#d4d4d8' },

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
  ratingWrap: { padding: '8px 0' },

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
