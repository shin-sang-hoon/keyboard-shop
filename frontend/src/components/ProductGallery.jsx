import { useEffect, useRef, useState } from 'react';

/**
 * 상품 이미지 갤러리 (5-H C1-a + C4).
 *
 * Swagkey 패턴:
 *   - 메인 이미지 영역 1개 (현재 활성 썸네일)
 *   - 썸네일 row (가로 배열, 모든 이미지 표시)
 *   - 썸네일 클릭 / 좌우 화살표 / 키보드 ←→ 로 활성 변경
 *   - 활성 썸네일은 시각적 highlight (border + opacity 100%)
 *
 * C4 추가 — 줌 모달 (라이트박스):
 *   - 메인 이미지 클릭 → 모달 오픈 (전체 화면 라이트박스)
 *   - 모달 안에서도 좌우 화살표 + 키보드 ←/→ 네비 가능
 *   - ESC / 배경 클릭 / × 버튼 → 닫기
 *   - body 스크롤 잠금 + 포커스 관리 (열기 시 모달로, 닫을 때 트리거 복귀)
 *   - role="dialog" + aria-modal="true" + a11y
 *
 * Props:
 *   - images: ProductImageDto[] (B1 응답의 images 배열)
 *     형태: [{ id, productId, imageUrl, displayOrder, imageType }, ...]
 *   - fallbackImageUrl: images 가 비었을 때 사용할 기본 이미지 (product.imageUrl)
 *
 * 케이스 처리:
 *   - images = []: fallbackImageUrl 1장만 표시 (썸네일 없음)
 *   - images = [1장]: 메인만 표시, 썸네일 row 숨김 (단일 이미지에 thumbnail 무의미)
 *   - images >= 2장: 메인 + 썸네일 row + 화살표 + 키보드 네비
 *   - 줌 모달은 모든 케이스에서 동작 (1장이라도 클릭하면 큰 이미지 보기)
 *
 * 접근성:
 *   - role='region' + aria-label
 *   - 썸네일: aria-current='true' (활성), aria-label='X번째 이미지 (총 N장)'
 *   - 키보드 focus 영역에서 ←→ 동작
 *   - 모달: role='dialog' + aria-modal='true' + aria-label
 *
 * 면접 포인트:
 *   - "단일 이미지 케이스" 까지 graceful degradation
 *   - useRef + tabIndex 로 키보드 네비 (focus trap 없이 자연스럽게)
 *   - useEffect cleanup 으로 keydown 리스너 정리
 *   - C4 모달의 포커스 복귀 패턴 (lastFocusedElement.current)
 *   - 모달 열린 동안 갤러리 native ←/→ 비활성 (충돌 방지)
 */
