// frontend/src/api/adminBrand.js
//
// 관리자 브랜드 관리 API (7-G R9).
// 백엔드: AdminBrandController (/api/admin/brands) — 기존 컨트롤러 그대로 사용.
//
// apiClient 의 baseURL 에 /api 가 포함돼 있으므로 /admin/... 부터 시작.

import apiClient from './client';

export const adminBrandApi = {
  /** 브랜드 전체 조회 (배열) */
  list: async () => {
    const res = await apiClient.get('/admin/brands');
    return res.data;
  },

  /** 브랜드 단건 조회 */
  get: async (id) => {
    const res = await apiClient.get(`/admin/brands/${id}`);
    return res.data;
  },

  /** 브랜드 생성 — body: { name, logoUrl, description } */
  create: async (body) => {
    const res = await apiClient.post('/admin/brands', body);
    return res.data;
  },

  /** 브랜드 수정 */
  update: async (id, body) => {
    const res = await apiClient.put(`/admin/brands/${id}`, body);
    return res.data;
  },

  /** 브랜드 삭제 — 사용 중인 상품이 있으면 409 */
  remove: async (id) => {
    const res = await apiClient.delete(`/admin/brands/${id}`);
    return res.data;
  },
};

export default adminBrandApi;
