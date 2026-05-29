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
// 회원 탈퇴 (5/29):
// - 하단 "회원 탈퇴" 영역 → 확인 모달.
// - 모달: 비밀번호 입력(LOCAL 재인증) + 안내. 백엔드가 provider 로 분기하므로
//   KAKAO 유저는 비번을 비워도 됨(안내문 표기).
// - 성공 시 useAuth.withdraw() 가 store 를 비움 → /products 로 이동.
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
  const { user, logout, withdraw } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('orders');

  // 회원 탈퇴 모달 상태
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [pw, setPw] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleLogout() {
    logout();
    navigate('/products', { replace: true });
  }

  function openWithdraw() {
    setPw('');
    setReason('');
    setError('');
    setShowWithdraw(true);
  }

  function closeWithdraw() {
    if (submitting) return; // 처리 중엔 닫기 방지
    setShowWithdraw(false);
  }

  async function handleWithdraw() {
    setSubmitting(true);
    setError('');
    try {
      await withdraw({ password: pw, reason });
      // 성공 — store 비워짐. 안내 후 홈으로.
      setShowWithdraw(false);
      navigate('/products', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      if (status === 400) {
        setError('비밀번호를 입력해 주세요.');
      } else if (status === 401) {
        setError('비밀번호가 일치하지 않습니다.');
      } else if (status === 409) {
        setError('이미 탈퇴 처리된 계정입니다.');
      } else {
        setError(msg || '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
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

        {/* 회원 탈퇴 영역 */}
        <div style={S.dangerZone}>
          <div>
            <div style={S.dangerTitle}>회원 탈퇴</div>
            <div style={S.dangerDesc}>
              탈퇴하면 계정이 비활성화되며, 동일한 이메일로 다시 가입할 수 없습니다.
            </div>
          </div>
          <button onClick={openWithdraw} style={S.dangerBtn}>
            회원 탈퇴
          </button>
        </div>
      </div>

      {/* 탈퇴 확인 모달 */}
      {showWithdraw && (
        <div style={S.backdrop} onClick={closeWithdraw}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={S.modalTitle}>정말 탈퇴하시겠어요?</h3>
            <p style={S.modalText}>
              탈퇴 시 계정이 비활성화되고 <strong>같은 이메일로 재가입할 수 없습니다.</strong>
              <br />
              작성하신 구매평·문의·주문 내역은 보존되며, 작성자는 ‘탈퇴한 회원’으로 표시됩니다.
            </p>

            <label style={S.label}>
              비밀번호 확인
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                style={S.input}
                autoFocus
              />
            </label>
            <p style={S.hint}>
              카카오 로그인으로 가입하셨다면 비밀번호 없이 ‘탈퇴하기’를 눌러주세요.
            </p>

            <label style={S.label}>
              탈퇴 사유 (선택)
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="서비스 개선에 참고하겠습니다"
                style={S.input}
              />
            </label>

            {error && <div style={S.error}>{error}</div>}

            <div style={S.modalActions}>
              <button onClick={closeWithdraw} style={S.cancelBtn} disabled={submitting}>
                취소
              </button>
              <button onClick={handleWithdraw} style={S.confirmBtn} disabled={submitting}>
                {submitting ? '처리 중…' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
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

  // === 회원 탈퇴 영역 ===
  dangerZone: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: spacing[5],
    marginTop: spacing[5],
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  dangerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
  },
  dangerDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    marginTop: spacing[1],
  },
  dangerBtn: {
    background: 'transparent',
    border: '1px solid #dc2626',
    color: '#dc2626',
    padding: `${spacing[2]} ${spacing[4]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    marginLeft: spacing[4],
  },

  // === 모달 ===
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    zIndex: 1000,
  },
  modal: {
    background: colors.white,
    borderRadius: radius.lg,
    padding: spacing[6],
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    marginBottom: spacing[3],
  },
  modalText: {
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
    lineHeight: 1.6,
    margin: 0,
    marginBottom: spacing[5],
  },
  label: {
    display: 'block',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textOnLight,
    marginBottom: spacing[3],
  },
  input: {
    display: 'block',
    width: '100%',
    marginTop: spacing[2],
    padding: spacing[3],
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.base,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: '#94a3b8',
    margin: 0,
    marginTop: `-${spacing[1]}`,
    marginBottom: spacing[4],
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    fontSize: typography.fontSize.sm,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[4],
  },
  modalActions: {
    display: 'flex',
    gap: spacing[2],
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: 'transparent',
    border: `1px solid ${colors.borderLight}`,
    color: colors.textOnLightDim,
    padding: `${spacing[3]} ${spacing[5]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmBtn: {
    background: '#dc2626',
    border: '1px solid #dc2626',
    color: colors.white,
    padding: `${spacing[3]} ${spacing[5]}`,
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
