import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * ReviewReportModal — 리뷰 신고 모달 (7-G R8 사용자 측 연동, P0.5).
 *
 * 백엔드 계약: POST /api/reviews/{reviewId}/report  (ReviewReportController)
 *   요청: ReviewReportDto.CreateRequest { reason, detail }
 *     - reason: SPAM / ABUSE / ADULT / FALSE_INFO / ETC  (필수)
 *     - detail: 최대 500자 (선택)
 *   인증 필요 (Authorization: Bearer). principal == null → 401.
 *   성공: 201 Created (body 없음)
 *   에러:
 *     - 404 리뷰 없음
 *     - 400 본인 리뷰 신고 / reason null / detail 500자 초과
 *     - 409 이미 신고한 리뷰 (UNIQUE review_id + reporter_id)
 *
 * R8 백엔드(ReviewReportController + ReviewReportService)는 이미 구현됨.
 * 이 모달이 사용자 측 진입점 — ReviewList 의 ReviewCard 가 띄운다.
 *
 * 면접 자산 (ReviewFormModal / QnAFormModal 패턴 그대로):
 *  - role="dialog" + aria-modal + aria-labelledby
 *  - ESC + Tab focus trap + 배경 클릭 닫기 + body 스크롤 잠금
 *  - busy 가드 (이중 제출 방지)
 *  - 토큰: useAuthStore.getState().accessToken (P0 토큰 버그 fix 일관성)
 *  - 신고 성공 시 done 화면 — 신고는 리스트 refetch 가 불필요(리뷰는 그대로 노출).
 *
 * Props:
 *  - reviewId: number   (필수) 신고 대상 리뷰 id
 *  - onClose: () => void (필수)
 *  - onSuccess: () => void (선택)
 */

// 백엔드 ReviewReport.ReportReason enum 과 1:1 매칭
const REPORT_REASONS = [
  { value: 'SPAM',       label: '스팸 / 광고',  desc: '광고성 내용이거나 도배된 글입니다.' },
  { value: 'ABUSE',      label: '욕설 / 비방',  desc: '욕설, 인신공격, 비방이 포함돼 있습니다.' },
  { value: 'ADULT',      label: '음란물',       desc: '선정적이거나 부적절한 내용입니다.' },
  { value: 'FALSE_INFO', label: '허위 정보',    desc: '사실과 다른 정보가 담겨 있습니다.' },
  { value: 'ETC',        label: '기타',         desc: '위 사유에 해당하지 않습니다.' },
];

const DETAIL_MAX = 500; // 백엔드 ReviewReportService.DETAIL_MAX_LENGTH 와 동일

