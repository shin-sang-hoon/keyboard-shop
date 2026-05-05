import { useState } from 'react';

/**
 * RatingInput — 별점 입력 (5-H C2).
 *
 * 1~5 정수 별점 입력 (0.5 단위는 보류 — B2 Service 가 0.5 단위 받지만
 * 기획상 "신뢰도 표현은 정수 5단계가 더 깔끔" 이라 일단 정수만).
 *
 * 인터랙션:
 *   - 마우스 호버 → 미리보기 (state 변경 X)
 *   - 클릭 → 확정 (onChange)
 *   - 키보드 포커스 후 ←/→ → 1단계씩 변경 (a11y)
 *   - 0 으로 리셋: ESC 또는 0 누름 (옵션)
 *
 * Props:
 *   value:    현재 선택된 별점 (1~5, 0 = 미선택)
 *   onChange: (newValue: number) => void
 *   size:     별 한 개 픽셀 크기 (기본 32)
 *   readOnly: 읽기 전용 여부 (기본 false)
 *
 * 면접 자산:
 *   - 호버 미리보기 / 확정 분리 (UX 표준)
 *   - role="radiogroup" + role="radio" + aria-checked / aria-label 한국어
 *   - 키보드 단독 조작 가능 (Tab + ←/→ + Enter/Space)
 *   - ReadOnly 모드 지원 — 같은 컴포넌트로 표시/입력 모두 처리 (재사용성)
 */
export default function RatingInput({
  value = 0,
  onChange,
  size = 32,
  readOnly = false,
}) {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = readOnly ? value : (hoverValue || value);

  const handleClick = (n) => {
    if (readOnly) return;
    // 같은 별 다시 클릭 시 0 으로 리셋 (UX 표준)
    onChange?.(value === n ? 0 : n);
  };

  const handleKeyDown = (e) => {
    if (readOnly) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange?.(Math.min(5, (value || 0) + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange?.(Math.max(0, (value || 0) - 1));
    } else if (e.key === '0' || e.key === 'Escape') {
      e.preventDefault();
      onChange?.(0);
    } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
      e.preventDefault();
      onChange?.(Number(e.key));
    }
  };

  return (
    <div
      role={readOnly ? undefined : 'radiogroup'}
      aria-label={readOnly ? `별점 ${value}점` : '별점 선택'}
      style={S.group}
      onMouseLeave={() => setHoverValue(0)}
      onKeyDown={handleKeyDown}
      tabIndex={readOnly ? -1 : 0}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = displayValue >= n;
        return (
          <button
            key={n}
            type="button"
            role={readOnly ? undefined : 'radio'}
            aria-checked={readOnly ? undefined : value === n}
            aria-label={`${n}점`}
            onClick={() => handleClick(n)}
            onMouseEnter={() => !readOnly && setHoverValue(n)}
            disabled={readOnly}
            style={{
              ...S.star,
              fontSize: size,
              color: filled ? '#fbbf24' : '#e4e4e7',
              cursor: readOnly ? 'default' : 'pointer',
              transform: !readOnly && hoverValue === n ? 'scale(1.1)' : 'scale(1)',
            }}
            tabIndex={-1}  /* 라디오 그룹 자체에 tabIndex 가 있어 별 개별로는 0 안 줌 */
          >
            {filled ? '★' : '☆'}
          </button>
        );
      })}
      {!readOnly && (
        <span style={S.hint}>
          {value > 0 ? `${value}점` : '별을 클릭해주세요'}
        </span>
      )}
    </div>
  );
}

const S = {
  group: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    outline: 'none',
  },
  star: {
    background: 'none',
    border: 'none',
    padding: 0,
    lineHeight: 1,
    transition: 'transform 0.12s ease, color 0.12s ease',
    fontFamily: 'inherit',
  },
  hint: {
    marginLeft: 12,
    fontSize: 13,
    color: '#71717a',
    fontWeight: 500,
  },
};
