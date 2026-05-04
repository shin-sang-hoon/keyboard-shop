package backend.dto;

import backend.entity.Wishlist;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 찜(Wishlist) DTO (B4).
 *
 * 설계 원칙:
 *   - Wishlist 는 private intent (본인만 보는 구매 의향) → count 노출 안 함
 *   - Like 와 별도 엔티티 (메모 v2 분리 결정 — 4/29)
 *
 * Item 응답에 product 의 핵심 필드만 포함:
 *   - productId/name/price/imageUrl/brandName 만 (목록용 카드)
 *   - 풀 ProductDto 는 너무 무거움
 */
public class WishlistDto {

    /** 찜 토글 응답 */
    @Getter
    @NoArgsConstructor(access = AccessLevel.PRIVATE)
    @AllArgsConstructor
    @Builder
    public static class ToggleResponse {
        private boolean wishlisted;  // 토글 후 상태
    }

    /** 내 찜 목록 아이템 */
    @Getter
    @NoArgsConstructor(access = AccessLevel.PRIVATE)
    @AllArgsConstructor
    @Builder
    public static class Item {
        private Long wishlistId;
        private Long productId;
        private String productName;
        private Integer price;
        private String imageUrl;
        private String brandName;
        private LocalDateTime createdAt;

        /**
         * Wishlist 엔티티 → DTO 변환.
         *
         * 주의: Wishlist.product 는 LAZY 로딩이므로 Service 에서 fetch join
         * 또는 JPQL 로 미리 로드한 상태로 호출해야 함.
         * 호출자가 Pageable 페이지 단위로 가져오므로 N+1 위험 → fetch join 필수.
         */
        public static Item from(Wishlist wishlist) {
            return Item.builder()
                    .wishlistId(wishlist.getId())
                    .productId(wishlist.getProduct().getId())
                    .productName(wishlist.getProduct().getName())
                    .price(wishlist.getProduct().getPrice())
                    .imageUrl(wishlist.getProduct().getImageUrl())
                    .brandName(wishlist.getProduct().getBrand() != null
                            ? wishlist.getProduct().getBrand().getName()
                            : null)
                    .createdAt(wishlist.getCreatedAt())
                    .build();
        }
    }
}
