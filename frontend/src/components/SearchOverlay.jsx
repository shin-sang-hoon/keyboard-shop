// frontend/src/components/SearchOverlay.jsx
// 5-B 라운드 3-J - swagkey 메인 페이지 search 효과 정밀 매칭.
//
// 변경 사항 (3-H/3-I 대비):
//   1. 배경 rgba(0,0,0,0.92) → rgba(0,0,0,0.55) (헤더가 비쳐 dim 보임)
//   2. placeholder "무엇을 찾고 계신가요?" → "검색" (간결)
//   3. 우측에 돋보기 아이콘 추가 (클릭 시 검색 실행)
//   4. 검색바 위치 hero 영역 가운데 (paddingTop 32vh)
//   5. placeholder color 흰 반투명 (CSS ::placeholder 처리)
//
// 헤더 dim 효과:
//   - SearchOverlay z-index 9999 > 헤더 z-index sticky(1000)
//   - SearchOverlay 가 헤더 위에 깔리면서 헤더가 자연스럽게 dim
//   - 헤더의 actions(우측 액션) 자체 opacity 0.4 (라운드 3-I) 그대로 유지

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { typography, spacing } from '../styles/tokens';

// 우측 돋보기 아이콘 (lucide style)
const SearchIconLarge = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const PLACEHOLDER_CSS = `
.sw-search-input::placeholder {
  color: rgba(255, 255, 255, 0.55);
  font-weight: 300;
}
.sw-search-input::-webkit-input-placeholder {
  color: rgba(255, 255, 255, 0.55);
}
`;

export default function SearchOverlay({ onClose }) {
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    inputRef.current?.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleSubmit = () => {
    const q = query.trim();
    if (q) {
      navigate(`/products?search=${encodeURIComponent(q)}`);
      onClose();
    }
  };

  return (
    <>
      <style>{PLACEHOLDER_CSS}</style>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '32vh',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.25s ease',
          fontFamily: typography.fontFamily.base,
        }}
      >
        {/* X 닫기 버튼 (헤더 우측 상단 위치) */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="검색 닫기"
          style={{
            position: 'absolute',
            top: 32,
            right: 40,
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 40,
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
            fontWeight: 200,
            fontFamily: 'inherit',
            opacity: 0.85,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.85; }}
        >
          ×
        </button>

        {/* 검색 input + 돋보기 (가운데) */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '85%',
            maxWidth: 1100,
            position: 'relative',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="검색"
            className="sw-search-input"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom: '1.5px solid rgba(255, 255, 255, 0.6)',
              padding: `${spacing[5]} ${spacing[16]} ${spacing[5]} 0`,
              color: 'white',
              fontSize: 36,
              fontWeight: 300,
              outline: 'none',
              fontFamily: 'inherit',
              letterSpacing: '0.02em',
            }}
          />

          {/* 우측 돋보기 아이콘 */}
          <button
            type="button"
            onClick={handleSubmit}
            aria-label="검색 실행"
            style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: spacing[2],
              display: 'flex',
              alignItems: 'center',
              opacity: 0.85,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.85; }}
          >
            <SearchIconLarge />
          </button>
        </div>
      </div>
    </>
  );
}
