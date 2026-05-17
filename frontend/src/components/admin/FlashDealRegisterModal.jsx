// frontend/src/components/admin/FlashDealRegisterModal.jsx
//
// Phase 7 라운드 3 (5/17) - 플래시 딜 등록 모달.
//
// UX:
//   1. 상품 검색 input + 자동 필터 드롭다운 (Top N% 후보만)
//   2. 시작가 슬라이더 30~70% + 실시간 미리보기
//   3. 즉시 / 예약 토글
//   4. 지속 시간: 프리셋 + 직접 입력
//   5. 상품 상태 (NEW / EXCELLENT / GOOD / FAIR / USED)
//   6. 설명 textarea
//
// 백엔드:
//   - 즉시: POST /api/admin/auctions/flash-deal
//   - 예약: POST /api/admin/auctions/flash-deal/scheduled

import { useEffect, useMemo, useState } from 'react';
import productsApi from '../../api/products';
import { createFlashDeal, createScheduledFlashDeal } from '../../api/auction';
import { colors, typography, spacing, radius } from '../../styles/tokens';

const DURATION_PRESETS = [
  { label: '1시간', hours: 1 },
  { label: '6시간', hours: 6 },
  { label: '12시간', hours: 12 },
  { label: '24시간', hours: 24 },
  { label: '3일', hours: 72 },
  { label: '7일', hours: 168 },
];

const CONDITIONS = [
  { value: 'NEW', label: '미개봉' },
  { value: 'EXCELLENT', label: '최상' },
  { value: 'GOOD', label: '양호' },
  { value: 'FAIR', label: '보통' },
  { value: 'USED', label: '사용감' },
];

const krw = (n) => (n != null ? n.toLocaleString('ko-KR') : '-');

/** 1시간 후를 datetime-local 입력 포맷 (KST). */
function defaultStartAtLocal() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local (KST 표시) → UTC ISO (옵션 A 백엔드 호환). */
function localToUtcIso(localStr) {
  if (!localStr) return null;
  const d = new Date(localStr); // 브라우저 로컬 (KST) 로 파싱
  return d.toISOString().slice(0, -1); // 'Z' 제거 → "2026-05-18T01:00:00.000"
}

