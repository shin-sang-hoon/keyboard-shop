// frontend/src/components/RecentlyViewedSidebar.jsx
//
// 최근 본 상품 우측 fixed 사이드바 (5/15 0:45, swagkey UX 매칭).
//
// 정책:
//   - 비로그인 시 안 보임 (요구사항)
//   - 로그인 + 최근 본 상품 0개 → 안 보임 (스크롤 방해 X)
//   - 로그인 + 1개 이상 → 우측 fixed 표시 (max 5개)
//   - storage event + custom event 둘 다 listen (다른 탭 + 같은 탭)
//
// 카드 디자인:
//   - 60×60 정사각 이미지 + 이름 12자 truncate
//   - 클릭 시 /products/{id} 이동
//   - swagkey 톤: 흰 배경 + 얇은 회색 보더

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getRecentlyViewed } from '../utils/recentlyViewed';
import { colors, typography, spacing, zIndex, radius } from '../styles/tokens';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// 사이드바 표시 안 할 경로 (builder/admin/auth 는 chrome 안 보이는 영역)
const HIDDEN_PATHS = ['/builder', '/login', '/signup', '/auth', '/admin'];

export default function RecentlyViewedSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [productIds, setProductIds] = useState(() => getRecentlyViewed());
  const [products, setProducts] = useState([]);

  // localStorage 변경 감지 (같은 탭 = custom event, 다른 탭 = storage event)
  useEffect(() => {
    const handler = () => setProductIds(getRecentlyViewed());
    window.addEventListener('recentlyViewedChange', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('recentlyViewedChange', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // productIds → 상품 fetch (병렬 GET, 실패한 건 skip)
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
      // null 제거 + productIds 순서 보존
      setProducts(results.filter(Boolean));
    });
    return () => controller.abort();
  }, [productIds, user]);

  // 숨김 조건
  if (!user) return null;
  if (products.length === 0) return null;
  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <aside style={styles.sidebar}>
      <div style={styles.title}>최근 본 상품</div>
      {products.map((p) => (
        <Link key={p.id} to={`/products/${p.id}`} style={styles.card} title={p.name}>
          <div style={styles.imageBox}>
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} style={styles.image} />
            ) : (
              <div style={styles.placeholder}>—</div>
            )}
          </div>
          <div style={styles.name}>{truncate(p.name, 7)}</div>
        </Link>
      ))}
    </aside>
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
  },
  imageBox: {
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
  placeholder: {
    color: colors.textOnLightDim,
    fontSize: 10,
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
