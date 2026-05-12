// frontend/src/pages/KakaoCallbackPage.jsx
//
// 5-B Day 2 (2026-05-09).
// 카카오 OAuth 콜백 처리 페이지.
//
// HOTFIX (2026-05-09 23:10):
//   증상: 카카오 로그인 자체는 성공 (zustand store 에 저장됨, 헤더에 닉네임 표시)
//        그러나 800ms 후 navigate('/') 가 실행 안 되어 "환영합니다" 화면에 멈춤.
//   원인: useSearchParams 반환값이 매 렌더마다 새 참조 → useEffect 재실행 →
//        cleanup 으로 setTimeout 취소 → handledRef 로 재진입 막혀서 새 setTimeout
//        도 안 걸림 → navigate 영영 호출 안 됨.
//   조치:
//     1) useSearchParams 대신 window.location.search 직접 파싱
//        (useSearchParams 반환값의 매 렌더 참조 변경 회피)
//     2) deps 배열을 [] 로 - 마운트 시 정확히 한 번만 실행
//     3) setTimeout cleanup 제거
//        (navigate 후 unmount 되면 React 가 자동 정리, 명시 cleanup 시 navigate
//         실행 전 취소 위험)
//     4) handledRef 는 유지 (StrictMode 이중 마운트 방어)
//
// URL 패턴:
//   성공:  /auth/kakao/success?accessToken=...&refreshToken=...&email=...&name=...&role=...&state=...
//   실패:  /auth/kakao/success?error=...&error_description=...
//
// 면접 자산:
//   - state 파라미터 검증으로 CSRF 방어. 공격자가 자기 카카오 계정으로 받은 code 를
//     피해자 브라우저에 redirect 시켜도 sessionStorage 의 nonce 가 다르면 거절.
//   - 토큰을 URL 쿼리스트링으로 받는 패턴의 단점 인지: 브라우저 history 잔존.
//     운영 환경에서는 짧은 수명의 exchange code 패턴 권장 (Phase 8 todo).
//   - 토큰 추출 후 즉시 history.replaceState 로 URL 정리해 잔존 시간 최소화.
//   - useEffect deps 와 setTimeout cleanup 의 상호작용 디버깅 (HOTFIX 스토리).

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius } from '../styles/tokens';

const KAKAO_STATE_KEY = 'kakao_oauth_state';

export default function KakaoCallbackPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  // React StrictMode 이중 마운트 방어. ref 라 re-render 시 유지.
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    // useSearchParams 대신 window.location.search 직접 파싱 -
    // 매 렌더 새 참조 발생 회피. 이 페이지는 마운트 시 URL 한 번만 읽으면 충분.
    const sp = new URLSearchParams(window.location.search);

    // ──────────────────────────────────────────────
    // 1) 카카오/백엔드 에러 케이스
    // ──────────────────────────────────────────────
    const errorCode = sp.get('error');
    if (errorCode) {
      const desc = sp.get('error_description');
      sessionStorage.removeItem(KAKAO_STATE_KEY);
      setStatus('error');
      setErrorMessage(translateError(errorCode, desc));
      return;
    }

    // ──────────────────────────────────────────────
    // 2) 토큰 추출
    // ──────────────────────────────────────────────
    const accessToken = sp.get('accessToken');
    const refreshToken = sp.get('refreshToken');
    const email = sp.get('email');
    const name = sp.get('name');
    const role = sp.get('role');
    const stateFromUrl = sp.get('state');

    if (!accessToken || !email) {
      setStatus('error');
      setErrorMessage('인증 정보가 누락되었어요. 다시 로그인해 주세요.');
      return;
    }

    // ──────────────────────────────────────────────
    // 3) state CSRF 검증
    // ──────────────────────────────────────────────
    const stateFromStorage = sessionStorage.getItem(KAKAO_STATE_KEY);
    sessionStorage.removeItem(KAKAO_STATE_KEY); // 한 번만 쓰는 nonce, 즉시 정리

    if (!stateFromStorage || stateFromStorage !== stateFromUrl) {
      setStatus('error');
      setErrorMessage(
        '보안 검증에 실패했어요. 다시 로그인해 주세요. (CSRF 의심)'
      );
      return;
    }

    // ──────────────────────────────────────────────
    // 4) 세션 저장 + URL 정리 + 메인 이동
    // ──────────────────────────────────────────────
    setSession({ accessToken, refreshToken, email, name, role });

    // 토큰을 브라우저 history 에서 제거 (뒤로가기 시 노출 방지).
    window.history.replaceState({}, document.title, '/auth/kakao/success');

    setStatus('success');

    // setTimeout cleanup 의도적으로 등록 안 함 -
    // navigate 후 unmount 되면 setTimeout 콜백은 실행되지 않거나(이미 실행 후) 무해.
    // cleanup 등록하면 deps 변경 시 실행 전 취소되어 navigate 가 호출 안 됨.
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 800);

    // 마운트 시 한 번만 실행. params/setSession/navigate 는 이 effect 안에서만 사용.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={S.page}>
      <div style={S.card}>
        {status === 'loading' && (
          <>
            <h1 style={S.title}>로그인 중...</h1>
            <p style={S.subtitle}>잠시만 기다려주세요.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 style={S.title}>환영합니다 👋</h1>
            <p style={S.subtitle}>잠시 후 메인으로 이동합니다.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 style={S.title}>로그인 실패</h1>
            <p style={S.subtitle}>{errorMessage}</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              style={S.btn}
            >
              로그인 페이지로
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// 백엔드/카카오 에러 코드를 사용자 친화적 메시지로 변환.
function translateError(code, description) {
  if (code === 'login_failed') {
    if (description?.includes('already registered')) {
      return '이미 가입된 이메일이에요. 일반 로그인을 사용해주세요.';
    }
    return description || '카카오 로그인에 실패했어요. 다시 시도해 주세요.';
  }
  if (code === 'missing_code') {
    return '인증 코드가 누락되었어요. 다시 로그인해 주세요.';
  }
  if (code === 'access_denied') {
    return '카카오 로그인 동의가 취소되었어요.';
  }
  if (code === 'internal_error') {
    return '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  }
  return description || '카카오 로그인에 실패했어요.';
}

// =====================================================================
// styles - LoginPage 와 같은 LIGHT 톤
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
    padding: `${spacing[10]} ${spacing[6]}`,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
    textAlign: 'center',
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textOnLight,
    margin: 0,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    color: colors.textOnLightDim,
    fontSize: typography.fontSize.sm,
    marginTop: spacing[3],
    marginBottom: spacing[6],
    lineHeight: 1.6,
  },
  btn: {
    padding: `${spacing[3]} ${spacing[8]}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    background: colors.textOnLight,
    color: colors.white,
    border: 'none',
    borderRadius: radius.md,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
