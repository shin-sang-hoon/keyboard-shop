/**
 * frontend/src/styles/adminTheme.js
 *
 * 관리자 페이지 공통 디자인 토큰 (V5, 5/17).
 *
 * 디자인 결정 (5/17 사용자 확정):
 *  - 모든 admin 페이지 화이트 톤 (swagkey.kr 일관성)
 *  - 이전 "관리자 = 다크 톤" 원칙 완전 폐기
 *  - AdminAuditLogPage (다크 톤) 도 이 토큰으로 재작업 예정
 *
 * 사용 예:
 *   import { ADMIN_THEME } from '@/styles/adminTheme';
 *   <div style={{ background: ADMIN_THEME.bg, color: ADMIN_THEME.textPrimary }}>
 */

export const ADMIN_THEME = {
  // ─── 색상 ─────────────────────────────────────
  bg: '#ffffff',              // 페이지 배경
  bgSecondary: '#fafafa',     // 카드 배경 (살짝 그레이)
  bgTertiary: '#f5f5f5',      // 표 헤더, 비활성 영역
  
  border: '#e5e5e5',          // 일반 보더
  borderStrong: '#d4d4d4',    // 강조 보더 (포커스 등)
  borderLight: '#f0f0f0',     // 표 row 구분선
  
  textPrimary: '#1a1a1a',     // 본문 (검정에 가까운)
  textSecondary: '#525252',   // 부제, 설명
  textTertiary: '#737373',    // placeholder, 비활성
  textInverse: '#ffffff',     // 어두운 배경 위 텍스트
  
  accent: '#1a1a1a',          // CTA 버튼 (swagkey 검정)
  accentHover: '#000000',     // CTA hover
  
  // 상태 색상
  success: '#16a34a',         // 성공
  successBg: '#dcfce7',
  warning: '#ea580c',         // 진행 중 (주황)
  warningBg: '#fed7aa',
  danger: '#dc2626',          // 위험/에러
  dangerBg: '#fecaca',
  info: '#0284c7',            // 정보 (파랑)
  infoBg: '#bae6fd',
  scheduled: '#7c3aed',       // SCHEDULED 상태 (보라)
  scheduledBg: '#ede9fe',
  
  // ─── 간격 ─────────────────────────────────────
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  
  // ─── 타이포그래피 ─────────────────────────────
  font: {
    h1: { fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontSize: '22px', fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontSize: '18px', fontWeight: 600 },
    body: { fontSize: '14px', fontWeight: 400, lineHeight: 1.6 },
    bodySmall: { fontSize: '13px', fontWeight: 400, lineHeight: 1.5 },
    label: { fontSize: '12px', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' },
    code: { fontFamily: 'Menlo, Monaco, "Courier New", monospace', fontSize: '13px' },
  },
  
  // ─── 보더 radius ──────────────────────────────
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
  
  // ─── 그림자 ───────────────────────────────────
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 8px rgba(0, 0, 0, 0.06)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.08)',
  },
};

/**
 * 상태 배지 색상 매핑 (Auction.Status, AuditLog.Category 등 재사용).
 */
export const STATUS_COLORS = {
  ACTIVE:    { bg: ADMIN_THEME.warningBg, fg: ADMIN_THEME.warning,    label: '진행 중' },
  SCHEDULED: { bg: ADMIN_THEME.scheduledBg, fg: ADMIN_THEME.scheduled, label: '대기 중' },
  ENDED:     { bg: ADMIN_THEME.bgTertiary, fg: ADMIN_THEME.textSecondary, label: '완료' },
  CANCELLED: { bg: ADMIN_THEME.dangerBg, fg: ADMIN_THEME.danger,    label: '취소' },
};

/**
 * 공통 admin 페이지 wrapper 스타일.
 */
export const ADMIN_PAGE_STYLE = {
  minHeight: '100vh',
  background: ADMIN_THEME.bg,
  color: ADMIN_THEME.textPrimary,
  fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
  padding: '32px 40px 80px',
};

/**
 * 공통 카드 스타일.
 */
export const ADMIN_CARD_STYLE = {
  background: ADMIN_THEME.bg,
  border: `1px solid ${ADMIN_THEME.border}`,
  borderRadius: ADMIN_THEME.radius.lg,
  padding: ADMIN_THEME.spacing.lg,
  boxShadow: ADMIN_THEME.shadow.sm,
};

/**
 * 공통 버튼 스타일.
 */
export const ADMIN_BUTTON_STYLES = {
  primary: {
    background: ADMIN_THEME.accent,
    color: ADMIN_THEME.textInverse,
    border: 'none',
    borderRadius: ADMIN_THEME.radius.md,
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  secondary: {
    background: ADMIN_THEME.bg,
    color: ADMIN_THEME.textPrimary,
    border: `1px solid ${ADMIN_THEME.border}`,
    borderRadius: ADMIN_THEME.radius.md,
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  ghost: {
    background: 'transparent',
    color: ADMIN_THEME.textSecondary,
    border: 'none',
    padding: '8px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'color 0.15s ease',
  },
  danger: {
    background: ADMIN_THEME.bg,
    color: ADMIN_THEME.danger,
    border: `1px solid ${ADMIN_THEME.dangerBg}`,
    borderRadius: ADMIN_THEME.radius.md,
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};

/**
 * 공통 input 스타일.
 */
export const ADMIN_INPUT_STYLE = {
  width: '100%',
  padding: '10px 14px',
  border: `1px solid ${ADMIN_THEME.border}`,
  borderRadius: ADMIN_THEME.radius.md,
  fontSize: '14px',
  color: ADMIN_THEME.textPrimary,
  background: ADMIN_THEME.bg,
  outline: 'none',
  transition: 'border-color 0.15s ease',
};

/**
 * 공통 표 스타일.
 */
export const ADMIN_TABLE_STYLES = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: ADMIN_THEME.bg,
  },
  thead: {
    background: ADMIN_THEME.bgTertiary,
    borderBottom: `1px solid ${ADMIN_THEME.border}`,
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: ADMIN_THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    color: ADMIN_THEME.textPrimary,
    borderBottom: `1px solid ${ADMIN_THEME.borderLight}`,
  },
  tr: {
    transition: 'background 0.1s ease',
  },
};
