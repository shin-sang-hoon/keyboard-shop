// frontend/src/hooks/useAuth.js
//
// 5-B 인증 훅. authStore + auth API를 묶어서 페이지/라우트가드에서 공통 사용.
//
// 사용 예시:
//   const { user, isAuthenticated, login, signup, logout } = useAuth();
//
// 설계 노트:
// - authStore의 setAuth는 동기 set이지만, login/signup은 네트워크 호출이라 async.
//   이 훅이 그 둘을 묶어서 컴포넌트가 한 단계 위에서 다룰 수 있게 함.
// - 에러는 throw로 흘려보내서 페이지가 try/catch로 사용자 메시지 표시.

import { useAuthStore } from '../stores/authStore';
import authApi from '../api/auth';

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
    const data = await authApi.login(email, password);
    setAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: { email: data.email, name: data.name, role: data.role },
    });
    return data;
  }

  /**
   * 회원가입. 백엔드가 가입 직후 토큰까지 발급해줘서 자동 로그인 효과.
   */
  async function signup(payload) {
    const data = await authApi.signup(payload);
    setAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: { email: data.email, name: data.name, role: data.role },
    });
    return data;
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
    const data = await authApi.me();
    setUser({ email: data.email, name: data.name, role: data.role });
    return data;
  }

  return {
    user,
    isAuthenticated,
    login,
    signup,
    logout,
    refreshUser,
  };
}

export default useAuth;
