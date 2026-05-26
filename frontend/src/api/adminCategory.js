// frontend/src/api/adminCategory.js
//
// 관리자 카테고리 관리 API (7-G R9).
// 백엔드: AdminCategoryController (/api/admin/categories) — 기존 컨트롤러 그대로 사용.
//
// list() 는 2-depth 트리 — 최상위 카테고리 배열, 각 항목에 children 포함.

import apiClient from './client';

export const adminCategoryApi = {
  /** 카테고리 전체 조회 (트리: 최상위 배열 + 각 항목 children) */
  list: async () => {
    const res = await apiClient.get('/admin/categories');
    return res.data;
  },

  /** 카테고리 생성 — body: { name, slug, parentId(선택) } */
  create: async (body) => {
    const res = await apiClient.post('/admin/categories', body);
    return res.data;
  },

  /** 카테고리 수정 */
  update: async (id, body) => {
    const res = await apiClient.put(`/admin/categories/${id}`, body);
    return res.data;
  },

  /** 카테고리 삭제 — 하위 카테고리 또는 사용 중인 상품이 있으면 409 */
  remove: async (id) => {
    const res = await apiClient.delete(`/admin/categories/${id}`);
    return res.data;
  },
};

export default adminCategoryApi;
