// frontend/src/styles/tokens.js
// 디자인 토큰 - single source of truth
// v3.5 체크리스트 HTML + AdminApp.jsx 컬러 포팅
// 
// 사용 예시:
//   import { colors, typography, spacing, radius } from '../styles/tokens';
//   <div style={{ background: colors.bgCard, padding: spacing[4], borderRadius: radius.lg }}>
//   <h1 style={{ color: colors.accent, fontSize: typography.fontSize['3xl'] }}>

// ============================================================================
// COLORS
// ============================================================================
export const colors = {
  // Backgrounds (dark theme - 관리자 / 챗봇 / 빌더 패널)
  bg: '#0f1419',
  bgCard: '#1a2332',
  bgCardHover: '#1f2a3e',
  bgAccent: '#1e2d4a',

  // Borders
  border: '#2a3a52',
  borderStrong: '#3b4a64',

  // Text (dark 배경 위에서)
  text: '#e6edf3',
  textDim: '#8b96a8',
  textFaint: '#5a6577',

  // Brand / accent
  accent: '#3b6bef',
  accentSoft: 'rgba(59, 107, 239, 0.12)',
  accentHover: '#2f5dd8',

  // Semantic
  success: '#10b981',
  successSoft: 'rgba(16, 185, 129, 0.12)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245, 158, 11, 0.15)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239, 68, 68, 0.15)',

  // Like / interview / highlight (♥)
  interview: '#ec4899',
  interviewSoft: 'rgba(236, 72, 153, 0.15)',

  // Wishlist (⭐) - yellow
  wishlist: '#fbbf24',
  wishlistSoft: 'rgba(251, 191, 36, 0.15)',

  // Light theme (메인 쇼핑몰 상품 페이지용)
  white: '#ffffff',
  surface: '#f8fafc',
  surfaceMuted: '#f1f5f9',
  textOnLight: '#0f172a',
  textOnLightDim: '#475569',
  borderLight: '#e2e8f0',
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================
export const typography = {
  fontFamily: {
    base: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    mono: "'D2Coding', 'JetBrains Mono', Consolas, monospace",
  },
  fontSize: {
    xs: '11px',
    sm: '12.5px',
    base: '13.5px',
    md: '15px',
    lg: '17px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '42px',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.2,
    base: 1.55,
    relaxed: 1.7,
  },
  letterSpacing: {
    tight: '-0.025em',
    base: '-0.01em',
    wide: '0.04em',
    wider: '0.08em',
  },
};

// ============================================================================
// SPACING (4px scale)
// ============================================================================
export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
};

// ============================================================================
// RADIUS
// ============================================================================
export const radius = {
  sm: '4px',
  md: '6px',
  lg: '10px',
  xl: '14px',
  pill: '100px',
  full: '9999px',
};

// ============================================================================
// SHADOW
// ============================================================================
export const shadow = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.12)',
  md: '0 4px 12px rgba(0, 0, 0, 0.18)',
  lg: '0 4px 20px rgba(0, 0, 0, 0.3)',
  card: '0 2px 8px rgba(15, 20, 25, 0.06)',
};

// ============================================================================
// TRANSITION
// ============================================================================
export const transition = {
  fast: 'all 0.15s ease',
  base: 'all 0.2s ease',
  slow: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
};

// ============================================================================
// BREAKPOINTS (모바일 반응형)
// ============================================================================
export const breakpoints = {
  mobile: '768px',
  tablet: '1024px',
  desktop: '1180px',
};

// ============================================================================
// Z-INDEX (FAB / 모달 / 토스트 레이어)
// ============================================================================
export const zIndex = {
  base: 1,
  dropdown: 10,
  sticky: 100,
  fab: 900,
  modalBackdrop: 1000,
  modal: 1010,
  toast: 1100,
};

// 통합 export
export const tokens = {
  colors,
  typography,
  spacing,
  radius,
  shadow,
  transition,
  breakpoints,
  zIndex,
};

export default tokens;
