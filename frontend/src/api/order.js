// frontend/src/api/order.js
// 마이페이지 ② + 주문 플로우 O-1 — 주문 조회/생성 wrapper.
//
// 백엔드 endpoint:
//   GET  /api/orders/my  - 내 주문 목록 (List<OrderDto.Response>)
//   POST /api/orders     - 주문 생성 (Cart→Order, OrderDto.Request → OrderDto.Response)
//
// OrderDto.Response: { id, totalPrice, status, items: [{productId, productName, price, quantity}], createdAt }
// OrderDto.Request:  { items: [{ productId, quantity }] }
// 페이징 없이 단순 List (마이페이지는 전량 노출).
//
// 모든 호출은 apiClient (axios 인터셉터) — JWT 자동 첨부 + 401 refresh.

import { apiClient } from './client';

/**
 * 내 주문 목록 조회 (최신 주문 포함, 백엔드 정렬 위임).
 * @returns {Promise<Array>} OrderDto.Response 배열
 */
export async function getMyOrders() {
  const res = await apiClient.get('/orders/my');
  return res.data;
}

/**
 * 주문 생성 (Cart→Order). 백엔드가 상품 단가로 가격 스냅샷을 다시 계산하므로
 * 프론트는 productId / quantity 만 전달한다 (가격 위변조 방지).
 *
 * cartStore.getDisplayItems() 가 주는 item 은 로그인/비로그인 모두 productId 를 가짐.
 *
 * @param {Array<{productId: number|string, quantity: number}>} items 주문 품목
 * @returns {Promise<Object>} OrderDto.Response (id / totalPrice / status / items / createdAt)
 */
export async function createOrder(items) {
  const payload = {
    items: items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity ?? 1,
      // 3D 빌더 커스텀 옵션 (일반 상품은 undefined → 전송 생략). 서버가 단가 재계산.
      ...(it.layout || it.switchType || it.keycapColor || it.caseColor
        ? {
            layout: it.layout ?? null,
            switchType: it.switchType ?? null,
            keycapColor: it.keycapColor ?? null,
            caseColor: it.caseColor ?? null,
          }
        : {}),
    })),
  };
  const res = await apiClient.post('/orders', payload);
  return res.data;
}