export default function FlashDealRegisterModal({ threshold, onClose, onSuccess }) {
  // 상품 검색
  const [searchKeyword, setSearchKeyword] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // 폼 상태
  const [startPricePercent, setStartPricePercent] = useState(50);
  const [scheduleMode, setScheduleMode] = useState('immediate'); // 'immediate' | 'scheduled'
  const [startAtLocal, setStartAtLocal] = useState(defaultStartAtLocal());
  const [durationHours, setDurationHours] = useState(24);
  const [durationCustom, setDurationCustom] = useState(false);
  const [condition, setCondition] = useState('NEW');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Top N% 후보 로드 (KEYBOARD 전체 받아서 클라이언트에서 threshold 필터)
  useEffect(() => {
    if (!threshold) return;
    setLoadingCandidates(true);
    productsApi.list({ productType: 'KEYBOARD', size: 200 })
      .then((res) => {
        const data = res.data;
        const content = Array.isArray(data) ? data : data.content || [];
        const filtered = content
          .filter((p) => p.price >= threshold.threshold && p.status === 'ACTIVE')
          .sort((a, b) => b.price - a.price);
        setCandidates(filtered);
      })
      .catch((e) => {
        console.error('Failed to load candidates:', e);
        setError('상품 후보 로드 실패');
      })
      .finally(() => setLoadingCandidates(false));
  }, [threshold]);

  // 검색어 자동 필터
  const filteredCandidates = useMemo(() => {
    if (!searchKeyword.trim()) return candidates;
    const kw = searchKeyword.toLowerCase();
    return candidates.filter((p) =>
      p.name.toLowerCase().includes(kw) ||
      (p.brandName || '').toLowerCase().includes(kw),
    );
  }, [candidates, searchKeyword]);

  // 미리보기
  const startPricePreview = useMemo(() => {
    if (!selectedProduct) return null;
    return Math.floor((selectedProduct.price * startPricePercent) / 100);
  }, [selectedProduct, startPricePercent]);

  const endTimePreview = useMemo(() => {
    const baseMs = scheduleMode === 'immediate'
      ? Date.now()
      : new Date(startAtLocal).getTime();
    return new Date(baseMs + durationHours * 60 * 60 * 1000);
  }, [scheduleMode, startAtLocal, durationHours]);

  // 등록
  const handleSubmit = async () => {
    if (!selectedProduct) {
      setError('상품을 선택하세요');
      return;
    }
    setError(null);
    setSubmitting(true);

    const baseBody = {
      productId: selectedProduct.id,
      startPricePercent,
      durationHours,
      description: description.trim() || undefined,
      condition,
    };

    try {
      if (scheduleMode === 'immediate') {
        await createFlashDeal(baseBody);
      } else {
        await createScheduledFlashDeal({
          ...baseBody,
          startAt: localToUtcIso(startAtLocal),
        });
      }
      onSuccess();
    } catch (e) {
      setError(e.response?.data?.message || '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 스타일 ───────────────────────────────────────────
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
      width: '600px',
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
    dropdown: {
      maxHeight: '240px',
      overflow: 'auto',
      border: `1px solid ${colors.borderLight}`,
      borderRadius: radius.md,
      marginTop: '6px',
      background: colors.white,
    },
    dropdownItem: {
      padding: '10px 14px',
      cursor: 'pointer',
      background: colors.white,
      borderBottom: `1px solid ${colors.borderLight}`,
      fontSize: '13px',
    },
    radioRow: { display: 'flex', gap: spacing.md, marginBottom: '4px' },
    radioOption: (active) => ({
      flex: 1,
      padding: '10px 14px',
      border: `1px solid ${active ? colors.textOnLight : colors.borderLight}`,
      background: active ? colors.surface : colors.white,
      borderRadius: radius.md,
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: active ? 600 : 400,
      color: colors.textOnLight,
      textAlign: 'center',
    }),
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
          <div style={styles.title}>🔥 새 플래시 경매 등록</div>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.errorBox}>{error}</div>}

          {/* 상품 선택 */}
          <div style={styles.field}>
            <label style={styles.label}>
              상품 선택 (상위 {threshold?.topPercent ?? '-'}% / ₩{krw(threshold?.threshold)} 이상)
            </label>
            {selectedProduct ? (
              <div style={{
                display: 'flex',
                gap: '12px',
                padding: '10px 14px',
                border: `1px solid ${colors.borderLight}`,
                borderRadius: radius.md,
                background: colors.surface,
                alignItems: 'center',
              }}>
                {/* 상품 썸네일 (60x60, RecentlyViewedSidebar 매칭) */}
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: radius.sm,
                  overflow: 'hidden',
                  background: colors.white,
                  border: `1px solid ${colors.borderLight}`,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {selectedProduct.imageUrl ? (
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span style={{ fontSize: '10px', color: colors.textOnLightDim }}>NO IMG</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: colors.textOnLight,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {selectedProduct.name}
                  </div>
                  <div style={{ fontSize: '11px', color: colors.textOnLightDim, marginTop: '2px' }}>
                    ₩{krw(selectedProduct.price)} · {selectedProduct.brandName || '-'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setSearchKeyword('');
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: `1px solid ${colors.borderLight}`,
                    background: colors.white,
                    color: colors.textOnLight,
                    borderRadius: radius.sm,
                    cursor: 'pointer',
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  변경
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder="상품명 또는 브랜드로 검색..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={styles.input}
                autoFocus
              />
            )}
            {!selectedProduct && (
              <div style={styles.dropdown}>
                {loadingCandidates ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: colors.textOnLightDim }}>
                    상품 로드 중...
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: colors.textOnLightDim }}>
                    조건에 맞는 상품이 없습니다
                  </div>
                ) : (
                  filteredCandidates.slice(0, 30).map((p) => (
                    <div
                      key={p.id}
                      style={{ ...styles.dropdownItem, display: 'flex', gap: '12px', alignItems: 'center' }}
                      onClick={() => {
                        setSelectedProduct(p);
                        setSearchKeyword('');
                      }}
                    >
                      <div style={{
                        width: 60,
                        height: 60,
                        borderRadius: radius.sm,
                        overflow: 'hidden',
                        background: colors.surface,
                        border: `1px solid ${colors.borderLight}`,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span style={{ fontSize: '10px', color: colors.textOnLightDim }}>NO IMG</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: colors.textOnLightDim, marginTop: '2px' }}>
                          ₩{krw(p.price)} · {p.brandName || '-'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 시작가 슬라이더 */}
          <div style={styles.field}>
            <label style={styles.label}>
              시작가 비율: <span style={{ color: colors.textOnLight, fontSize: '15px', fontWeight: 700 }}>{startPricePercent}%</span>
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

          {/* 등록 방식 */}
          <div style={styles.field}>
            <label style={styles.label}>등록 방식</label>
            <div style={styles.radioRow}>
              <div
                style={styles.radioOption(scheduleMode === 'immediate')}
                onClick={() => setScheduleMode('immediate')}
              >
                ▶️ 즉시 시작
              </div>
              <div
                style={styles.radioOption(scheduleMode === 'scheduled')}
                onClick={() => setScheduleMode('scheduled')}
              >
                📅 예약 시작
              </div>
            </div>
            {scheduleMode === 'scheduled' && (
              <input
                type="datetime-local"
                value={startAtLocal}
                onChange={(e) => setStartAtLocal(e.target.value)}
                style={{ ...styles.input, marginTop: '10px' }}
              />
            )}
          </div>

          {/* 지속 시간 */}
          <div style={styles.field}>
            <label style={styles.label}>지속 시간</label>
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
                  <span style={{ fontSize: '12px', color: colors.textOnLightDim }}>시간 (1~168)</span>
                </>
              )}
            </div>
          </div>

          {/* 상품 상태 */}
          <div style={styles.field}>
            <label style={styles.label}>상품 상태</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {CONDITIONS.map((c) => (
                <div
                  key={c.value}
                  style={styles.radioOption(condition === c.value)}
                  onClick={() => setCondition(c.value)}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600 }}>{c.value}</div>
                  <div style={{ fontSize: '9px', color: colors.textOnLightDim, marginTop: '2px' }}>
                    {c.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 설명 */}
          <div style={styles.field}>
            <label style={styles.label}>설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="플래시 딜 설명, 한정판 콜라보 컨셉, 출고 정보 등..."
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
              maxLength={1000}
            />
          </div>

          {/* 미리보기 */}
          {selectedProduct && (
            <div style={styles.preview}>
              <div><strong>{selectedProduct.name}</strong></div>
              <div>정가 ₩{krw(selectedProduct.price)} → 시작가 <strong>₩{krw(startPricePreview)}</strong> ({startPricePercent}%)</div>
              <div>
                {scheduleMode === 'immediate'
                  ? `즉시 시작 → ${endTimePreview.toLocaleString('ko-KR')} 종료`
                  : `${new Date(startAtLocal).toLocaleString('ko-KR')} 시작 → ${endTimePreview.toLocaleString('ko-KR')} 종료`}
              </div>
              <div>지속 {durationHours}시간 · {condition}</div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={submitting}>
            취소
          </button>
          <button
            style={{
              ...styles.submitBtn,
              opacity: submitting || !selectedProduct ? 0.5 : 1,
              cursor: submitting || !selectedProduct ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSubmit}
            disabled={submitting || !selectedProduct}
          >
            {submitting ? '등록 중...' : `🔥 ${scheduleMode === 'immediate' ? '즉시 등록' : '예약 등록'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
