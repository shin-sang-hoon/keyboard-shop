// frontend/src/components/RecentlyViewedSidebar.jsx
//
// 최근 본 상품 우측 fixed 사이드바 (5/15 0:45, swagkey UX 매칭).
// 5/15 1:25 — 각 카드에 X 삭제 버튼 추가 (hover 페이드인, swagkey 패턴).
//
// 정책:
//   - 비로그인 시 안 보임
//   - 빈 상태 안 보임 (스크롤 방해 X)
//   - HIDDEN_PATHS (builder/login/signup/auth/admin) 에선 미표시
//   - 각 카드 hover 시 우측 상단 X 버튼 페이드인
//   - X 클릭: stopPropagation 으로 Link 이동 방지 + localStorage 에서 해당 id 제거

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getRecentlyViewed, removeRecentlyViewed } from '../utils/recentlyViewed';
import { colors, typography, spacing, zIndex, radius } from '../styles/tokens';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const HIDDEN_PATHS = ['/builder', '/login', '/signup', '/auth', '/admin'];

// X 버튼 hover 페이드인 CSS (모바일은 항상 표시)
const HOVER_CSS = `
.sw-recent-card .sw-recent-x {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.sw-recent-card:hover .sw-recent-x {
  opacity: 1;
}
.sw-recent-x:hover {
  background: rgba(0,0,0,0.7) !important;
}
@media (hover: none) {
  .sw-recent-card .sw-recent-x { opacity: 0.7; }
}
`;

export default function RecentlyViewedSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [productIds, setProductIds] = useState(() => getRecentlyViewed());
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const handler = () => setProductIds(getRecentlyViewed());
    window.addEventListener('recentlyViewedChange', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('recentlyViewedChange', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  useEffect(() => {
    if (!user || productIds.length === 0) {
      setProducts([]);
      return;
    }
    const controller = new AbortController();
    Promise.all(
      productIds.map((id) =>
        fetch(`${API_BASE}/products/${id}`, { signal: controller.signal })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (controller.signal.aborted) return;
      setProducts(results.filter(Boolean));
    });
    return () => controller.abort();
  }, [productIds, user]);

  const handleRemove = (e, productId) => {
    e.preventDefault();
    e.stopPropagation();
    removeRecentlyViewed(productId);
  };

  if (!user) return null;
  if (products.length === 0) return null;
  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <>
      <style>{HOVER_CSS}</style>
      <aside style={styles.sidebar}>
        <div style={styles.title}>최근 본 상품</div>
        {products.map((p) => (
          <Link
            key={p.id}
            to={`/products/${p.id}`}
            style={styles.card}
            className="sw-recent-card"
            title={p.name}
          >
            <div style={styles.imageBox}>
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} style={styles.image} />
              ) : (
                <div style={styles.placeholder}>—</div>
              )}
              <button
                type="button"
                className="sw-recent-x"
                style={styles.removeBtn}
                onClick={(e) => handleRemove(e, p.id)}
                aria-label={`${p.name} 최근 목록에서 제거`}
                title="목록에서 제거"
              >
                ×
              </button>
            </div>
            <div style={styles.name}>{truncate(p.name, 7)}</div>
          </Link>
        ))}
      </aside>
    </>
  );
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

const styles = {
  sidebar: {
    position: 'fixed',
    right: spacing[5],
    top: '50%',
    transform: 'translateY(-50%)',
    width: 90,
    zIndex: zIndex.sticky - 1,
    fontFamily: typography.fontFamily.base,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.sm,
    padding: `${spacing[3]} ${spacing[2]}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[3],
  },
  title: {
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLightDim,
    textAlign: 'center',
    marginBottom: spacing[1],
    letterSpacing: '0.02em',
  },
  card: {
    textDecoration: 'none',
    color: colors.textOnLight,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  imageBox: {
    position: 'relative',
    width: 60,
    height: 60,
    background: colors.surface,
    borderRadius: radius.sm,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  placeholder: { color: colors.textOnLightDim, fontSize: 10 },
  removeBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    fontSize: 12,
    lineHeight: 1,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    transition: 'background 0.15s ease',
  },
  name: {
    fontSize: 10,
    color: colors.textOnLight,
    textAlign: 'center',
    lineHeight: 1.3,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    maxWidth: 80,
  },
};
