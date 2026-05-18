// frontend/src/components/CartSyncEffect.jsx
// Phase 8 5-D Round 2 (2026-05-19) — 장바구니 자동 sync 컴포넌트.
//
// 책임:
//   - 로그인 직후 (또는 새로고침 시 토큰 살아있음 감지) → cartStore.syncToServer()
//   - 로그아웃 직후 → cartStore.onLogout() (serverCart 비우기, localStorage items 유지)
//
// 왜 별도 컴포넌트로 분리:
//   1. 단일 책임 원칙 — App.jsx 는 라우트 정의에 집중
//   2. useEffect 와 zustand selector 가 한 곳에 모여 인지 부담 ↓
//   3. 장기적으로 confirm 처리 / navigate 같은 React Router context 활용 여지
//   4. 테스트 용이성 — CartSyncEffect 만 따로 mount 해도 동작 검증 가능
//
// 동작 흐름:
//   accessToken null  → onLogout()         (serverCart=null, items 유지)
//   accessToken 새 값 → syncToServer()      (localStorage 머지 + 최신 cart fetch)
//
// 렌더링 결과: null (children 없음, 부수효과 전용 컴포넌트)

import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';

export default function CartSyncEffect() {
  // zustand selector — accessToken 변경 시 컴포넌트 리렌더링 → useEffect 재실행
  const accessToken = useAuthStore((s) => s.accessToken);
  const syncToServer = useCartStore((s) => s.syncToServer);
  const onCartLogout = useCartStore((s) => s.onLogout);

  useEffect(() => {
    if (accessToken) {
      // 로그인 상태 — localStorage 카트가 있으면 백엔드에 머지, 없으면 단순 fetch
      syncToServer().then((r) => {
        if (r?.ok) {
          const count = r.serverCart?.totalQuantity ?? 0;
          console.log(`[Cart] synced from server: ${count} items`);
        } else if (r?.message) {
          console.warn('[Cart] sync skipped:', r.message);
        }
      }).catch((err) => {
        console.error('[Cart] sync error:', err);
      });
    } else {
      // 로그아웃 상태 — serverCart 비우기 (localStorage items 는 유지 → 비로그인 카트 보존)
      onCartLogout();
    }
  }, [accessToken, syncToServer, onCartLogout]);

  // 부수효과 전용 — 렌더링 X
  return null;
}
