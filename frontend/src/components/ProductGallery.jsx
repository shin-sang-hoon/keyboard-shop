import { useEffect, useRef, useState } from 'react';

/**
 * 상품 이미지 갤러리 (5-H C1-a).
 *
 * Swagkey 패턴:
 *   - 메인 이미지 영역 1개 (현재 활성 썸네일)
 *   - 썸네일 row (가로 배열, 모든 이미지 표시)
 *   - 썸네일 클릭 / 좌우 화살표 / 키보드 ←→ 로 활성 변경
 *   - 활성 썸네일은 시각적 highlight (border + opacity 100%)
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
 *
 * 접근성:
 *   - role='region' + aria-label
 *   - 썸네일: aria-current='true' (활성), aria-label='X번째 이미지 (총 N장)'
 *   - 키보드 focus 영역에서 ←→ 동작
 *
 * 면접 포인트:
 *   - "단일 이미지 케이스" 까지 graceful degradation
 *   - useRef + tabIndex 로 키보드 네비 (focus trap 없이 자연스럽게)
 *   - useEffect cleanup 으로 keydown 리스너 정리
 */
export default function ProductGallery({ images = [], fallbackImageUrl }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imgError, setImgError] = useState({});  // index -> boolean
  const containerRef = useRef(null);

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

  // ─── 키보드 ← / → 네비게이션 ─────────────────────────────────────────
  useEffect(() => {
    if (!hasMultiple) return;

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
  }, [hasMultiple, total]);

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
    </div>
  );
}

// ─── 인라인 스타일 (ProductDetail 패턴 일관) ────────────────────────────
const S = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    outline: 'none',
  },

  // 메인 이미지
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
  mainImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  placeholder: {
    color: '#a1a1aa',
    fontSize: 14,
  },

  // 화살표 버튼
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
  },
  arrowLeft: {
    left: 12,
  },
  arrowRight: {
    right: 12,
  },

  // 우하단 카운터
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
  },

  // 썸네일 row
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
