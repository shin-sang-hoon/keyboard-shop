// frontend/src/api/auth.js
// 인증 관련 API. 백엔드 엔드포인트 경로는 실제 Spring 컨트롤러에 맞춰
// 필요시 수정하세요 (특히 /signup vs /register 등).
//
// 5-B fix (5/12): 모든 함수가 axios response.data (= 백엔드 JSON body) 를
// 반환하도록 통일. 이전엔 axios response 전체를 반환해서 useAuth 에서
// data.accessToken 이 undefined → 토큰 저장 실패 → 로그인 후 /login 머무름.
//
// 5/29: 비밀번호 찾기/재설정 + 아이디 찾기 3종 추가.

import apiClient from './client';

export const authApi = {
  // POST /api/auth/login
  // body: { email, password }
  // returns: { accessToken, refreshToken, email, name, role }
  login: async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  // POST /api/auth/signup
  // body: { email, password, name }
  // returns: { accessToken, refreshToken, email, name, role }
  signup: async (data) => {
    const res = await apiClient.post('/auth/signup', data);
    return res.data;
  },

  // POST /api/auth/logout
  logout: async () => {
    const res = await apiClient.post('/auth/logout');
    return res.data;
  },

  // POST /api/auth/refresh - 인터셉터 내부에서 raw axios 로 호출하므로
  // 여기는 수동 호출 (예: 로그인 직후 검증) 용도
  refresh: async (refreshToken) => {
    const res = await apiClient.post('/auth/refresh', { refreshToken });
    return res.data;
  },

  // GET /api/auth/me - 현재 로그인 유저 정보
  me: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  // POST /api/auth/withdraw - 회원 탈퇴 (soft delete)
  // body: { password, reason }  (KAKAO 는 password 생략 가능)
  // 본인 토큰으로만 동작 (SecurityContext email). 200 OK 후 프론트가 토큰 폐기.
  withdraw: async ({ password, reason } = {}) => {
    const res = await apiClient.post('/auth/withdraw', { password, reason });
    return res.data;
  },

  // POST /api/auth/password/forgot - 비밀번호 찾기 요청 (재설정 메일 발송)
  // body: { email }
  // 항상 200 (enumeration 방지). 실제 ACTIVE+LOCAL 계정만 메일 발송.
  forgotPassword: async (email) => {
    const res = await apiClient.post('/auth/password/forgot', { email });
    return res.data;
  },

  // POST /api/auth/password/reset - 비밀번호 재설정 (메일 링크의 토큰 사용)
  // body: { token, newPassword }
  // 토큰 검증(존재/미사용/미만료) 후 변경. 실패 시 400/403.
  resetPassword: async (token, newPassword) => {
    const res = await apiClient.post('/auth/password/reset', { token, newPassword });
    return res.data;
  },

  // POST /api/auth/email/find - 아이디(이메일) 찾기
  // body: { name }
  // returns: { emails: ["po*****@gmail.com", ...] }  (마스킹, 동명이인 가능)
  findEmail: async (name) => {
    const res = await apiClient.post('/auth/email/find', { name });
    return res.data;
  },
};

export default authApi;
