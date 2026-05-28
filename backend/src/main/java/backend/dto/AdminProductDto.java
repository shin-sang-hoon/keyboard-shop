package backend.dto;

import backend.entity.Product;

import java.time.LocalDateTime;

/**
 * 관리자 상품 관리 DTO (Phase 7-G 라운드 5).
 *
 * 중첩 구조:
 *   - AdminProductDto.ListItem               : 상품 목록 응답 1행
 *   - AdminProductDto.StatusUpdateRequest    : 상태 변경 요청 body (ACTIVE/INACTIVE 노출 토글)
 *   - AdminProductDto.BrandUpdateRequest     : 브랜드 변경 요청 body (P1)
 *   - AdminProductDto.StockUpdateRequest     : 재고 변경 요청 body (P1 5/28 — 품절/재개)
 *   - AdminProductDto.SubCategoryUpdateRequest : 하위 카테고리 변경 요청 body (P2 5/28)
 *
 * 공개 API 의 ProductDto.Response 와 분리한 이유:
 *   - 관리자 목록은 리뷰/QnA 집계, 다중 이미지가 불필요 → 가벼운 DTO.
 *   - 관리자에게 필요한 건 식별·분류·노출상태 정보 (id/이름/타입/가격/재고/상태/하위분류).
 */
public final class AdminProductDto {

    private AdminProductDto() {}

    /**
     * 상품 목록 1행. AdminProductService 가 Product 엔티티 → ListItem 변환.
     */
    public record ListItem(
            Long id,
            String name,
            Long brandId,            // 드롭다운 현재 선택값 (brand 없으면 null)
            String brandName,        // brand 없으면 null
            String imageUrl,         // 썸네일 (없으면 null)
            Integer price,
            Integer stock,
            String productType,      // KEYBOARD / KEYCAP / SWITCH_PART / ACCESSORY ...
            String status,           // ACTIVE / INACTIVE / SOLD_OUT
            Long subCategoryId,      // 하위 카테고리 드롭다운 현재 선택값 (P2, 없으면 null)
            String subCategoryName,  // 하위 카테고리명 (P2, 없으면 null)
            LocalDateTime createdAt
    ) {
        public static ListItem from(Product p) {
            return new ListItem(
                    p.getId(),
                    p.getName(),
                    p.getBrand() != null ? p.getBrand().getId() : null,
                    p.getBrand() != null ? p.getBrand().getName() : null,
                    p.getImageUrl(),
                    p.getPrice(),
                    p.getStock(),
                    p.getProductType() != null ? p.getProductType().name() : null,
                    p.getStatus() != null ? p.getStatus().name() : null,
                    p.getSubCategory() != null ? p.getSubCategory().getId() : null,
                    p.getSubCategory() != null ? p.getSubCategory().getName() : null,
                    p.getCreatedAt()
            );
        }
    }

    /**
     * 상태 변경 요청 body.
     * PATCH /api/admin/products/{id}/status  { "status": "INACTIVE" }
     */
    public record StatusUpdateRequest(
            String status          // ACTIVE / INACTIVE
    ) {
    }

    /**
     * 브랜드 변경 요청 body.
     * PATCH /api/admin/products/{id}/brand  { "brandId": 3 }
     *
     * brandId == null 이면 브랜드 미지정(연결 해제)으로 처리한다.
     */
    public record BrandUpdateRequest(
            Long brandId
    ) {
    }

    /**
     * 재고 변경 요청 body (P1 5/28 — B-1 품절 방식).
     * PATCH /api/admin/products/{id}/stock  { "stock": 0 }
     *
     * 관리자 [품절 처리] 버튼 → stock=0, [판매 재개] 버튼 → stock=기본값(양수).
     * stock 은 0 이상이어야 하며, null 이면 badRequest 로 차단한다(Service 에서 검증).
     * status(노출 on/off) 는 건드리지 않는다 — 품절은 stock 으로만 판정.
     */
    public record StockUpdateRequest(
            Integer stock
    ) {
    }

    /**
     * 하위 카테고리 변경 요청 body (P2 5/28).
     * PATCH /api/admin/products/{id}/sub-category  { "subCategoryId": 8 }
     *
     * subCategoryId == null 이면 하위분류 미지정(연결 해제)으로 처리한다.
     * 지정 시 그 하위분류의 product_type 이 상품의 product_type 과 일치해야 한다(Service 검증).
     */
    public record SubCategoryUpdateRequest(
            Long subCategoryId
    ) {
    }
}
