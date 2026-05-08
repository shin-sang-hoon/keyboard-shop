// frontend/src/stores/authStore.js
// JWT access/refresh + 유저 정보. localStorage 영속화.
//
// 사용 예시:
//   const accessToken = useAuthStore((s) => s.accessToken);
//   const { setAuth, logout } = useAuthStore();
//   const isLoggedIn = useAuthStore((s) => !!s.accessToken);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // === state ===
      accessToken: null,
      refreshToken: null,
      user: null, // { id, email, nickname, role, ... }

      // === actions ===
      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),

      setAccessToken: (accessToken) => set({ accessToken }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null }),

      // === getters ===
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'auth-storage', // localStorage key
      // 보안 강화 시 refreshToken 은 HttpOnly cookie 로 옮기고 여기서 빼면 됨
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
