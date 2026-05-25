// frontend/src/api/adminProduct.js
//
// Phase 7-G 라운드 5 (2026-05-25) — 관리자 상품 관리 API.
// 백엔드: AdminProductController.
//
// 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
//   JWT 자동 첨부는 apiClient 인터셉터가 처리 (auditLog.js 와 동일 패턴).
//
// 컨벤션 (5/12 5-B fix): 함수는 res.data (백엔드 JSON body) 만 반환.

import apiClient from './client';

export const adminProductApi = {
  /**
   * GET /api/admin/products
   *
   * @param {Object} params - 모두 선택
   * @param {string} [params.status]      - ACTIVE / INACTIVE / SOLD_OUT
   * @param {string} [params.productType] - KEYBOARD / KEYCAP / SWITCH_PART / ACCESSORY
   * @param {string} [params.search]      - 상품명 부분 일치
   * @param {number} [params.page=0]
   * @param {number} [params.size=20]
   * @returns PagedResponse<AdminProductDto.ListItem>
   *   { content: [{ id, name, brandName, imageUrl, price, stock, productType, status, createdAt }],
   *     totalElements, totalPages, page, size, first, last, ... }
   */
  list: async (params = {}) => {
    // undefined/null/'' 값은 query 에서 제외 (백엔드 @RequestParam(required=false) 호환)
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const res = await apiClient.get('/admin/products', { params: cleaned });
    return res.data;
  },

  /**
   * PATCH /api/admin/products/{id}/status
   *
   * @param {number} id     - 대상 상품 id
   * @param {string} status - 'ACTIVE' / 'INACTIVE'
   * @returns AdminProductDto.ListItem (변경 후 상품 정보)
   */
  updateStatus: async (id, status) => {
    const res = await apiClient.patch(`/admin/products/${id}/status`, { status });
    return res.data;
  },
};

export default adminProductApi;
