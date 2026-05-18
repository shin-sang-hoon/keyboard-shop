// frontend/src/api/cart.js
// Phase 8 5-D (5/18) — 장바구니 백엔드 wrapper.
//
// 백엔드 endpoint 7개:
//   GET    /api/cart            - 현재 사용자 카트 조회
//   GET    /api/cart/count      - 헤더 배지용 quantity 합
//   POST   /api/cart/items      - 상품 담기
//   PATCH  /api/cart/items/{id} - 수량 변경
//   DELETE /api/cart/items/{id} - 카트 아이템 삭제
//   DELETE /api/cart            - 카트 비우기
//   POST   /api/cart/sync       - 비로그인 localStorage → 서버 머지
//
// 모든 호출은 apiClient (axios 인터셉터 적용) 통해서. JWT 자동 첨부 + 401 refresh.

import { apiClient } from './client';

/**
 * 현재 사용자 카트 조회.
 * @returns {Promise<CartView>} { id, items: [...], totalPrice, totalQuantity, updatedAt }
 */
export async function fetchCart() {
  const res = await apiClient.get('/cart');
  return res.data;
}

/**
 * Header 배지용 quantity 합 (가벼운 응답).
 * @returns {Promise<{count: number}>}
 */
export async function fetchCartCount() {
  const res = await apiClient.get('/cart/count');
  return res.data;
}

/**
 * 상품 담기. 같은 product 이미 있으면 백엔드에서 quantity 합산.
 * @param {number} productId
 * @param {number} quantity 기본 1
 * @returns {Promise<CartView>} 갱신된 카트
 */
export async function addCartItem(productId, quantity = 1) {
  const res = await apiClient.post('/cart/items', { productId, quantity });
  return res.data;
}

/**
 * 수량 변경 (1 이상). 삭제는 removeCartItem 사용.
 * @param {number} itemId
 * @param {number} quantity
 * @returns {Promise<CartView>}
 */
export async function updateCartItemQuantity(itemId, quantity) {
  const res = await apiClient.patch(`/cart/items/${itemId}`, { quantity });
  return res.data;
}

/**
 * 카트 아이템 삭제.
 * @param {number} itemId
 * @returns {Promise<CartView>}
 */
export async function removeCartItem(itemId) {
  const res = await apiClient.delete(`/cart/items/${itemId}`);
  return res.data;
}

/**
 * 카트 비우기 (모든 item 삭제).
 * @returns {Promise<CartView>}
 */
export async function clearCart() {
  const res = await apiClient.delete('/cart');
  return res.data;
}

/**
 * 비로그인 localStorage 카트 → 서버 머지 (로그인 직후 1회 호출).
 * 핫딜/INACTIVE 는 백엔드에서 silent skip.
 * @param {Array<{productId, quantity}>} items
 * @returns {Promise<CartView>} 머지된 최종 카트
 */
export async function syncCart(items) {
  const res = await apiClient.post('/cart/sync', { items });
  return res.data;
}
