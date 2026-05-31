// frontend/src/api/wishlist.js
// 마이페이지 ② — 찜(Wishlist) 조회/토글 wrapper.
//
// 백엔드 endpoint:
//   GET  /api/wishlist                       - 내 찜 목록 (PagedResponse<WishlistDto.Item>)
//   POST /api/products/{productId}/wishlist  - 찜 토글
//
// WishlistDto.Item: { wishlistId, productId, productName, price, imageUrl, brandName, createdAt }
// 목록은 PagedResponse — { content: [...], page, size, totalElements, totalPages, last }
//
// 모든 호출은 apiClient (axios 인터셉터) — JWT 자동 첨부 + 401 refresh.

import { apiClient } from './client';

/**
 * 내 찜 목록 조회 (최신순 페이징).
 * @param {{page?: number, size?: number}} params
 * @returns {Promise<Object>} PagedResponse { content, page, size, totalElements, totalPages, last }
 */
export async function getMyWishlist(params = {}) {
  const res = await apiClient.get('/wishlist', { params });
  return res.data;
}

/**
 * 찜 토글 — 이미 찜이면 해제, 아니면 추가.
 * 마이페이지 찜 탭에서 "삭제(하트 해제)" 용도로도 사용.
 * @param {number} productId
 * @returns {Promise<{wishlisted: boolean}>} 토글 후 상태
 */
export async function toggleWishlist(productId) {
  const res = await apiClient.post(`/products/${productId}/wishlist`);
  return res.data;
}
