// frontend/src/components/admin/AdminLayout.jsx
//
// Phase 7-G (2026-05-21) — 관리자 통합 레이아웃 (Admin Hub).
//
// 구조:
//   - 좌측 2단 사이드바: 아이콘 rail (60px) + 펼침 패널 (200px)
//     · 아이콘 클릭 → 해당 패널 표시 + 첫 링크로 navigate
//     · 현재 라우트에 따라 활성 패널/링크 자동 하이라이트
//   - 상단바: 페이지 타이틀 + 사이트로 돌아가기 + 관리자 이름
//   - 본문: <Outlet/> — 중첩 라우트의 각 Admin 페이지가 렌더됨
//
// 디자인: swagkey 화이트 톤 (메모 #12 — 관리자 페이지 화이트 톤 확정).
//   tokens.js 의 colors.white / surface / textOnLight 사용.
//
// 라우트: App.jsx 에서 <Route path="/admin" element={<AdminLayout/>}> 의
//   하위 children 으로 각 페이지가 들어옴. 가드는 /admin 한 곳에만.

import { useMemo } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { colors, typography, spacing, radius, shadow } from '../../styles/tokens';

// ────────────────────────────────────────────────────────────────────────────
// 사이드바 패널 정의
//   id        : 패널 식별자
//   title     : 패널 헤더 + 아이콘 tooltip
//   icon      : 24x24 SVG (stroke 방식, currentColor)
//   links     : 패널에 펼쳐질 메뉴 [{ to, label }]
// ────────────────────────────────────────────────────────────────────────────
const PANELS = [
  {
    id: 'dashboard',
    title: '대시보드',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
    links: [{ to: '/admin/dashboard', label: '대시보드' }],
  },
  {
    id: 'member',
    title: '회원 관리',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    links: [{ to: '/admin/users', label: '회원 조회' }],
  },
  {
    id: 'product',
    title: '상품 관리',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
    links: [{ to: '/admin/products', label: '상품 조회' }],
  },
  {
    id: 'catalog',
    title: '카테고리·브랜드',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    links: [{ to: '/admin/catalog', label: '카테고리·브랜드' }],
  },
  {
    id: 'order',
    title: '주문 관리',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M9 2L5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6l-4-4z" />
        <line x1="9" y1="22" x2="9" y2="6" />
        <line x1="13" y1="11" x2="17" y2="11" />
      </svg>
    ),
    links: [{ to: '/admin/orders', label: '주문 이력 조회' }],
  },
  {
    id: 'notice',
    title: '공지사항',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M3 11l18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
    links: [{ to: '/admin/notices', label: '공지 관리' }],
  },
  {
    id: 'review',
    title: '리뷰·문의',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    links: [{ to: '/admin/reviews', label: '리뷰·Q&A 운영' }],
  },
  {
    id: 'flashdeal',
    title: '플래시 딜',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    links: [{ to: '/admin/flash-deals', label: '플래시 경매 관리' }],
  },
  {
    id: 'log',
    title: '감사 로그',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    links: [{ to: '/admin/audit-logs', label: '감사 로그' }],
  },
];

// 모든 링크를 평탄화 — 현재 경로의 페이지 타이틀 찾기용
const ALL_LINKS = PANELS.flatMap((p) =>
  p.links.map((l) => ({ ...l, panelId: p.id, panelTitle: p.title }))
);

// 경로 → 활성 패널 id 매핑
function resolvePanelId(pathname) {
  // 정확 일치 우선
  const exact = ALL_LINKS.find((l) => l.to === pathname);
  if (exact) return exact.panelId;
  // prefix 매칭 (상세/등록 등 하위 경로 대비)
  const prefix = ALL_LINKS.find((l) => pathname.startsWith(l.to));
  if (prefix) return prefix.panelId;
  // /admin 또는 /admin/ → 대시보드
  return 'dashboard';
}

