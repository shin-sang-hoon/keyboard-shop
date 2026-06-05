// frontend/src/api/order.js
// 마이페이지 ② + 주문 플로우 O-1 — 주문 조회/생성 wrapper.
//
// 백엔드 endpoint:
//   GET  /api/orders/my      - 내 주문 목록 (List<OrderDto.Response>)
//   POST /api/orders         - 주문 생성 (Cart→Order). 바디 없음 — 서버가 인증 사용자의
//                              장바구니를 직접 읽어 주문 생성 (→ OrderDto.Response).
//   POST /api/orders/direct  - 즉시구매 (상품상세 '구매하기'·3D 빌더 '바로구매').
//                              장바구니 미경유 — { productId, quantity, 옵션 } 바디로 단건 주문.
//                              가격은 서버가 옵션ID로 재계산(위변조 차단) (→ OrderDto.Response).
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

/**
 * 주문 생성 (Cart→Order).
 *
 * 백엔드 OrderService.createOrder(email) 는 요청 바디를 받지 않고 서버에서
 * 인증 사용자의 장바구니를 직접 로드해 주문을 만든다. 품목 / 수량 / 가격 모두
 * 서버 장바구니(cart_items)가 단일 출처이며, 가격은 상품 단가로 재계산되어
 * 클라이언트 위변조가 불가능하다. 따라서 프론트는 바디 없이 호출만 한다.
 *
 * 재고 부족 시 백엔드가 409 CONFLICT (message: "재고가 부족합니다: {상품명}") 를 반환하며,
 * 이때 주문은 생성되지 않고 재고 차감도 롤백된다 (all-or-nothing).
 *
 * @returns {Promise<Object>} OrderDto.Response (id / totalPrice / status / items / createdAt)
 */
export async function createOrder() {
  const res = await apiClient.post('/orders');
  return res.data;
}

/**
 * 즉시구매 주문 생성 (Direct, B-1). 장바구니를 거치지 않고 단건 상품을 곧바로 주문한다.
 *
 * 상품 상세 "구매하기" 및 3D 빌더 "바로구매" 가 호출. 서버(OrderService.createOrderDirect)는
 * productId / quantity / 옵션만 받고 가격은 신뢰하지 않는다 — 단가는 BuilderPriceCalculator 가
 * 서버에서 재계산한다(위변조 차단). 장바구니 담기와 동일한 가드(INACTIVE/경매 거부)와 동일한
 * 주문 코어(원자적 재고 차감 + 409)를 공유한다.
 *
 * @param {Object} payload 주문 품목
 * @param {number|string} payload.productId 상품 ID (필수)
 * @param {number} payload.quantity 수량 (≥1, 필수)
 * @param {string} [payload.layout] 3D 빌더 배열 옵션 (일반 상품은 생략)
 * @param {string} [payload.switchType] 스위치 옵션
 * @param {string} [payload.keycapColor] 키캡 색상 (가격 가산)
 * @param {string} [payload.caseColor] 케이스 색상 (가격 무관, 스냅샷 표시용)
 * @returns {Promise<Object>} OrderDto.Response (id / totalPrice / status / items / createdAt)
 */
export async function createOrderDirect(payload) {
  const res = await apiClient.post('/orders/direct', payload);
  return res.data;
}

// ============================================================================
// PortOne V2 결제 (6/5) — prepare / complete
//
// 정식 결제 흐름. 위 createOrder/createOrderDirect(mock 즉시 PAID)를 대체한다.
//   1) prepare → 서버가 PENDING 주문 생성 + paymentId 발급 (재고 미차감)
//   2) (호출부) PortOne.requestPayment 로 결제창 → 결제
//   3) complete → 서버가 PortOne 단건조회로 금액검증 → 재고차감 + PAID
//
// prepare 응답(PrepareResponse): { orderId, paymentId, orderName, amount, storeId, channelKey }
//   storeId/channelKey 는 결제창(requestPayment) 호출에 그대로 넘긴다.
// complete 응답: OrderDto.Response (확정된 주문).
// ============================================================================

/**
 * 결제 준비 — 장바구니 기반. 서버가 인증 사용자의 장바구니로 PENDING 주문을 만들고
 * paymentId 를 발급한다(재고 미차감). 배송지는 shipping 으로 전달.
 *
 * @param {Object} shipping 배송지 { receiverName, receiverPhone, postcode, address, addressDetail }
 * @returns {Promise<Object>} PrepareResponse { orderId, paymentId, orderName, amount, storeId, channelKey }
 */
export async function preparePaymentCart(shipping) {
  const res = await apiClient.post('/payments/prepare/cart', { shipping });
  return res.data;
}

/**
 * 결제 준비 — 즉시구매 기반. 단건 상품(+옵션)으로 PENDING 주문 생성 + paymentId 발급.
 * 가격은 서버가 재계산(위변조 차단). 배송지는 shipping 으로 전달.
 *
 * @param {Object} payload { productId, quantity, layout?, switchType?, keycapColor?, caseColor?, shipping }
 * @returns {Promise<Object>} PrepareResponse { orderId, paymentId, orderName, amount, storeId, channelKey }
 */
export async function preparePaymentDirect(payload) {
  const res = await apiClient.post('/payments/prepare/direct', payload);
  return res.data;
}

/**
 * 결제 완료 — 결제창 결제 후 호출. 서버가 PortOne 단건조회로 "실제 PAID + 금액 일치"를
 * 검증하고 통과 시 재고 차감 + PAID 전환. 검증 실패 시 400 (주문은 서버에서 CANCELLED).
 * 멱등 — 이미 PAID 면 그대로 성공 반환.
 *
 * @param {string} paymentId prepare 에서 받은 결제 식별자
 * @returns {Promise<Object>} OrderDto.Response (확정된 주문)
 */
export async function completePayment(paymentId) {
  const res = await apiClient.post('/payments/complete', { paymentId });
  return res.data;
}
