// frontend/src/components/Header.jsx
// 5-J (5/13) — 메뉴 재편: Main / Keyboards / Keycaps / Switches / Accessories
//
// 변경 사항 (3-M → 3-N):
//   - 5-J ProductType 재편: MOUSE @Deprecated → KEYCAP 신설
//   - 최종 메뉴: Main / Keyboards / Keycaps / Switches / Accessories
//   - 모두 productType 으로 백엔드 연동 (Keycaps=KEYCAP, Switches=SWITCH_PART)
//
// 누적 반영 (3-D ~ 3-N): SWACHRON 로고, 활성 알약 반전, 메인 페이지 오버레이 모드,
// 메뉴 폰트 키움, swagkey 톤 글씨체, Search 시 우측 액션 dim, SearchOverlay swagkey 매칭,
// hover dim 우측 액션만, SNS 제거, 사용자 이름도 hover dim

import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { colors, typography, spacing, zIndex, radius } from '../styles/tokens';
import { useAuth } from '../hooks/useAuth';
import SearchOverlay from './SearchOverlay';

const HOVER_CSS = `
.sw-action-hover {
  transition: opacity 0.15s ease;
}
.sw-action-hover:hover {
  opacity: 0.55;
}
`;

// ─── 메뉴 데이터 (3-N 최종) ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Main',        to: '/',                                    exact: true },
  { label: 'Keyboards',   to: '/products?productType=KEYBOARD',       type: 'KEYBOARD' },
  { label: 'Keycaps',     to: '/products?productType=KEYCAP',         type: 'KEYCAP' },
  { label: 'Switches',    to: '/products?productType=SWITCH_PART',    type: 'SWITCH_PART' },
  { label: 'Accessories', to: '/products?productType=ACCESSORY',      type: 'ACCESSORY' },
  { label: 'Auctions',    to: '/auctions' },
];

function displayName(user) {
  if (!user) return '';
  return (
    user.name ||
    user.userName ||
    user.username ||
    user.nickname ||
    user.displayName ||
    user.fullName ||
    user.email?.split('@')[0] ||
    '회원'
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef(null);

  // 외부 클릭 시 admin 드롭다운 닫기
  useEffect(() => {
    if (!adminMenuOpen) return;
    const handler = (e) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target)) {
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [adminMenuOpen]);

  const isAdmin = user?.role === 'ADMIN';

  const isOverlay = location.pathname === '/';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (item) => {
    if (item.exact) return location.pathname === '/';
    if (location.pathname !== '/products') return false;
    const params = new URLSearchParams(location.search);
    if (item.search) return params.get('search') === item.search;
    return params.get('productType') === item.type;
  };

  const textColor = isOverlay ? colors.white : colors.textOnLight;

  const headerStyle = {
    ...styles.header,
    position: isOverlay ? 'absolute' : 'sticky',
    backgroundColor: isOverlay ? 'transparent' : colors.white,
    borderBottom: isOverlay
      ? '1px solid rgba(255,255,255,0.15)'
      : `1px solid ${colors.borderLight}`,
  };

  const actionsStyle = {
    ...styles.actions,
    opacity: searchOpen ? 0.4 : 1,
    transition: 'opacity 0.2s ease',
  };

  const linkStyle = { ...styles.actionLink, color: textColor };
  const btnStyle  = { ...styles.actionBtn,  color: textColor };
  const userNameStyle = { ...styles.userName, color: textColor };
  const navItemStyle  = { ...styles.navItem,  color: textColor };
  const navItemActiveStyle = isOverlay
    ? { ...styles.navItem, background: colors.white, color: colors.textOnLight }
    : { ...styles.navItem, background: colors.textOnLight, color: colors.white };
  const logoStyle = { ...styles.logo, color: textColor };

  return (
    <>
      <style>{HOVER_CSS}</style>

      <header style={headerStyle}>
        <div style={styles.topRow}>
          <div />

          <Link to="/" style={logoStyle}>SWACHRON</Link>

          <nav style={actionsStyle}>
            <button
              onClick={() => setSearchOpen(true)}
              className="sw-action-hover"
              style={btnStyle}
            >
              Search
            </button>

            {user ? (
              <>
                <span className="sw-action-hover" style={userNameStyle}>
                  {displayName(user)}
                </span>
                <button onClick={handleLogout} className="sw-action-hover" style={btnStyle}>Logout</button>
                <Link to="/mypage" className="sw-action-hover" style={linkStyle}>Mypage</Link>
              </>
            ) : (
              <>
                <Link to="/login"  className="sw-action-hover" style={linkStyle}>Login</Link>
                <Link to="/signup" className="sw-action-hover" style={linkStyle}>Register</Link>
                <Link to="/login"  className="sw-action-hover" style={linkStyle}>Mypage</Link>
              </>
            )}

            {isAdmin && (
              <div ref={adminMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setAdminMenuOpen((v) => !v)}
                  className="sw-action-hover"
                  style={{ ...btnStyle, fontWeight: typography.fontWeight.semibold }}
                >
                  Admin ▾
                </button>
                {adminMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: '180px',
                    background: colors.white,
                    border: `1px solid ${colors.borderLight}`,
                    borderRadius: radius.md,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                    zIndex: zIndex.sticky + 1,
                  }}>
                    <Link
                      to="/admin/flash-deals"
                      onClick={() => setAdminMenuOpen(false)}
                      style={{
                        display: 'block',
                        padding: `${spacing[3]} ${spacing[4]}`,
                        fontSize: typography.fontSize.sm,
                        color: colors.textOnLight,
                        textDecoration: 'none',
                        borderBottom: `1px solid ${colors.borderLight}`,
                      }}
                    >
                      🔥 플래시 경매 관리
                    </Link>
                    <Link
                      to="/admin/audit-logs"
                      onClick={() => setAdminMenuOpen(false)}
                      style={{
                        display: 'block',
                        padding: `${spacing[3]} ${spacing[4]}`,
                        fontSize: typography.fontSize.sm,
                        color: colors.textOnLight,
                        textDecoration: 'none',
                      }}
                    >
                      📋 감사 로그
                    </Link>
                  </div>
                )}
              </div>
            )}
            <Link to="/cart" className="sw-action-hover" style={linkStyle}>Cart</Link>
          </nav>
        </div>

        <nav style={styles.bottomRow}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.label}
                to={item.to}
                style={active ? navItemActiveStyle : navItemStyle}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </>
  );
}

const styles = {
  header: {
    top: 0, left: 0, right: 0,
    zIndex: zIndex.sticky,
    fontFamily: typography.fontFamily.base,
    transition: 'background 0.2s, border-color 0.2s',
  },
  topRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    padding: `${spacing[5]} ${spacing[8]}`,
    gap: spacing[4],
  },
  logo: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.extrabold,
    textDecoration: 'none',
    letterSpacing: '0.04em',
    justifySelf: 'center',
  },
  actions: {
    display: 'flex',
    gap: spacing[5],
    alignItems: 'center',
    justifySelf: 'end',
  },
  actionLink: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    textDecoration: 'none',
  },
  actionBtn: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },
  userName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'default',
  },
  bottomRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: spacing[6],
    padding: `${spacing[4]} ${spacing[8]} ${spacing[5]}`,
  },
  navItem: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.medium,
    textDecoration: 'none',
    padding: `${spacing[3]} ${spacing[10]}`,
    borderRadius: radius.pill,
    letterSpacing: '0.02em',
    transition: 'all 0.15s',
  },
};
