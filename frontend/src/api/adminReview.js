// frontend/src/api/adminReview.js
//
// 관리자 리뷰·신고 운영 API (7-G R8, R10 답글).
// 백엔드: AdminReviewController (/api/admin/reviews, /api/admin/reports)
//
// apiClient 의 baseURL 에 /api 가 포함돼 있으므로 여기서는 /admin/... 부터 시작.
// (adminProduct.js / adminUser.js / adminNotice.js 와 동일 패턴)

import apiClient from './client';

// undefined / null / '' 파라미터 제거 — 'false' 문자열은 유효값이므로 보존됨
function clean(params) {
  return Object.fromEntries(
    Object.entries(params || {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== ''
    )
  );
}

export const adminReviewApi = {
  // ─── 리뷰 ───────────────────────────────────────────

  /** 리뷰 목록 — params: { hidden?: 'true'|'false', page, size } */
  listReviews: async (params = {}) => {
    const res = await apiClient.get('/admin/reviews', { params: clean(params) });
    return res.data;
  },

  /** 리뷰 숨김/복원 — hidden: boolean */
  updateVisibility: async (id, hidden) => {
    const res = await apiClient.patch(`/admin/reviews/${id}/visibility`, { hidden });
    return res.data;
  },

  // ─── R10 답글 (판매자 답변) ──────────────────────────

  /** 답글 작성·수정 (upsert) — content: string. 답변자는 현재 로그인 관리자 */
  addReply: async (id, content) => {
    const res = await apiClient.patch(`/admin/reviews/${id}/reply`, { content });
    return res.data;
  },

  /** 답글 삭제 — 미답변 상태로 복귀 */
  removeReply: async (id) => {
    const res = await apiClient.delete(`/admin/reviews/${id}/reply`);
    return res.data;
  },

  /** 내가 답변한 리뷰 목록 (마이페이지 관리자 탭) — params: { page, size } */
  getMyReplies: async (params = {}) => {
    const res = await apiClient.get('/admin/reviews/my-replies', { params: clean(params) });
    return res.data;
  },

  // ─── 신고 ───────────────────────────────────────────

  /** 신고 큐 — params: { status?: 'PENDING'|'RESOLVED'|'DISMISSED', page, size } */
  listReports: async (params = {}) => {
    const res = await apiClient.get('/admin/reports', { params: clean(params) });
    return res.data;
  },

  /** 신고 인용 — 대상 리뷰 숨김 + 같은 리뷰 대기 신고 일괄 처리 */
  resolveReport: async (id) => {
    const res = await apiClient.post(`/admin/reports/${id}/resolve`);
    return res.data;
  },

  /** 신고 기각 — 해당 신고만 기각, 리뷰는 노출 유지 */
  dismissReport: async (id) => {
    const res = await apiClient.post(`/admin/reports/${id}/dismiss`);
    return res.data;
  },
};

export default adminReviewApi;
