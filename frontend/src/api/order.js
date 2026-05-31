// frontend/src/api/order.js
// 마이페이지 ② — 주문 조회 wrapper.
//
// 백엔드 endpoint:
//   GET /api/orders/my  - 내 주문 목록 (List<OrderDto.Response>)
//
// OrderDto.Response: { id, totalPrice, status, items: [{productId, productName, price, quantity}], createdAt }
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
