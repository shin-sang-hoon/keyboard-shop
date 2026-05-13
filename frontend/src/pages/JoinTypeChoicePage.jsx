// frontend/src/pages/JoinTypeChoicePage.jsx
//
// 5-B Round 3 (2026-05-13) - 스웨그키 가입 1단계 복제.
//
// 흐름:
//   1) "카카오로 시작하기" → handleKakaoLogin (LoginPage 와 동일 흐름)
//   2) "ID/PW 회원가입" → /signup/agree 로 이동
//
// 면접 자산:
//   - 가입 방식 분기 페이지로 카카오 우선 노출 (스웨그키 패턴).
//   - 카카오 인가 URL 발급 + state CSRF nonce 패턴은 LoginPage 와 1:1 동일.
//     중복 코드지만 페이지가 다른 책임이라 추상화 보류 (Phase 8 정리 후보).

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { colors, typography, spacing, radius } from '../styles/tokens';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const KAKAO_STATE_KEY = 'kakao_oauth_state';

export default function JoinTypeChoicePage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [kakaoLoading, setKakaoLoading] = useState(false);

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data?.url) throw new Error('인가 URL 응답이 비어있어요.');

      window.location.href = data.url;
    } catch (err) {
      sessionStorage.removeItem(KAKAO_STATE_KEY);
      setError('카카오 로그인 시작에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setKakaoLoading(false);
    }
  }

  function handleIdPwSignup() {
    navigate('/signup/agree');
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>회원가입</h1>
        <p style={S.subtitle}>가입 방식을 선택해주세요</p>

        {error && <div style={S.error}>{error}</div>}

        <button
          type="button"
          onClick={handleKakaoLogin}
          disabled={kakaoLoading}
          style={{
            ...S.kakaoBtn,
            ...(kakaoLoading ? S.btnDisabled : {}),
          }}
        >
          <img
            src="/icons/kakao.png"
            alt=""
            aria-hidden="true"
            style={S.kakaoIcon}
          />
          {kakaoLoading ? '카카오로 이동 중...' : '카카오로 시작하기'}
        </button>

        <div style={S.divider}>
          <span style={S.dividerLine} />
          <span style={S.dividerText}>또는</span>
          <span style={S.dividerLine} />
        </div>

        <button
          type="button"
          onClick={handleIdPwSignup}
          style={S.idpwBtn}
        >
          ID/PW 회원가입
        </button>

        <div style={S.footer}>
          이미 계정이 있나요?{' '}
          <Link to="/login" style={S.link}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}

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
    maxWidth: 480,
    background: colors.white,
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.lg,
    padding: `${spacing[10]} ${spacing[8]}`,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    letterSpacing: typography.letterSpacing.tight,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    marginTop: spacing[2],
    marginBottom: spacing[8],
    textAlign: 'center',
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
  kakaoBtn: {
    width: '100%',
    padding: `${spacing[4]} ${spacing[4]}`,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    background: '#FEE500',
    color: '#191919',
    border: 'none',
    borderRadius: radius.md,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  kakaoIcon: {
    width: 22,
    height: 22,
    display: 'block',
    objectFit: 'contain',
    background: '#FEE500',
    borderRadius: '18%',
  },
  idpwBtn: {
    width: '100%',
    padding: `${spacing[4]} ${spacing[4]}`,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    background: colors.white,
    color: colors.textOnLight,
    border: `1px solid ${colors.borderLight}`,
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
    marginTop: spacing[8],
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
