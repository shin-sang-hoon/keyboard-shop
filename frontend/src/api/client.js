// frontend/src/api/client.js
// axios 인스턴스 + JWT 자동 첨부 + 401 Refresh 플로우
//
// 핵심 설계:
//  1. Request 인터셉터: authStore 에서 accessToken 가져와 Authorization 헤더 첨부
//  2. Response 인터셉터: 401 발생 시
//     - refresh 진행 중이면 큐에 대기 (동시 다발 401 방지)
//     - refresh 성공 → 원본 요청 재시도
//     - refresh 실패 → logout
//  3. 모든 도메인 API (products, auth, reviews, ...) 가 이 인스턴스 사용

import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const baseURL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ============================================================================
// Request 인터셉터 - JWT Access 자동 첨부
// ============================================================================
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================================
// 401 Refresh 큐 (동시 다발 401 방지)
// ============================================================================
let isRefreshing = false;
let refreshQueue = [];

function flushQueue(error, token = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
}

// ============================================================================
// Response 인터셉터 - 401 시 Refresh 시도
// ============================================================================
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401 이 아니거나 이미 retry 한 요청이면 그대로 reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // refresh 엔드포인트 자체가 401 이면 즉시 logout
    if (originalRequest.url?.includes('/auth/refresh')) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    // 다른 요청이 refresh 중이면 큐에 대기
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      // refresh 요청은 apiClient 가 아니라 raw axios 로 (인터셉터 무한 루프 방지)
      const { data } = await axios.post(`${baseURL}/auth/refresh`, {
        refreshToken,
      });

      const newAccessToken = data.accessToken;
      useAuthStore.getState().setAccessToken(newAccessToken);

      flushQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