export default function ReviewReportModal({ reviewId, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

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

    if (!reason) {
      setError('신고 사유를 선택해주세요.');
      return;
    }
    const trimmedDetail = detail.trim();
    if (trimmedDetail.length > DETAIL_MAX) {
      setError(`상세 내용은 ${DETAIL_MAX}자 이하로 입력해주세요.`);
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

      const res = await fetch(`${API_BASE}/reviews/${reviewId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason,
          detail: trimmedDetail || null,
        }),
      });

      if (!res.ok) {
        let msg = `신고 접수 실패 (${res.status})`;
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch (_) { /* ignore parse error */ }
        if (res.status === 401 || res.status === 403) {
          msg = '로그인이 필요합니다.';
        } else if (res.status === 404) {
          msg = '리뷰를 찾을 수 없습니다.';
        } else if (res.status === 409) {
          msg = '이미 신고한 리뷰입니다.';
        }
        // 400 은 백엔드 message 그대로 사용 (본인 리뷰 신고 / reason 누락 등)
        throw new Error(msg);
      }

      // 201 Created — body 없음. 성공 화면으로 전환.
      setDone(true);
      onSuccess?.();
    } catch (err) {
      console.error('[ReviewReportModal] submit error:', err);
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
        aria-labelledby="report-modal-title"
        style={S.dialog}
      >
        {/* Header */}
        <div style={S.header}>
          <h2 id="report-modal-title" style={S.title}>
            {done ? '신고 완료' : '리뷰 신고'}
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

        {done ? (
          /* ─────────── 성공 화면 ─────────── */
          <div style={S.doneBox}>
            <div style={S.doneIcon}>✓</div>
            <p style={S.doneTitle}>신고가 접수되었습니다</p>
            <p style={S.doneText}>
              운영자가 신고 내용을 확인한 후 처리합니다.
              소중한 제보 감사합니다.
            </p>
            <button type="button" onClick={onClose} style={S.doneBtn}>
              확인
            </button>
          </div>
        ) : (
          /* ─────────── 신고 폼 ─────────── */
          <form onSubmit={handleSubmit} style={S.form}>
            {/* 안내 박스 */}
            <div style={S.infoBox}>
              <span style={S.infoIcon}>ℹ️</span>
              <div>
                <p style={S.infoTitle}>신고 안내</p>
                <p style={S.infoText}>
                  부적절한 리뷰를 신고하면 운영자가 검토 후 숨김 처리합니다.
                  본인이 작성한 리뷰나 이미 신고한 리뷰는 신고할 수 없습니다.
                </p>
              </div>
            </div>

            {/* 신고 사유 (라디오) */}
            <div style={S.fieldGroup}>
              <span style={S.fieldLabel}>
                신고 사유 <span style={S.required}>*</span>
              </span>
              <div style={S.reasonList}>
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.value}
                    style={{
                      ...S.reasonItem,
                      ...(reason === r.value ? S.reasonItemActive : {}),
                    }}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={busy}
                      style={S.radio}
                    />
                    <span style={S.reasonTextWrap}>
                      <span style={S.reasonLabel}>{r.label}</span>
                      <span style={S.reasonDesc}>{r.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 상세 내용 (선택) */}
            <label style={S.fieldGroup}>
              <span style={S.fieldLabelRow}>
                <span style={S.fieldLabel}>상세 내용</span>
                <span style={S.counter}>{detail.length} / {DETAIL_MAX}</span>
              </span>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="신고 사유를 자세히 적어주세요. (선택사항)"
                maxLength={DETAIL_MAX}
                rows={4}
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
                {busy ? '접수 중…' : '신고하기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ────────────── 라이트 테마 스타일 (ReviewFormModal 톤 일치) ────────────── */
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
    animation: 'report-modal-fade 0.18s ease-out',
  },
  dialog: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90vh',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 14,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'report-modal-slide 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
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
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 8,
  },
  infoIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#92400e',
    margin: '2px 0 4px',
  },
  infoText: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 1.55,
    margin: 0,
  },

  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  fieldLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#18181b',
  },
  required: { color: '#dc2626', marginLeft: 2 },
  counter: {
    fontSize: 11,
    color: '#a1a1aa',
    fontWeight: 400,
    fontVariantNumeric: 'tabular-nums',
  },

  reasonList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  reasonItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '11px 14px',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  reasonItemActive: {
    background: '#fef2f2',
    borderColor: '#fca5a5',
  },
  radio: {
    marginTop: 2,
    width: 16,
    height: 16,
    accentColor: '#dc2626',
    cursor: 'pointer',
    flexShrink: 0,
  },
  reasonTextWrap: { display: 'flex', flexDirection: 'column', gap: 2 },
  reasonLabel: { fontSize: 13.5, fontWeight: 600, color: '#18181b' },
  reasonDesc: { fontSize: 12, color: '#71717a', lineHeight: 1.5 },

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
    minHeight: 84,
    outline: 'none',
    boxSizing: 'border-box',
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
    background: '#dc2626',
    border: 'none',
    color: '#fff',
    padding: '10px 24px',
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: 110,
    fontFamily: 'inherit',
  },
  submitBtnBusy: {
    background: '#a1a1aa',
    cursor: 'not-allowed',
  },

  /* 성공 화면 */
  doneBox: {
    padding: '32px 24px 26px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 6,
  },
  doneIcon: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: '#f0fdf4',
    border: '2px solid #16a34a',
    color: '#16a34a',
    fontSize: 26,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  doneTitle: {
    fontSize: 15.5,
    fontWeight: 700,
    color: '#18181b',
    margin: 0,
  },
  doneText: {
    fontSize: 13,
    color: '#71717a',
    lineHeight: 1.6,
    margin: '0 0 8px',
  },
  doneBtn: {
    background: '#18181b',
    border: 'none',
    color: '#fff',
    padding: '10px 32px',
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

/* keyframes — 한 번만 주입 */
if (typeof document !== 'undefined' && !document.getElementById('report-modal-keyframes')) {
  const style = document.createElement('style');
  style.id = 'report-modal-keyframes';
  style.textContent = `
    @keyframes report-modal-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes report-modal-slide {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);
}