export default function ProductGallery({ images = [], fallbackImageUrl }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imgError, setImgError] = useState({});  // index -> boolean
  const [zoomOpen, setZoomOpen] = useState(false); // C4 줌 모달
  const containerRef = useRef(null);
  const triggerRef = useRef(null); // C4: 모달 닫을 때 포커스 복귀 대상

  // ─── 표시할 이미지 리스트 결정 ──────────────────────────────────────────
  const displayImages =
    images && images.length > 0
      ? images
      : fallbackImageUrl
      ? [{ id: 'fallback', imageUrl: fallbackImageUrl, displayOrder: 0 }]
      : [];

  const total = displayImages.length;
  const hasMultiple = total > 1;
  const safeIndex = Math.min(activeIndex, total - 1);
  const activeImage = displayImages[safeIndex];

  // ─── images prop 변경 시 첫 이미지로 리셋 ────────────────────────────
  useEffect(() => {
    setActiveIndex(0);
    setImgError({});
  }, [images]);

  // ─── 키보드 ← / → 네비게이션 (갤러리 영역, 모달 닫혔을 때만) ────────
  useEffect(() => {
    if (!hasMultiple) return;
    if (zoomOpen) return; // 모달 열린 동안은 모달의 keydown 우선

    function handleKeyDown(e) {
      // 갤러리 영역에 focus 있을 때만
      if (!containerRef.current?.contains(document.activeElement)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + total) % total);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % total);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasMultiple, total, zoomOpen]);

  // ─── 빈 케이스 ────────────────────────────────────────────────────────
  if (total === 0) {
    return (
      <div style={S.container}>
        <div style={S.mainBox}>
          <div style={S.placeholder}>이미지가 준비되지 않았습니다</div>
        </div>
      </div>
    );
  }

  // ─── 핸들러 ──────────────────────────────────────────────────────────
  const goPrev = () => setActiveIndex((i) => (i - 1 + total) % total);
  const goNext = () => setActiveIndex((i) => (i + 1) % total);

  // C4: 줌 모달 열기 — 트리거 버튼 ref 저장 (포커스 복귀용)
  const handleOpenZoom = (e) => {
    triggerRef.current = e.currentTarget;
    setZoomOpen(true);
  };

  const handleCloseZoom = () => {
    setZoomOpen(false);
    // 다음 tick 에 트리거 버튼으로 포커스 복귀 (모달 unmount 후)
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

  return (
    <div
      ref={containerRef}
      style={S.container}
      tabIndex={hasMultiple ? 0 : -1}
      role="region"
      aria-label={`상품 이미지 갤러리 (총 ${total}장)`}
    >
      {/* ─── 메인 이미지 영역 ───────────────────────────────────────── */}
      <div style={S.mainBox}>
        {/* C4: 메인 이미지 자체를 button 으로 wrap — 클릭 시 줌 모달 */}
        <button
          type="button"
          onClick={handleOpenZoom}
          style={S.mainImageButton}
          aria-label={`${safeIndex + 1}번째 이미지 크게 보기`}
          disabled={imgError[safeIndex] || !activeImage.imageUrl}
        >
          {imgError[safeIndex] || !activeImage.imageUrl ? (
            <div style={S.placeholder}>이미지를 불러올 수 없습니다</div>
          ) : (
            <img
              src={activeImage.imageUrl}
              alt={`상품 이미지 ${safeIndex + 1} / ${total}`}
              onError={() =>
                setImgError((prev) => ({ ...prev, [safeIndex]: true }))
              }
              style={S.mainImage}
            />
          )}
        </button>

        {/* 좌우 화살표 (2장 이상일 때만) */}
        {hasMultiple && (
          <>
            <button
              onClick={goPrev}
              style={{ ...S.arrow, ...S.arrowLeft }}
              aria-label="이전 이미지"
              type="button"
            >
              ‹
            </button>
            <button
              onClick={goNext}
              style={{ ...S.arrow, ...S.arrowRight }}
              aria-label="다음 이미지"
              type="button"
            >
              ›
            </button>

            {/* 우하단 카운터 */}
            <div style={S.counter}>
              {safeIndex + 1} / {total}
            </div>
          </>
        )}

        {/* C4: 우상단 줌 힌트 아이콘 (화살표 안 가리도록 좌상단) */}
        <div style={S.zoomHint} aria-hidden="true">
          🔍 클릭하여 크게 보기
        </div>
      </div>

      {/* ─── 썸네일 row (2장 이상일 때만) ─────────────────────────────── */}
      {hasMultiple && (
        <div style={S.thumbRow} role="tablist" aria-label="썸네일 선택">
          {displayImages.map((img, idx) => {
            const isActive = idx === safeIndex;
            const isErr = imgError[idx];

            return (
              <button
                key={img.id ?? idx}
                onClick={() => setActiveIndex(idx)}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`${idx + 1}번째 이미지 (총 ${total}장)`}
                type="button"
                style={{
                  ...S.thumb,
                  borderColor: isActive ? '#18181b' : '#e4e4e7',
                  opacity: isActive ? 1 : 0.6,
                }}
              >
                {isErr || !img.imageUrl ? (
                  <div style={S.thumbPlaceholder}>×</div>
                ) : (
                  <img
                    src={img.imageUrl}
                    alt=""
                    onError={() =>
                      setImgError((prev) => ({ ...prev, [idx]: true }))
                    }
                    style={S.thumbImage}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── C4 줌 모달 (라이트박스) ───────────────────────────────── */}
      {zoomOpen && (
        <ZoomModal
          images={displayImages}
          activeIndex={safeIndex}
          onChangeIndex={setActiveIndex}
          onClose={handleCloseZoom}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// C4 — 줌 모달 (라이트박스) 분리 컴포넌트
// ═════════════════════════════════════════════════════════════════════

function ZoomModal({ images, activeIndex, onChangeIndex, onClose }) {
  const dialogRef = useRef(null);
  const total = images.length;
  const hasMultiple = total > 1;
  const activeImage = images[activeIndex];

  // body 스크롤 잠금 + 모달 자동 포커스
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 모달 dialog 영역에 포커스 → 키보드 ESC/←/→ 즉시 동작
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // 키보드 ESC + ←/→ 처리 (document 레벨 — focus 안 잡혀도 동작)
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        e.preventDefault();
        onChangeIndex((activeIndex - 1 + total) % total);
      } else if (e.key === 'ArrowRight' && hasMultiple) {
        e.preventDefault();
        onChangeIndex((activeIndex + 1) % total);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeIndex, total, hasMultiple, onChangeIndex, onClose]);

  // 배경 클릭 → 닫기 (이미지 자체 클릭은 통과)
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const goPrev = () => onChangeIndex((activeIndex - 1 + total) % total);
  const goNext = () => onChangeIndex((activeIndex + 1) % total);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`이미지 크게 보기 (${activeIndex + 1} / ${total})`}
      tabIndex={-1}
      style={M.backdrop}
      onClick={handleBackdropClick}
    >
      {/* 닫기 (×) 버튼 — 우상단 */}
      <button
        type="button"
        onClick={onClose}
        style={M.closeBtn}
        aria-label="모달 닫기"
      >
        ×
      </button>

      {/* 카운터 — 우하단 */}
      {hasMultiple && (
        <div style={M.counter}>
          {activeIndex + 1} / {total}
        </div>
      )}

      {/* 메인 이미지 + 좌우 화살표 (이미지 영역 wrap) */}
      <div style={M.imageWrap} onClick={(e) => e.stopPropagation()}>
        {hasMultiple && (
          <button
            type="button"
            onClick={goPrev}
            style={{ ...M.arrow, ...M.arrowLeft }}
            aria-label="이전 이미지"
          >
            ‹
          </button>
        )}

        <img
          src={activeImage?.imageUrl}
          alt={`상품 이미지 ${activeIndex + 1} / ${total} (확대)`}
          style={M.mainImage}
          draggable={false}
        />

        {hasMultiple && (
          <button
            type="button"
            onClick={goNext}
            style={{ ...M.arrow, ...M.arrowRight }}
            aria-label="다음 이미지"
          >
            ›
          </button>
        )}
      </div>

      {/* 키보드 힌트 — 우하단 위쪽 */}
      <div style={M.keyboardHint} aria-hidden="true">
        ESC 닫기 · ← → 이전/다음
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// 스타일
// ═════════════════════════════════════════════════════════════════════

// 갤러리 본체 스타일 (ProductDetail 패턴 일관)
const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    outline: 'none',
  },

  mainBox: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    background: '#fff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // C4: 메인 이미지를 button 으로 wrap — 줌 모달 트리거
  mainImageButton: {
    width: '100%',
    height: '100%',
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'zoom-in',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  mainImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  placeholder: {
    color: '#a1a1aa',
    fontSize: 14,
  },

  // 화살표 버튼 (갤러리 본체)
  arrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#18181b',
    fontSize: 24,
    fontWeight: 300,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    transition: 'all 0.15s',
    userSelect: 'none',
    zIndex: 2,  // 메인 이미지 button 위에
  },
  arrowLeft: {
    left: 12,
  },
  arrowRight: {
    right: 12,
  },

  counter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    background: 'rgba(0, 0, 0, 0.55)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 100,
    fontVariantNumeric: 'tabular-nums',
    pointerEvents: 'none', // 클릭 통과 (메인 이미지 button 우선)
  },

  // C4: 줌 힌트 (좌상단)
  zoomHint: {
    position: 'absolute',
    top: 12,
    left: 12,
    background: 'rgba(0, 0, 0, 0.55)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: 100,
    pointerEvents: 'none',
    opacity: 0.8,
  },

  thumbRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  thumb: {
    flexShrink: 0,
    width: 72,
    height: 72,
    border: '2px solid #e4e4e7',
    borderRadius: 8,
    padding: 0,
    background: '#fff',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'all 0.15s',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#d4d4d8',
    fontSize: 24,
  },
};

// C4 모달 스타일 (분리 — M for Modal)
const M = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.88)',
    zIndex: 2000,                 // C2/C3 모달(1000) 보다 위
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5vh 5vw',
    cursor: 'zoom-out',           // 배경 클릭 닫기 시각화
    outline: 'none',
    animation: 'gallery-zoom-fade 0.18s ease-out',
  },
  imageWrap: {
    position: 'relative',
    maxWidth: '90vw',
    maxHeight: '90vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
  },
  mainImage: {
    maxWidth: '100%',
    maxHeight: '90vh',
    objectFit: 'contain',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    userSelect: 'none',
    animation: 'gallery-zoom-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 44,
    height: 44,
    border: 'none',
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#fff',
    fontSize: 32,
    lineHeight: 1,
    borderRadius: 22,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    transition: 'background 0.15s ease',
    zIndex: 2,
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.15)',
    color: '#fff',
    fontSize: 36,
    fontWeight: 300,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s ease',
    fontFamily: 'inherit',
    userSelect: 'none',
    zIndex: 2,
  },
  arrowLeft: {
    left: -72, // 이미지 wrap 바깥 (큰 화면) — 작은 화면에선 wrap 끝 안쪽으로 자동 fall
  },
  arrowRight: {
    right: -72,
  },
  counter: {
    position: 'absolute',
    bottom: 28,
    right: 28,
    background: 'rgba(255, 255, 255, 0.18)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 14px',
    borderRadius: 100,
    fontVariantNumeric: 'tabular-nums',
    pointerEvents: 'none',
  },
  keyboardHint: {
    position: 'absolute',
    bottom: 28,
    left: 28,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: 500,
    pointerEvents: 'none',
    letterSpacing: '0.02em',
  },
};

// keyframes (모달 fade + image pop)
if (typeof document !== 'undefined' && !document.getElementById('gallery-zoom-keyframes')) {
  const style = document.createElement('style');
  style.id = 'gallery-zoom-keyframes';
  style.textContent = `
    @keyframes gallery-zoom-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes gallery-zoom-pop {
      from { opacity: 0; transform: scale(0.94); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}
