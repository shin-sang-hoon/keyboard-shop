// frontend/src/api/review.js
// 마이페이지 ② — 내가 작성한 리뷰 조회/수정/삭제 wrapper (사용자용).
//
// 백엔드 endpoint:
//   GET    /api/reviews/my   - 내가 작성한 리뷰 목록 (List<ReviewDto.MyReviewItem>)
//   PATCH  /api/reviews/{id} - 리뷰 수정 (작성자 본인)
//   DELETE /api/reviews/{id} - 리뷰 삭제 (작성자 본인 또는 ADMIN)
//
// MyReviewItem: { reviewId, productId, productName, productImageUrl, rating, content,
//                 hidden, hasReply, reply, repliedByName, repliedAt, createdAt, updatedAt }
// 페이징 없이 단순 List (마이페이지 전량 노출).
//
// (관리자 "답변한 리뷰" 는 별도 — api/adminReview.js 의 getMyReplies 사용.)
//
// 모든 호출은 apiClient (axios 인터셉터) — JWT 자동 첨부 + 401 refresh.

import { apiClient } from './client';

/**
 * 내가 작성한 리뷰 목록 (숨김 포함, 최신순).
 * @returns {Promise<Array>} MyReviewItem 배열
 */
export async function getMyReviews() {
  const res = await apiClient.get('/reviews/my');
  return res.data;
}

/**
 * 리뷰 수정 — 작성자 본인만 (rating + content).
 * @param {number} reviewId
 * @param {{rating: number, content: string}} payload
 * @returns {Promise<Object>} 수정된 ReviewDto.Response
 */
export async function updateMyReview(reviewId, payload) {
  const res = await apiClient.patch(`/reviews/${reviewId}`, payload);
  return res.data;
}

/**
 * 리뷰 삭제 — 작성자 본인 또는 ADMIN.
 * @param {number} reviewId
 * @returns {Promise<void>}
 */
export async function deleteMyReview(reviewId) {
  await apiClient.delete(`/reviews/${reviewId}`);
}