// 경로 → 현재 페이지 타이틀
function resolvePageTitle(pathname) {
  const exact = ALL_LINKS.find((l) => l.to === pathname);
  if (exact) return exact.label;
  const prefix = ALL_LINKS.find((l) => pathname.startsWith(l.to));
  if (prefix) return prefix.label;
  return '대시보드';
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const activePanelId = useMemo(
    () => resolvePanelId(location.pathname),
    [location.pathname]
  );
  const pageTitle = useMemo(
    () => resolvePageTitle(location.pathname),
    [location.pathname]
  );

  // 아이콘 클릭 → 해당 패널의 첫 링크로 이동
  function handleIconClick(panel) {
    if (panel.links.length > 0) {
      navigate(panel.links[0].to);
    }
  }

  const activePanel = PANELS.find((p) => p.id === activePanelId) || PANELS[0];

  return (
    <div style={S.root}>
      {/* ─── 좌측: 2단 사이드바 ─────────────────────────── */}
      <aside style={S.sidebar}>
        {/* 아이콘 rail */}
        <div style={S.iconRail}>
          <Link to="/admin/dashboard" style={S.logoBox} title="SWACHRON Admin">
            <span style={S.logoText}>SW</span>
          </Link>
          {PANELS.map((panel) => {
            const isActive = panel.id === activePanelId;
            return (
              <button
                key={panel.id}
                type="button"
                onClick={() => handleIconClick(panel)}
                title={panel.title}
                aria-label={panel.title}
                style={{
                  ...S.iconButton,
                  ...(isActive ? S.iconButtonActive : null),
                }}
              >
                {panel.icon}
              </button>
            );
          })}
        </div>

        {/* 펼침 패널 */}
        <nav style={S.panel}>
          <div style={S.panelTitle}>{activePanel.title}</div>
          <ul style={S.panelList}>
            {activePanel.links.map((link) => {
              const isActive =
                location.pathname === link.to ||
                location.pathname.startsWith(link.to + '/');
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    style={{
                      ...S.panelLink,
                      ...(isActive ? S.panelLinkActive : null),
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* ─── 우측: 상단바 + 본문 ───────────────────────── */}
      <div style={S.contentArea}>
        <header style={S.topbar}>
          <div style={S.topbarLeft}>
            <h1 style={S.topbarTitle}>{pageTitle}</h1>
            <span style={S.topbarCrumb}>SWACHRON 관리자</span>
          </div>
          <div style={S.topbarRight}>
            <span style={S.adminName}>
              {user?.name || '관리자'} 님
            </span>
            <Link to="/" style={S.backToSite}>
              ← 사이트로 돌아가기
            </Link>
          </div>
        </header>

        <main style={S.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 스타일 — swagkey 화이트 톤
// ────────────────────────────────────────────────────────────────────────────
const RAIL_W = 64;
const PANEL_W = 200;

const S = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: colors.surface,
    fontFamily: typography.fontFamily.base,
  },

  // ─── 사이드바 ───
  sidebar: {
    display: 'flex',
    flexShrink: 0,
    position: 'sticky',
    top: 0,
    height: '100vh',
  },
  iconRail: {
    width: RAIL_W,
    background: colors.textOnLight, // 진한 네이비 — rail 만 어둡게 (포인트)
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: spacing[3],
    gap: spacing[1],
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    background: colors.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
    textDecoration: 'none',
  },
  logoText: {
    color: '#fff',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    letterSpacing: '0.02em',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  iconButtonActive: {
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
  },
  panel: {
    width: PANEL_W,
    background: colors.white,
    borderRight: `1px solid ${colors.borderLight}`,
    paddingTop: spacing[5],
    paddingLeft: spacing[3],
    paddingRight: spacing[3],
  },
  panelTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLightDim,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
    padding: `0 ${spacing[2]}`,
    marginBottom: spacing[3],
  },
  panelList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  panelLink: {
    display: 'block',
    padding: `9px ${spacing[3]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLightDim,
    textDecoration: 'none',
    transition: 'all 0.12s ease',
  },
  panelLinkActive: {
    background: colors.accentSoft,
    color: colors.accent,
    fontWeight: typography.fontWeight.semibold,
  },

  // ─── 콘텐츠 영역 ───
  contentArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  topbar: {
    height: 64,
    background: colors.white,
    borderBottom: `1px solid ${colors.borderLight}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${spacing[6]}`,
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: spacing[3],
  },
  topbarTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    letterSpacing: typography.letterSpacing.tight,
    margin: 0,
  },
  topbarCrumb: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[4],
  },
  adminName: {
    fontSize: typography.fontSize.base,
    color: colors.textOnLight,
    fontWeight: typography.fontWeight.medium,
  },
  backToSite: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    textDecoration: 'none',
    padding: `6px ${spacing[3]}`,
    borderRadius: radius.md,
    border: `1px solid ${colors.borderLight}`,
    transition: 'all 0.12s ease',
  },

  // ─── 본문 ───
  main: {
    flex: 1,
    padding: spacing[6],
    minWidth: 0,
  },
};
