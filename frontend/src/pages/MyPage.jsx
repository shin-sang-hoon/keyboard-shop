// frontend/src/pages/MyPage.jsx
//
// 5-B 마이페이지 골격 (LIGHT 톤).
//
// 동작:
// - 헤더: 이름 + 이메일 + 로그아웃 버튼
// - 탭 3개: 주문내역 / 찜한 상품 / 작성한 리뷰
// - 각 탭은 placeholder (5-D 주문, 5-H 찜/리뷰 작업 시 본격 구현)
// - 로그아웃 시 store 비우고 /products로 이동
//
// 보호: ProtectedRoute로 감싸져 있어서 비로그인 진입 불가.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius } from '../styles/tokens';

const TABS = [
  { id: 'orders', label: '주문내역', plannedPhase: '5-D 장바구니/주문' },
  { id: 'wishlist', label: '찜한 상품', plannedPhase: '5-H 도메인 확장' },
  { id: 'reviews', label: '작성한 리뷰', plannedPhase: '5-H 도메인 확장' },
];

export default function MyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('orders');

  function handleLogout() {
    logout();
    navigate('/products', { replace: true });
  }

  const currentTab = TABS.find((t) => t.id === activeTab);

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* 프로필 헤더 */}
        <div style={S.header}>
          <div>
            <div style={S.name}>{user?.name || '회원'}</div>
            <div style={S.email}>{user?.email}</div>
            {user?.role === 'ADMIN' && (
              <span style={S.adminBadge}>관리자</span>
            )}
          </div>
          <button onClick={handleLogout} style={S.logoutBtn}>
            로그아웃
          </button>
        </div>

        {/* 탭 */}
        <div style={S.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...S.tab,
                ...(activeTab === tab.id ? S.tabActive : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 내용 (placeholder) */}
        <div style={S.tabContent}>
          <div style={S.placeholder}>
            <div style={S.placeholderIcon}>📋</div>
            <h3 style={S.placeholderTitle}>{currentTab.label}</h3>
            <p style={S.placeholderText}>
              {currentTab.plannedPhase} 단계에서 구현 예정입니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: colors.surface,
    fontFamily: typography.fontFamily.base,
    padding: `${spacing[6]} ${spacing[4]}`,
  },
  container: {
    maxWidth: 880,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: spacing[6],
    marginBottom: spacing[5],
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  name: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    letterSpacing: typography.letterSpacing.base,
  },
  email: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    marginTop: spacing[1],
  },
  adminBadge: {
    display: 'inline-block',
    marginTop: spacing[2],
    padding: `2px ${spacing[2]}`,
    background: colors.interviewSoft,
    color: colors.interview,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    borderRadius: radius.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  logoutBtn: {
    background: 'transparent',
    border: `1px solid ${colors.borderLight}`,
    color: colors.textOnLightDim,
    padding: `${spacing[2]} ${spacing[4]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabs: {
    display: 'flex',
    gap: spacing[1],
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    padding: spacing[1],
    marginBottom: spacing[4],
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  tab: {
    flex: 1,
    padding: spacing[3],
    background: 'transparent',
    border: 'none',
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    borderRadius: radius.sm,
    fontFamily: 'inherit',
  },
  tabActive: {
    background: colors.surfaceMuted,
    color: colors.textOnLight,
    fontWeight: typography.fontWeight.semibold,
  },
  tabContent: {
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: spacing[8],
    minHeight: 280,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  placeholder: {
    textAlign: 'center',
    padding: `${spacing[6]} ${spacing[4]}`,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  placeholderTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[2],
  },
  placeholderText: {
    fontSize: typography.fontSize.sm,
    color: '#94a3b8',
    margin: 0,
  },
};
