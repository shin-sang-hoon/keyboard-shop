// frontend/src/api/adminNotice.js
//
// Phase 7-G 라운드 7 (2026-05-25) — 관리자 공지 관리 API.
// 백엔드: AdminNoticeController. 공지 CRUD 전체.
//
// 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
//   JWT 자동 첨부는 apiClient 인터셉터가 처리.
//
// 컨벤션: 함수는 res.data 만 반환 (auditLog.js / adminOrder.js 와 동일).

import apiClient from './client';

export const adminNoticeApi = {
  /**
   * GET /api/admin/notices  — 공지 목록 (페이징 + 제목 검색)
   *
   * @param {Object} params
   * @param {string} [params.search] - 제목 부분 검색어
   * @param {number} [params.page=0]
   * @param {number} [params.size=20]
   * @returns PagedResponse<AdminNoticeDto.ListItem>
   *   { content: [{ id, title, pinned, viewCount, createdAt, updatedAt }], ... }
   */
  list: async (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const res = await apiClient.get('/admin/notices', { params: cleaned });
    return res.data;
  },

  /**
   * GET /api/admin/notices/{id}  — 공지 상세 (본문 포함)
   * @returns AdminNoticeDto.Detail { id, title, content, pinned, viewCount, createdAt, updatedAt }
   */
  get: async (id) => {
    const res = await apiClient.get(`/admin/notices/${id}`);
    return res.data;
  },

  /**
   * POST /api/admin/notices  — 공지 등록
   * @param {{ title: string, content: string, pinned: boolean }} body
   * @returns AdminNoticeDto.Detail
   */
  create: async (body) => {
    const res = await apiClient.post('/admin/notices', body);
    return res.data;
  },

  /**
   * PUT /api/admin/notices/{id}  — 공지 수정
   * @param {number} id
   * @param {{ title: string, content: string, pinned: boolean }} body
   * @returns AdminNoticeDto.Detail
   */
  update: async (id, body) => {
    const res = await apiClient.put(`/admin/notices/${id}`, body);
    return res.data;
  },

  /**
   * DELETE /api/admin/notices/{id}  — 공지 삭제
   * @returns 204 No Content (반환값 없음)
   */
  remove: async (id) => {
    await apiClient.delete(`/admin/notices/${id}`);
  },
};

export default adminNoticeApi;
