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
        private Product.ProductType productType;   // 5-H D: 카테고리 분류 (KEYBOARD/KEYCAP/SWITCH_PART/ACCESSORY/NOISE/UNCLASSIFIED (MOUSE deprecated))
        // P3 노트: description 은 의도적으로 Request 에 없음.
        //   PUT /api/products(공개·permitAll)로 HTML 을 받으면 무가드 stored XSS 쓰기 구멍 →
        //   description 쓰기는 가드된 PATCH /api/admin/products/{id}/description 으로만.
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

        // P3 (5/29): 상세정보 HTML 본문 (DOMPurify 후 렌더).
        //   단건 getProduct 에서만 hydrate (목록에선 null — 페이로드 절감, detail-only 로딩).
        private String description;

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
