// frontend/src/hooks/useAuth.js
//
// 5-B 인증 훅. authStore + auth API를 묶어서 페이지/라우트가드에서 공통 사용.
//
// FIX v2 (2026-05-09): axios response unwrap 누락 버그 수정.
// 백엔드 응답 자체는 정상 ({accessToken, email, name, role}) 이었으나
// apiClient.post() 가 axios response 객체 ({data, status, headers, ...}) 를 반환하는데
// useAuth 가 response.email 로 접근해 undefined 가 되어 user 가 빈 객체로 저장됐음.
// → response.data || response 패턴으로 axios response 와 인터셉터-unwrap 응답 둘 다 처리.
//
// 5-B Day 2 (2026-05-09): setSession 추가.
// 카카오 OAuth 콜백 페이지에서 사용. 일반 login() 과 달리 백엔드 호출이 이미 완료된 상태에서
// 토큰을 쿼리스트링으로 받기 때문에 store 세팅만 함. 인증 상태 변경의 단일 진입점 유지.
//
// 면접 자산: axios 응답 구조 이해, 두 가지 클라이언트 구성(인터셉터 유무) 안전 호환,
// useAuth 를 인증 상태 변경의 단일 진입점으로 유지하여 store 직접 접근 분산 방지.

import { useAuthStore } from '../stores/authStore';
import authApi from '../api/auth';

// axios response 객체와 인터셉터로 unwrap 된 응답 둘 다 처리.
// - axios 기본: { data: {...실제응답...}, status, headers } → response.data
// - 인터셉터로 unwrap: 실제응답 → response (response.data 는 undefined 또는 응답 내부의 .data 필드)
function unwrap(response) {
  // axios response 는 항상 .data 안에 응답 body 가 들어있음.
  // 인터셉터가 미리 unwrap 했으면 .data 가 없거나 응답 본문 자체일 수 있는데,
  // 본문에 accessToken/email 같은 핵심 필드가 있는지로 판별.
  if (response && response.data && (response.data.accessToken || response.data.email)) {
    return response.data;
  }
  return response;
}

export function useAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const storeLogout = useAuthStore((s) => s.logout);

  const isAuthenticated = !!accessToken;

  /**
   * 이메일/비번 로그인.
   * 백엔드 응답: { accessToken, refreshToken, email, name, role }
   */
  async function login(email, password) {
    const response = await authApi.login(email, password);
    const data = unwrap(response);
    const userInfo = { id: data.id, email: data.email, name: data.name, role: data.role };

    setAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: userInfo,
    });
    setUser(userInfo);

    return data;
  }

  /**
   * 회원가입. 백엔드가 가입 직후 토큰까지 발급해줘서 자동 로그인 효과.
   */
  async function signup(payload) {
    const response = await authApi.signup(payload);
    const data = unwrap(response);
    const userInfo = { id: data.id, email: data.email, name: data.name, role: data.role };

    setAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: userInfo,
    });
    setUser(userInfo);

    return data;
  }

  /**
   * 카카오 OAuth 콜백 후 세션 저장 (5-B Day 2).
   *
   * 일반 login() 과의 차이:
   *   - login() 은 이메일/비번 → 백엔드 호출 → 토큰 받음.
   *   - setSession() 은 백엔드 OAuth 콜백이 끝난 뒤 KakaoCallbackPage 가
   *     URL 쿼리스트링에서 추출한 토큰을 그대로 store 에 세팅.
   *
   * 왜 별도 메서드인가:
   *   - login() 은 await authApi.login() 으로 백엔드 호출까지 책임.
   *   - 카카오는 호출이 이미 끝나서 store 세팅만 필요. 같은 함수에 분기 두면
   *     의도가 흐려짐 → 별도 메서드로 책임 분리.
   *   - 그래도 useAuth 가 인증 상태 변경의 단일 진입점이라는 원칙은 유지
   *     (KakaoCallbackPage 가 authStore 직접 만지지 않게).
   */
  function setSession({ id, accessToken, refreshToken, email, name, role }) {
    const userInfo = { id, email, name, role };
    setAuth({ accessToken, refreshToken, user: userInfo });
    setUser(userInfo);
  }

  /**
   * 로그아웃. 서버 호출은 fire-and-forget. store만 비우면 즉시 로그아웃.
   */
  function logout() {
    authApi.logout().catch(() => {});
    storeLogout();
  }

  /**
   * 토큰은 살아있는데 user 정보만 갱신하고 싶을 때.
   */
  async function refreshUser() {
    const response = await authApi.me();
    const data = unwrap(response);
    setUser({ id: data.id, email: data.email, name: data.name, role: data.role });
    return data;
  }

  return {
    user,
    isAuthenticated,
    login,
    signup,
    setSession,
    logout,
    refreshUser,
  };
}

export default useAuth;
