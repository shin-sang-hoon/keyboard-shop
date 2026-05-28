// frontend/src/api/adminProduct.js
//
// Phase 7-G 라운드 5 (2026-05-25) — 관리자 상품 관리 API.
// P1 (2026-05-28) — 재고/품절: updateStock 추가 + list soldOut 필터.
// 백엔드: AdminProductController.
//
// 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
//   JWT 자동 첨부는 apiClient 인터셉터가 처리 (auditLog.js 와 동일 패턴).
//
// 컨벤션 (5/12 5-B fix): 함수는 res.data (백엔드 JSON body) 만 반환.

import apiClient from './client';

/** [판매 재개] 시 채워 넣는 기본 재고 (백엔드 DEFAULT_RESTOCK 과 동일 의도). */
export const DEFAULT_RESTOCK = 100;

export const adminProductApi = {
  /**
   * GET /api/admin/products
   *
   * @param {Object} params - 모두 선택
   * @param {string}  [params.status]      - ACTIVE / INACTIVE / SOLD_OUT
   * @param {string}  [params.productType] - KEYBOARD / KEYCAP / SWITCH_PART / ACCESSORY
   * @param {string}  [params.search]      - 상품명 부분일치
   * @param {boolean} [params.soldOut]     - true=품절(stock=0)만 / false=재고있음만 (생략=전체)
   * @param {number}  [params.page=0]
   * @param {number}  [params.size=20]
   * @returns PagedResponse<AdminProductDto.ListItem>
   *   { content: [{ id, name, brandId, brandName, imageUrl, price, stock, productType, status, createdAt }],
   *     totalElements, totalPages, page, size, first, last, ... }
   */
  list: async (params = {}) => {
    // undefined/null/'' 값은 query 에서 제외 (백엔드 @RequestParam(required=false) 호환).
    // soldOut 은 boolean 이므로 false 도 유효값 → false 는 유지하고 undefined/null/'' 만 제외.
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

  /**
   * PATCH /api/admin/products/{id}/stock  (P1 5/28 — B-1 품절 방식)
   *
   * 상품의 재고를 변경한다. [품절 처리]=0, [판매 재개]=DEFAULT_RESTOCK.
   * status(노출 on/off) 는 건드리지 않는다 — 품절은 stock 으로만 판정.
   * stock=0 이면 사용자 측 ProductDetail 에 "품절" 배지 + 구매 버튼 비활성으로 반영.
   *
   * @param {number} id    - 대상 상품 id
   * @param {number} stock - 설정할 재고 수량 (0 이상)
   * @returns AdminProductDto.ListItem (변경된 상품 정보)
   */
  updateStock: async (id, stock) => {
    const res = await apiClient.patch(`/admin/products/${id}/stock`, { stock });
    return res.data;
  },

  /**
   * PATCH /api/admin/products/{id}/sub-category  (P2 5/28)
   *
   * 상품의 하위 카테고리를 변경한다. subCategoryId=null 이면 미지정(연결 해제).
   * 백엔드가 product_type 일치를 검증 — 상품 대분류와 다른 하위분류는 400.
   * 지정되면 사용자 측 ProductList 측면 필터(subCategoryId)에 자동 반영.
   *
   * @param {number} id                  - 대상 상품 id
   * @param {number|null} subCategoryId  - 연결할 하위분류 id (null = 미지정)
   * @returns AdminProductDto.ListItem (변경된 상품 정보)
   */
  updateSubCategory: async (id, subCategoryId) => {
    const res = await apiClient.patch(`/admin/products/${id}/sub-category`, { subCategoryId });
    return res.data;
  },
};

export default adminProductApi;
