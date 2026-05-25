package backend.dto;

import backend.entity.Product;

import java.time.LocalDateTime;

/**
 * 관리자 상품 관리 DTO (Phase 7-G 라운드 5).
 *
 * 중첩 구조:
 *   - AdminProductDto.ListItem          : 상품 목록 응답 1행
 *   - AdminProductDto.StatusUpdateRequest : 상태 변경 요청 body
 *
 * 공개 API 의 ProductDto.Response 와 분리한 이유:
 *   - 관리자 목록은 리뷰/QnA 집계, 다중 이미지가 불필요 → 가벼운 DTO.
 *   - 관리자에게 필요한 건 식별·분류·노출상태 정보 (id/이름/타입/가격/재고/상태).
 */
public final class AdminProductDto {

    private AdminProductDto() {}

    /**
     * 상품 목록 1행. AdminProductService 가 Product 엔티티 → ListItem 변환.
     */
    public record ListItem(
            Long id,
            String name,
            String brandName,      // brand 없으면 null
            String imageUrl,       // 썸네일 (없으면 null)
            Integer price,
            Integer stock,
            String productType,    // KEYBOARD / KEYCAP / SWITCH_PART / ACCESSORY ...
            String status,         // ACTIVE / INACTIVE / SOLD_OUT
            LocalDateTime createdAt
    ) {
        public static ListItem from(Product p) {
            return new ListItem(
                    p.getId(),
                    p.getName(),
                    p.getBrand() != null ? p.getBrand().getName() : null,
                    p.getImageUrl(),
                    p.getPrice(),
                    p.getStock(),
                    p.getProductType() != null ? p.getProductType().name() : null,
                    p.getStatus() != null ? p.getStatus().name() : null,
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
}
