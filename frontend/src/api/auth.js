// frontend/src/api/auth.js
// 인증 관련 API. 백엔드 엔드포인트 경로는 실제 Spring 컨트롤러에 맞춰
// 필요시 수정하세요 (특히 /signup vs /register 등).

import apiClient from './client';

export const authApi = {
  // POST /api/auth/login
  // body: { email, password }
  // returns: { accessToken, refreshToken, user }
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }),

  // POST /api/auth/signup
  // body: { email, password, nickname, ... }
  signup: (data) => apiClient.post('/auth/signup', data),

  // POST /api/auth/logout
  logout: () => apiClient.post('/auth/logout'),

  // POST /api/auth/refresh - 인터셉터 내부에서 raw axios 로 호출하므로
  // 여기는 수동 호출 (예: 로그인 직후 검증) 용도
  refresh: (refreshToken) =>
    apiClient.post('/auth/refresh', { refreshToken }),

  // GET /api/auth/me - 현재 로그인 유저 정보
  me: () => apiClient.get('/auth/me'),
};

export default authApi;
