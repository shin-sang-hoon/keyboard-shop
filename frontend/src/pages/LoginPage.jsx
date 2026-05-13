// frontend/src/pages/LoginPage.jsx
//
// 5-B Day 2 (2026-05-09) - 카카오 로그인 활성화.
// 5-B Round 3 (2026-05-13) - 회원가입 링크 /signup → /signup/type (가입 방식 선택 페이지).
//
// Day 1 → Day 2 변경:
//   - "카카오로 시작하기 (준비 중)" disabled 버튼 → 활성화.
//   - 클릭 시 handleKakaoLogin: state(CSRF nonce) 생성 → sessionStorage 저장
//     → 백엔드 /api/auth/kakao/authorize-url 호출 → 받은 URL 로 location.href.
//   - 그 외 디자인/이메일 로그인 흐름은 Day 1 그대로 유지.
//
// 면접 자산:
//   - state 파라미터로 CSRF 방어. 카카오가 콜백에서 그대로 돌려보낸 state 와
//     sessionStorage 값을 KakaoCallbackPage 에서 비교. 일치 안 하면 재로그인 요구.
//   - 인가 URL 을 백엔드에서 발급받는 패턴: client_id/redirect_uri 같은 OAuth 설정을
//     프론트가 알 필요 없게. multi-provider 확장도 같은 패턴 재활용.

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius } from '../styles/tokens';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const KAKAO_STATE_KEY = 'kakao_oauth_state';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  const redirectTo = location.state?.from?.pathname || '/products';

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        '로그인 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 카카오 로그인 시작.
   * 1) CSRF nonce 생성 (crypto.randomUUID, 브라우저 표준)
   * 2) sessionStorage 저장 (탭 닫으면 자동 정리)
   * 3) 백엔드에 인가 URL 요청 → 받은 URL 로 location.href
   * 4) 카카오 동의 화면 → 백엔드 콜백 → 프론트 /auth/kakao/success 로 redirect
   */
  async function handleKakaoLogin() {
    if (kakaoLoading) return;
    setError('');
    setKakaoLoading(true);

    try {
      const state = crypto.randomUUID();
      sessionStorage.setItem(KAKAO_STATE_KEY, state);

      const res = await fetch(
        `${API_BASE}/auth/kakao/authorize-url?state=${encodeURIComponent(state)}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data?.url) {
        throw new Error('인가 URL 응답이 비어있어요.');
      }

      // 카카오 동의 화면으로 이동. 이후 흐름은 KakaoCallbackPage 에서 처리.
      window.location.href = data.url;
    } catch (err) {
      sessionStorage.removeItem(KAKAO_STATE_KEY);
      setError(
        '카카오 로그인 시작에 실패했어요. 잠시 후 다시 시도해 주세요.'
      );
      setKakaoLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>로그인</h1>
        <p style={S.subtitle}>이메일로 로그인하거나 카카오로 시작하세요</p>

        <form onSubmit={handleSubmit} noValidate>
          <label style={S.label}>
            <span style={S.labelText}>이메일</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={S.input}
              placeholder="you@example.com"
            />
          </label>

          <label style={S.label}>
            <span style={S.labelText}>비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              style={S.input}
              placeholder="••••••••"
            />
          </label>

          {error && <div style={S.error}>{error}</div>}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            style={{
              ...S.primaryBtn,
              ...(submitting || !email || !password ? S.btnDisabled : {}),
            }}
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={S.divider}>
          <span style={S.dividerLine} />
          <span style={S.dividerText}>또는</span>
          <span style={S.dividerLine} />
        </div>

        <button
          type="button"
          onClick={handleKakaoLogin}
          disabled={kakaoLoading}
          style={{
            ...S.kakaoBtn,
            ...(kakaoLoading ? S.btnDisabled : {}),
          }}
        >
          {kakaoLoading ? '카카오로 이동 중...' : '카카오로 시작하기'}
        </button>

        <div style={S.footer}>
          처음이신가요?{' '}
          <Link to="/signup/type" style={S.link}>
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// styles - LIGHT 톤 (Day 1 그대로)
// =====================================================================

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    background: colors.surface,
    fontFamily: typography.fontFamily.base,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: `${spacing[8]} ${spacing[6]}`,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
    marginBottom: spacing[6],
  },
  label: {
    display: 'block',
    marginBottom: spacing[4],
  },
  labelText: {
    display: 'block',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textOnLight,
    marginBottom: spacing[2],
  },
  input: {
    width: '100%',
    padding: spacing[3],
    fontSize: typography.fontSize.base,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.md,
    color: colors.textOnLight,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  error: {
    background: '#fef2f2',
    border: `1px solid #fecaca`,
    color: '#b91c1c',
    padding: spacing[3],
    borderRadius: radius.md,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[4],
  },
  primaryBtn: {
    width: '100%',
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    background: colors.textOnLight,
    color: colors.white,
    border: 'none',
    borderRadius: radius.md,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  kakaoBtn: {
    width: '100%',
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    background: '#FEE500',
    color: '#191919',
    border: 'none',
    borderRadius: radius.md,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    margin: `${spacing[5]} 0`,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: colors.borderLight,
  },
  dividerText: {
    fontSize: typography.fontSize.sm,
    color: '#94a3b8',
  },
  footer: {
    marginTop: spacing[5],
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.textOnLightDim,
  },
  link: {
    color: colors.textOnLight,
    textDecoration: 'underline',
    fontWeight: typography.fontWeight.semibold,
    textUnderlineOffset: '3px',
  },
};
