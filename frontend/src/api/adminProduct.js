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
   * @param {string} [params.search]      - 상품명 부분일치
   * @param {number} [params.page=0]
   * @param {number} [params.size=20]
   * @returns PagedResponse<AdminProductDto.ListItem>
   *   { content: [{ id, name, brandId, brandName, imageUrl, price, stock, productType, status, createdAt }],
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
   * @returns AdminProductDto.ListItem (변경된 상품 정보)
   */
  updateStatus: async (id, status) => {
    const res = await apiClient.patch(`/admin/products/${id}/status`, { status });
    return res.data;
  },

  /**
   * PATCH /api/admin/products/{id}/brand
   *
   * 상품의 브랜드를 변경한다. brandId=null 이면 브랜드 미지정(연결 해제).
   * 백엔드 brand_id 가 채워지면 ProductDto.Response.brandName 을 통해
   * 사용자 측 ProductCard/ProductDetail 에도 자동 반영된다.
   *
   * @param {number} id              - 대상 상품 id
   * @param {number|null} brandId    - 연결할 브랜드 id (null = 미지정)
   * @returns AdminProductDto.ListItem (변경된 상품 정보)
   */
  updateBrand: async (id, brandId) => {
    const res = await apiClient.patch(`/admin/products/${id}/brand`, { brandId });
    return res.data;
  },
};

export default adminProductApi;
