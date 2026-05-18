// frontend/src/stores/cartStore.js
// Phase 8 5-D (2026-05-18) — 장바구니 글로벌 스토어 (풀스택).
//
// 기존 (5/9, localStorage only) → 풀스택 진화:
//   - 비로그인 → localStorage (기존 동작 보존)
//   - 로그인 → 백엔드 API 동기화 (신규)
//   - 핫딜 가드 응답 처리 (신규)
//   - 자동 sync (로그인 직후, 로그아웃 시) (신규)
//
// 기존 시그니처는 호환 유지 (totalCount, totalPrice, hasItem) — 다른 컴포넌트 안 깨짐.
//
// 사용 예시:
//   const totalCount = useCartStore((s) => s.totalCount());
//   const { addItem, removeItem } = useCartStore();
//   await addItem(product, 1);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as cartApi from '../api/cart';
import { useAuthStore } from './authStore';

export const useCartStore = create(
  persist(
    (set, get) => ({
      // === state ===
      // 비로그인 카트 (localStorage 영속화)
      items: [], // [{ productId, name, price, imageUrl, brandName, quantity }]

      // 로그인 카트 (백엔드 응답)
      // null = 아직 fetch 안 됨, {} = fetch 했지만 비어있음
      serverCart: null, // { id, items: [...], totalPrice, totalQuantity, updatedAt }

      lastSyncedAt: null,

      // ─── 헬퍼 (내부) ──────────────────────────────────

      /** 현재 로그인 상태 (authStore 참조) */
      _isLogged: () => useAuthStore.getState().isAuthenticated(),

      // ─── 표시용 getters ──────────────────────────────

      /**
       * 표시용 아이템 리스트. 로그인 시 백엔드 items, 비로그인 시 localStorage items.
       */
      getDisplayItems: () => {
        const isLogged = get()._isLogged();
        if (isLogged && get().serverCart) {
          return get().serverCart.items ?? [];
        }
        return get().items;
      },

      /**
       * 총 quantity (Header 배지 + Cart 페이지 총합).
       */
      getTotalQuantity: () => {
        const isLogged = get()._isLogged();
        if (isLogged && get().serverCart) {
          return get().serverCart.totalQuantity ?? 0;
        }
        return get().items.reduce((acc, it) => acc + (it.quantity ?? 0), 0);
      },

      /**
       * 총 가격.
       */
      getTotalPrice: () => {
        const isLogged = get()._isLogged();
        if (isLogged && get().serverCart) {
          return get().serverCart.totalPrice ?? 0;
        }
        return get().items.reduce((acc, it) => acc + (it.price ?? 0) * (it.quantity ?? 0), 0);
      },

      // ─── 기존 시그니처 호환 (5/9 → 5/18 보존) ────────

      /** @deprecated use getTotalQuantity() instead */
      totalCount: () => get().getTotalQuantity(),

      /** @deprecated use getTotalPrice() instead */
      totalPrice: () => get().getTotalPrice(),

      /** 특정 product 가 카트에 있는지 */
      hasItem: (productId) => {
        const items = get().getDisplayItems();
        return items.some((it) => it.productId === productId);
      },

      // ─── actions ──────────────────────────────────────

      /**
       * 상품 담기. 로그인 여부 자동 분기.
       *
       * @param {Object} product { id, name, imageUrl, price, brand: { name } } 또는 { id, name, price, ... }
       * @param {number} quantity
       * @returns {Promise<{ok: boolean, message?: string}>}
       */
      addItem: async (product, quantity = 1) => {
        const isLogged = get()._isLogged();

        if (isLogged) {
          // 로그인: 백엔드 호출 + serverCart 업데이트
          try {
            const updated = await cartApi.addCartItem(product.id, quantity);
            set({ serverCart: updated });
            return { ok: true };
          } catch (err) {
            const msg = err?.response?.data?.message || '장바구니 담기 실패';
            return { ok: false, message: msg };
          }
        } else {
          // 비로그인: localStorage 추가 (기존 동작 보존)
          const items = [...get().items];
          const existing = items.find((it) => it.productId === product.id);
          if (existing) {
            existing.quantity += quantity;
          } else {
            items.push({
              productId: product.id,
              name: product.name,
              price: product.price,
              imageUrl: product.imageUrl || product.images?.[0]?.url || null,
              brandName: product.brand?.name || product.brandName || null,
              quantity,
            });
          }
          set({ items });
          return { ok: true };
        }
      },

      /**
       * 수량 변경.
       * @param {number|null} itemId - 로그인 시 백엔드 itemId, 비로그인 시 null
       * @param {number} productId - 비로그인 시 사용
       * @param {number} quantity
       */
      updateQuantity: async (itemId, productId, quantity) => {
        if (quantity <= 0) return { ok: false, message: '수량은 1 이상' };
        const isLogged = get()._isLogged();

        if (isLogged) {
          try {
            const updated = await cartApi.updateCartItemQuantity(itemId, quantity);
            set({ serverCart: updated });
            return { ok: true };
          } catch (err) {
            return { ok: false, message: err?.response?.data?.message || '수량 변경 실패' };
          }
        } else {
          // 비로그인: productId 로 찾아서 변경 (기존 호환)
          const items = get().items.map((it) =>
            it.productId === productId ? { ...it, quantity } : it
          );
          set({ items });
          return { ok: true };
        }
      },

      /**
       * 카트 아이템 삭제.
       * @param {number|null} itemId - 로그인 시 백엔드 itemId
       * @param {number} productId - 비로그인 시 사용
       */
      removeItem: async (itemId, productId) => {
        const isLogged = get()._isLogged();

        if (isLogged) {
          try {
            const updated = await cartApi.removeCartItem(itemId);
            set({ serverCart: updated });
            return { ok: true };
          } catch (err) {
            return { ok: false, message: err?.response?.data?.message || '삭제 실패' };
          }
        } else {
          const items = get().items.filter((it) => it.productId !== productId);
          set({ items });
          return { ok: true };
        }
      },

      /**
       * 카트 비우기.
       */
      clear: async () => {
        const isLogged = get()._isLogged();

        if (isLogged) {
          try {
            const updated = await cartApi.clearCart();
            set({ serverCart: updated, items: [] });
            return { ok: true };
          } catch (err) {
            return { ok: false, message: err?.response?.data?.message || '비우기 실패' };
          }
        } else {
          set({ items: [] });
          return { ok: true };
        }
      },

      // ─── 서버 sync ────────────────────────────────────

      /**
       * 로그인 직후 호출: localStorage 카트 → 서버 머지 + 최신 카트 fetch.
       * 핫딜/INACTIVE 상품은 백엔드에서 silent skip.
       */
      syncToServer: async () => {
        const isLogged = get()._isLogged();
        if (!isLogged) return { ok: false, message: '로그인 필요' };

        const localItems = get().items;
        try {
          let serverCart;
          if (localItems.length > 0) {
            const payload = localItems.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
            }));
            serverCart = await cartApi.syncCart(payload);
          } else {
            serverCart = await cartApi.fetchCart();
          }
          set({
            serverCart,
            items: [], // 머지 완료 후 localStorage 비움
            lastSyncedAt: new Date().toISOString(),
          });
          return { ok: true, serverCart };
        } catch (err) {
          return { ok: false, message: err?.response?.data?.message || 'sync 실패' };
        }
      },

      /**
       * 로그아웃 시: serverCart 비움. localStorage items 는 유지.
       */
      onLogout: () => {
        set({ serverCart: null, lastSyncedAt: null });
      },

      /**
       * 강제 백엔드 fetch (Cart 페이지 새로고침 등).
       */
      refreshFromServer: async () => {
        const isLogged = get()._isLogged();
        if (!isLogged) return { ok: false };
        try {
          const serverCart = await cartApi.fetchCart();
          set({ serverCart });
          return { ok: true, serverCart };
        } catch (err) {
          return { ok: false, message: err?.response?.data?.message };
        }
      },
    }),
    {
      name: 'cart-storage', // localStorage key (기존 호환)
      partialize: (state) => ({ items: state.items }), // serverCart 영속화 안함 (stale 방지)
    }
  )
);
