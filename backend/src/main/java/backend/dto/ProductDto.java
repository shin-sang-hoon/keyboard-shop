package backend.dto;

import backend.entity.Product;
import lombok.*;
import java.time.LocalDateTime;

public class ProductDto {

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Request {
        private String name;
        private Long brandId;
        private Long categoryId;
        private Integer price;
        private Integer stock;
        private String imageUrl;
        private String layout;
        private String switchType;
        private String switchName;
        private String mountingType;
        private String connectionType;
        private String gbStatus;
        private String sourceId;
        private String glbUrl;
        private Product.ProductStatus status;
        private Product.ProductType productType;   // 5-H D: 카테고리 분류 (KEYBOARD/MOUSE/SWITCH_PART/ACCESSORY/NOISE/UNCLASSIFIED)
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Response {
        private Long id;
        private String name;
        private String brandName;
        private String categoryName;
        private Integer price;
        private Integer stock;
        private String imageUrl;
        private String layout;
        private String switchType;
        private String switchName;
        private String mountingType;
        private String connectionType;
        private String gbStatus;
        private String sourceId;
        private String glbUrl;
        private Product.ProductStatus status;
        private String productType;   // 5-H D: enum.name() 문자열 ("KEYBOARD" 등) — 프론트 hasGlb 판정 + 카테고리 탭 필터링용
        private LocalDateTime createdAt;

        // 5-H B1: ProductImage 1:N + Review/QnA 집계 (N+1 방어 — Service 에서 IN 절 일괄 fetch)
        @Builder.Default
        private java.util.List<ProductImageDto> images = java.util.Collections.emptyList();
        private Double ratingAvg;       // null = 리뷰 0건 (프론트에서 "리뷰 없음" 표시)
        @Builder.Default
        private Long reviewCount = 0L;
        @Builder.Default
        private Long qnaCount = 0L;

    }
}