// frontend/src/stores/cartStore.js
// 장바구니 - localStorage 영속화 (비로그인 상태에서도 유지)
//
// 사용 예시:
//   const items = useCartStore((s) => s.items);
//   const totalCount = useCartStore((s) => s.totalCount());
//   const { addItem, removeItem } = useCartStore();
//
//   addItem(product, 1);  // ProductDetail 의 "장바구니" 버튼에서

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      // === state ===
      items: [], // [{ productId, name, price, imageUrl, brandName, quantity }]

      // === actions ===
      addItem: (product, quantity = 1) =>
        set((state) => {
          const existing = state.items.find(
            (it) => it.productId === product.id
          );
          if (existing) {
            return {
              items: state.items.map((it) =>
                it.productId === product.id
                  ? { ...it, quantity: it.quantity + quantity }
                  : it
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                name: product.name,
                price: product.price,
                imageUrl:
                  product.imageUrl || product.images?.[0]?.url || null,
                brandName: product.brandName || null,
                quantity,
              },
            ],
          };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((it) => it.productId !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.productId === productId
              ? { ...it, quantity: Math.max(1, quantity) }
              : it
          ),
        })),

      clear: () => set({ items: [] }),

      // === getters (computed) ===
      totalCount: () =>
        get().items.reduce((acc, it) => acc + it.quantity, 0),

      totalPrice: () =>
        get().items.reduce((acc, it) => acc + it.price * it.quantity, 0),

      hasItem: (productId) =>
        get().items.some((it) => it.productId === productId),
    }),
    {
      name: 'cart-storage',
    }
  )
);
