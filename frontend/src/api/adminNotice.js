// frontend/src/api/adminNotice.js
//
// Phase 7-G 라운드 7 — 관리자 공지 관리 API.
// Phase 7-B (2026-05-25) — 첨부 이미지 지원으로 create/update 를 multipart 전환.
//
// 백엔드: AdminNoticeController. 공지 CRUD 전체.
// 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
//   JWT 자동 첨부는 apiClient 인터셉터가 처리.
// 메인 페이지·관리자 페이지의 ADMIN 작성/수정/삭제가 모두 이 모듈을 거친다.
//
// 7-B 변경:
//   - 백엔드 작성/수정 API 가 JSON → multipart/form-data 로 바뀜.
//   - create/update 는 FormData 를 만들어 보낸다.
//   - client.js 가 기본 헤더에 application/json 을 박아두므로, 요청별로
//     Content-Type: multipart/form-data 를 명시해 덮어쓴다 (boundary 는
//     axios 가 자동으로 채운다).

import apiClient from './client';

/**
 * 공지 작성/수정 공용 FormData 조립.
 *
 * @param {Object}   p
 * @param {string}   p.title
 * @param {string}   p.content
 * @param {boolean}  p.pinned
 * @param {File[]}   [p.images]               새로 추가할 이미지 파일들
 * @param {number[]} [p.deleteAttachmentIds]  (수정 전용) 삭제할 기존 첨부 id
 */
function buildNoticeFormData({ title, content, pinned, images, deleteAttachmentIds }) {
  const fd = new FormData();
  fd.append('title', title ?? '');
  fd.append('content', content ?? '');
  fd.append('pinned', pinned ? 'true' : 'false');
  (images || []).forEach((file) => fd.append('images', file));
  (deleteAttachmentIds || []).forEach((id) => fd.append('deleteAttachmentIds', id));
  return fd;
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

export const adminNoticeApi = {
  /**
   * GET /api/admin/notices — 공지 목록 (페이징 + 제목 검색)
   * @returns PagedResponse<AdminNoticeDto.ListItem>
   */
  list: async (params = {}) => {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const res = await apiClient.get('/admin/notices', { params: cleaned });
    return res.data;
  },

  /**
   * GET /api/admin/notices/{id} — 공지 상세 (본문 + 첨부 포함)
   * @returns AdminNoticeDto.Detail { id, title, content, pinned, viewCount,
   *          createdAt, updatedAt, attachments: [{ id, originalName, url, ... }] }
   */
  get: async (id) => {
    const res = await apiClient.get(`/admin/notices/${id}`);
    return res.data;
  },

  /**
   * POST /api/admin/notices — 공지 등록 (multipart, 첨부 이미지 포함)
   * @param {{ title, content, pinned, images?: File[] }} payload
   * @returns AdminNoticeDto.Detail
   */
  create: async ({ title, content, pinned, images }) => {
    const fd = buildNoticeFormData({ title, content, pinned, images });
    const res = await apiClient.post('/admin/notices', fd, MULTIPART);
    return res.data;
  },

  /**
   * PUT /api/admin/notices/{id} — 공지 수정 (multipart)
   * @param {number} id
   * @param {{ title, content, pinned, images?: File[], deleteAttachmentIds?: number[] }} payload
   * @returns AdminNoticeDto.Detail
   */
  update: async (id, { title, content, pinned, images, deleteAttachmentIds }) => {
    const fd = buildNoticeFormData({ title, content, pinned, images, deleteAttachmentIds });
    const res = await apiClient.put(`/admin/notices/${id}`, fd, MULTIPART);
    return res.data;
  },

  /**
   * DELETE /api/admin/notices/{id} — 공지 삭제
   * @returns 204 No Content (반환값 없음)
   */
  remove: async (id) => {
    await apiClient.delete(`/admin/notices/${id}`);
  },
};

export default adminNoticeApi;
