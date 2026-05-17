// frontend/src/components/admin/FlashDealEditModal.jsx
//
// Phase 7 라운드 3 (5/17) - 예약 경매 수정 모달.
//
// 수정 가능 필드 (모두 nullable, 미변경 시 전송 안 함):
//   - startAt (시작 시각)
//   - durationHours (지속 시간)
//   - startPricePercent (시작가 비율)
//   - description (설명)
//
// 백엔드: PATCH /api/admin/auctions/{id}
// SCHEDULED 상태만 허용 (ACTIVE/ENDED/CANCELLED 는 백엔드 차단).

import { useState } from 'react';
import { updateScheduledAuction } from '../../api/auction';
import { colors, typography, spacing, radius } from '../../styles/tokens';

const DURATION_PRESETS = [
  { label: '1시간', hours: 1 },
  { label: '6시간', hours: 6 },
  { label: '12시간', hours: 12 },
  { label: '24시간', hours: 24 },
  { label: '3일', hours: 72 },
  { label: '7일', hours: 168 },
];

const krw = (n) => (n != null ? n.toLocaleString('ko-KR') : '-');

/** UTC ISO → datetime-local 입력 (KST 표시). */
function utcToLocalInput(isoUtc) {
  if (!isoUtc) return '';
  const d = new Date(isoUtc + 'Z');
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local (KST) → UTC ISO. */
function localToUtcIso(localStr) {
  if (!localStr) return null;
  const d = new Date(localStr);
  return d.toISOString().slice(0, -1);
}

export default function FlashDealEditModal({ auction, onClose, onSuccess }) {
  const [startAtLocal, setStartAtLocal] = useState(utcToLocalInput(auction.startAt));
  const [durationHours, setDurationHours] = useState(auction.durationHours);
  const [durationCustom, setDurationCustom] = useState(
    !DURATION_PRESETS.some((p) => p.hours === auction.durationHours),
  );
  const [startPricePercent, setStartPricePercent] = useState(auction.startPricePercent);
  const [description, setDescription] = useState(auction.description || '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // 변경 감지
  const hasChanges = () => {
    if (utcToLocalInput(auction.startAt) !== startAtLocal) return true;
    if (auction.durationHours !== durationHours) return true;
    if (auction.startPricePercent !== startPricePercent) return true;
    if ((auction.description || '') !== description) return true;
    return false;
  };

  const startPricePreview = Math.floor((auction.productPrice * startPricePercent) / 100);

  const handleSubmit = async () => {
    if (!hasChanges()) {
      onClose();
      return;
    }
    setError(null);
    setSubmitting(true);

    // 변경된 필드만 전송
    const body = {};
    if (utcToLocalInput(auction.startAt) !== startAtLocal) {
      body.startAt = localToUtcIso(startAtLocal);
    }
    if (auction.durationHours !== durationHours) {
      body.durationHours = durationHours;
    }
    if (auction.startPricePercent !== startPricePercent) {
      body.startPricePercent = startPricePercent;
    }
    if ((auction.description || '') !== description) {
      // 빈 문자열도 명시적으로 전송 (DB description 비우기 의도 보존).
      // 5/17 fix — 자산 #26: '...' || undefined 패턴이 빈 문자열을 falsy 로 처리해서
      // 백엔드 req.getDescription() == null 분기로 무시되던 버그.
      body.description = description.trim();
    }

    try {
      await updateScheduledAuction(auction.id, body);
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.message || '수정 실패');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 스타일 (등록 모달과 일관성) ─────────────────────────
  const styles = {
    backdrop: {
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    },
    modal: {
      background: colors.white,
      borderRadius: radius.lg,
      width: '540px',
      maxWidth: '95vw',
      maxHeight: '92vh',
      overflow: 'auto',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    },
    header: {
      padding: '20px 24px',
      borderBottom: `1px solid ${colors.borderLight}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    title: { fontSize: '18px', fontWeight: 700, color: colors.textOnLight },
    productLine: {
      fontSize: '13px',
      color: colors.textOnLightDim,
      marginTop: '4px',
    },
    closeBtn: {
      background: 'transparent', border: 'none',
      fontSize: '22px', cursor: 'pointer', color: colors.textOnLightDim,
      width: '32px', height: '32px',
    },
    body: { padding: '20px 24px' },
    field: { marginBottom: spacing.lg },
    label: {
      display: 'block',
      fontSize: '12px', fontWeight: 600,
      color: colors.textOnLightDim,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      marginBottom: '8px',
    },
    input: {
      width: '100%',
      padding: '10px 14px',
      border: `1px solid ${colors.borderLight}`,
      borderRadius: radius.md,
      fontSize: '14px',
      color: colors.textOnLight,
      background: colors.white,
      outline: 'none',
      boxSizing: 'border-box',
    },
    slider: { width: '100%', accentColor: colors.textOnLight },
    presetGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: '6px',
      marginBottom: '6px',
    },
    presetBtn: (active) => ({
      padding: '8px 4px',
      fontSize: '12px',
      border: `1px solid ${active ? colors.textOnLight : colors.borderLight}`,
      background: active ? colors.surface : colors.white,
      color: colors.textOnLight,
      borderRadius: radius.sm,
      cursor: 'pointer',
      fontWeight: active ? 600 : 400,
    }),
    preview: {
      background: colors.surface,
      padding: '12px 14px',
      borderRadius: radius.md,
      fontSize: '13px',
      color: colors.textOnLight,
      lineHeight: 1.7,
    },
    errorBox: {
      padding: '10px 14px',
      background: '#fef2f2',
      color: '#b91c1c',
      borderRadius: radius.md,
      fontSize: '13px',
      marginBottom: spacing.md,
    },
    footer: {
      padding: '16px 24px',
      borderTop: `1px solid ${colors.borderLight}`,
      display: 'flex', justifyContent: 'flex-end', gap: '10px',
    },
    cancelBtn: {
      padding: '10px 18px',
      border: `1px solid ${colors.borderLight}`,
      background: colors.white,
      color: colors.textOnLight,
      borderRadius: radius.md,
      fontSize: '13px', fontWeight: 500,
      cursor: 'pointer',
    },
    submitBtn: {
      padding: '10px 22px',
      border: 'none',
      background: colors.textOnLight,
      color: colors.white,
      borderRadius: radius.md,
      fontSize: '13px', fontWeight: 600,
      cursor: 'pointer',
    },
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>✏️ 예약 경매 수정</div>
            <div style={styles.productLine}>
              {auction.productName} · 정가 ₩{krw(auction.productPrice)}
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.errorBox}>{error}</div>}

          {/* 시작 시각 */}
          <div style={styles.field}>
            <label style={styles.label}>시작 시각 (KST)</label>
            <input
              type="datetime-local"
              value={startAtLocal}
              onChange={(e) => setStartAtLocal(e.target.value)}
              style={styles.input}
            />
          </div>

          {/* 시작가 슬라이더 */}
          <div style={styles.field}>
            <label style={styles.label}>
              시작가 비율: <span style={{ color: colors.textOnLight, fontSize: '15px', fontWeight: 700 }}>{startPricePercent}%</span>
              <span style={{ color: colors.textOnLightDim, fontSize: '11px', marginLeft: '8px', textTransform: 'none', letterSpacing: 0 }}>
                (현재 ₩{krw(auction.startPrice)})
              </span>
            </label>
            <input
              type="range"
              min="30" max="70" step="5"
              value={startPricePercent}
              onChange={(e) => setStartPricePercent(Number(e.target.value))}
              style={styles.slider}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: colors.textOnLightDim, marginTop: '4px' }}>
              <span>30%</span><span>50%</span><span>70%</span>
            </div>
          </div>

          {/* 지속 시간 */}
          <div style={styles.field}>
            <label style={styles.label}>지속 시간 (현재 {auction.durationHours}h)</label>
            <div style={styles.presetGrid}>
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.hours}
                  style={styles.presetBtn(!durationCustom && durationHours === p.hours)}
                  onClick={() => {
                    setDurationCustom(false);
                    setDurationHours(p.hours);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', color: colors.textOnLightDim, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="checkbox"
                  checked={durationCustom}
                  onChange={(e) => setDurationCustom(e.target.checked)}
                />
                직접 입력
              </label>
              {durationCustom && (
                <>
                  <input
                    type="number"
                    min="1" max="168"
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    style={{ ...styles.input, width: '100px' }}
                  />
                  <span style={{ fontSize: '12px', color: colors.textOnLightDim }}>시간</span>
                </>
              )}
            </div>
          </div>

          {/* 설명 */}
          <div style={styles.field}>
            <label style={styles.label}>설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="플래시 딜 설명..."
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
              maxLength={1000}
            />
          </div>

          {/* 미리보기 */}
          <div style={styles.preview}>
            <div><strong>{auction.productName}</strong></div>
            <div>정가 ₩{krw(auction.productPrice)} → 시작가 <strong>₩{krw(startPricePreview)}</strong> ({startPricePercent}%)</div>
            <div>지속 {durationHours}시간 · {auction.condition}</div>
            {hasChanges() && (
              <div style={{ color: '#9a3412', fontWeight: 600, marginTop: '6px' }}>
                ⚠️ 변경 사항 있음 — 저장 필요
              </div>
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button
            style={{
              ...styles.submitBtn,
              opacity: submitting || !hasChanges() ? 0.5 : 1,
              cursor: submitting || !hasChanges() ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSubmit}
            disabled={submitting || !hasChanges()}
          >
            {submitting ? '저장 중...' : '✏️ 변경 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
