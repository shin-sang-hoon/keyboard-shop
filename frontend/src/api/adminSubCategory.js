// frontend/src/api/adminSubCategory.js
//
// 관리자 하위 카테고리 관리 API (P2, 2026-05-28).
// 백엔드: AdminSubCategoryController (/api/admin/sub-categories) — hasRole(ADMIN) 가드.
//
// 설계: 대분류 = Product.productType enum (고정)
//        └ 하위분류 = SubCategory (product_type 종속, 여기서 CRUD)
//
// adminCategory.js 와 동일 패턴 (apiClient + res.data).

import apiClient from './client';

export const adminSubCategoryApi = {
  /**
   * 하위 카테고리 조회.
   * @param {string} [productType] 지정 시 해당 대분류만, 없으면 전체.
   * 응답: [{ id, productType, name, sortOrder, default(=isDefault), productCount }]
   */
  list: async (productType) => {
    const res = await apiClient.get('/admin/sub-categories', {
      params: productType ? { productType } : {},
    });
    return res.data;
  },

  /** 생성 — body: { productType, name, sortOrder(선택) } */
  create: async (body) => {
    const res = await apiClient.post('/admin/sub-categories', body);
    return res.data;
  },

  /** 수정 — body: { name, sortOrder(선택) }. productType 변경 불가. */
  update: async (id, body) => {
    const res = await apiClient.put(`/admin/sub-categories/${id}`, body);
    return res.data;
  },

  /** 삭제 — '기타'(시드) 또는 사용 중인 상품 있으면 거부(400/409). */
  remove: async (id) => {
    const res = await apiClient.delete(`/admin/sub-categories/${id}`);
    return res.data;
  },
};

export default adminSubCategoryApi;
