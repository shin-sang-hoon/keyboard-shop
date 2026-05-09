// frontend/src/pages/LoginPage.jsx
//
// 5-B 로그인 페이지 (LIGHT 톤 - 스웨그키 스타일).
//
// 디자인:
// - 페이지 배경: surface (#f8fafc) - 살짝 회색끼
// - 카드: 흰 배경 + 부드러운 그림자
// - 텍스트: textOnLight 계열 (다크 화면에서 light로 갈아끼움)
// - 메인 쇼핑몰과 톤 통일
//
// 동작:
// - 이메일/비번 입력 → useAuth().login() → store 갱신 → 원래 가려던 곳 또는 /products
// - 401: "Invalid email or password" 표시 (백엔드가 user enumeration 방지로 동일 메시지)

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius } from '../styles/tokens';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
          disabled
          title="5-B Day 2 작업 예정"
          style={{ ...S.kakaoBtn, ...S.btnDisabled }}
        >
          카카오로 시작하기 (준비 중)
        </button>

        <div style={S.footer}>
          처음이신가요?{' '}
          <Link to="/signup" style={S.link}>
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// styles - LIGHT 톤
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
    background: colors.textOnLight, // 검정 버튼 (스웨그키 톤)
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
