import { useState } from 'react';

/**
 * RatingInput — 별점 입력 (5-H C2, 0.5 단위 지원).
 *
 * 1.0 ~ 5.0, 0.5 단위 (총 10단계). 0 = 미선택.
 *
 * 인터랙션:
 *   - 별 한 개를 왼쪽 절반 / 오른쪽 절반으로 나눠서 hit area 분리
 *     · 왼쪽 절반 호버/클릭 → n - 0.5 (예: 3번째 별 왼쪽 = 2.5점)
 *     · 오른쪽 절반 호버/클릭 → n     (예: 3번째 별 오른쪽 = 3.0점)
 *   - 호버 → 미리보기 (state 변경 X), 마우스 떼면 확정값 복귀
 *   - 클릭 → 확정 (onChange)
 *   - 같은 값 다시 클릭 → 0 으로 리셋
 *
 * 키보드 (focus 후):
 *   - ← / →           → ±0.5 (세밀)
 *   - Shift + ← / →   → ±1.0 (빠름)
 *   - ↑ / ↓           → ±1.0 (정수만)
 *   - 1~5 숫자키      → 해당 정수 점수
 *   - 0 / Escape      → 리셋
 *
 * 시각화:
 *   - 정수 별 (n): 100% 노란색
 *   - 0.5 별 (n - 0.5): 왼쪽 50% 만 노란색
 *   - 0 별: 빈 별 (회색 ☆)
 *
 * Props:
 *   value:    현재 선택된 별점 (0, 0.5, 1.0, ..., 5.0)
 *   onChange: (newValue: number) => void
 *   size:     별 한 개 픽셀 크기 (기본 32)
 *   readOnly: 읽기 전용 (기본 false)
 *
 * 면접 자산:
 *   - 0.5 단위는 hit area 분할 + width% 시각화 두 축 정확히 매칭 (UX 일관성)
 *   - 호버/확정 분리 + 키보드 단독 조작 + ARIA radiogroup
 *   - readOnly 재사용 (표시용 / 입력용 단일 컴포넌트)
 */
export default function RatingInput({
  value = 0,
  onChange,
  size = 32,
  readOnly = false,
}) {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = readOnly ? value : (hoverValue || value);

  const setValue = (next) => {
    if (readOnly) return;
    // 0 ~ 5 클램핑, 0.5 단위 강제
    const clamped = Math.max(0, Math.min(5, next));
    const rounded = Math.round(clamped * 2) / 2;
    onChange?.(rounded);
  };

  const handleClick = (n, half) => {
    if (readOnly) return;
    const clicked = half ? n - 0.5 : n;
    // 같은 값 다시 클릭 → 0 (UX 표준)
    onChange?.(value === clicked ? 0 : clicked);
  };

  const handleMouseEnter = (n, half) => {
    if (readOnly) return;
    setHoverValue(half ? n - 0.5 : n);
  };

  const handleKeyDown = (e) => {
    if (readOnly) return;
    const cur = value || 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.shiftKey || e.key === 'ArrowUp' ? 1 : 0.5;
      setValue(cur + step);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey || e.key === 'ArrowDown' ? 1 : 0.5;
      setValue(cur - step);
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
      aria-label={readOnly ? `별점 ${value}점` : '별점 선택 (0.5 단위)'}
      style={S.group}
      onMouseLeave={() => setHoverValue(0)}
      onKeyDown={handleKeyDown}
      tabIndex={readOnly ? -1 : 0}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        // 별 하나의 채움 비율: 0 / 50 / 100
        let fillPercent = 0;
        if (displayValue >= n) fillPercent = 100;
        else if (displayValue >= n - 0.5) fillPercent = 50;

        return (
          <span
            key={n}
            style={{
              ...S.starWrap,
              width: size,
              height: size,
              fontSize: size,
            }}
          >
            {/* 배경 빈 별 */}
            <span style={S.starBg} aria-hidden="true">☆</span>

            {/* 채움 별 (width% 로 0/50/100 표현) */}
            <span
              style={{
                ...S.starFg,
                width: `${fillPercent}%`,
              }}
              aria-hidden="true"
            >
              ★
            </span>

            {/* 왼쪽 절반 hit area (n - 0.5) */}
            {!readOnly && (
              <button
                type="button"
                role="radio"
                aria-checked={value === n - 0.5}
                aria-label={`${n - 0.5}점`}
                onClick={() => handleClick(n, true)}
                onMouseEnter={() => handleMouseEnter(n, true)}
                style={S.halfBtnLeft}
                tabIndex={-1}
              />
            )}

            {/* 오른쪽 절반 hit area (n) */}
            {!readOnly && (
              <button
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={`${n}점`}
                onClick={() => handleClick(n, false)}
                onMouseEnter={() => handleMouseEnter(n, false)}
                style={S.halfBtnRight}
                tabIndex={-1}
              />
            )}
          </span>
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
  starWrap: {
    position: 'relative',
    display: 'inline-block',
    lineHeight: 1,
    color: '#e4e4e7',
  },
  starBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: '#e4e4e7',
  },
  starFg: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: '#fbbf24',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition: 'width 0.08s ease-out',
    pointerEvents: 'none', // 시각화 전용, 클릭은 아래 button 이 받음
  },
  halfBtnLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    height: '100%',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    zIndex: 1,
  },
  halfBtnRight: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: '50%',
    height: '100%',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    zIndex: 1,
  },
  hint: {
    marginLeft: 12,
    fontSize: 13,
    color: '#71717a',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
};
