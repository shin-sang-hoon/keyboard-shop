package backend.dto;

import lombok.*;
import java.util.List;

public class InternalProductDtos {

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class UpsertRequest {
        private String sourceId;
        private String name;
        private String brandName;

        /**
         * 단일 대표 이미지 URL — 후방 호환 유지 (5-H D1 이전 클라이언트).
         * 5-H D1 이후에는 imageUrls[0] 과 동일하게 채우는 것을 권장.
         * imageUrls 가 비어있으면 이 필드를 1장 이미지로 fallback 사용.
         */
        private String imageUrl;

        /**
         * 다중 이미지 URL 리스트 (5-H D1 신규).
         * - 0번 인덱스가 대표 이미지 (display_order=1)
         * - 비어있으면 imageUrl 1장으로 fallback
         * - 갤러리 표시용 ProductImage 테이블에 적재됨
         */
        private List<String> imageUrls;

        private Integer price;
        private String productUrl;
        private String layout;
        private String switchType;
        private String mountingType;
        private String connectionType;
        private String glbUrl;
    }

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class UpsertResponse {
        private Long productId;
        private String status; // "created" | "updated"
        private Integer imagesCount; // 5-H D1 — 적재된 이미지 개수 (디버깅/검증용)
    }

    // ── 배치 upsert (크롤러 1회 실행분 전체) ──────────────────────────────

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class BatchUpsertRequest {
        private String siteName;          // "naver_shopping" | "keychron_brand"
        private String siteUrl;
        private List<UpsertRequest> products;
    }

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class BatchUpsertResponse {
        private Long crawlLogId;
        private int created;
        private int updated;
        private int failed;
        private int totalImages;          // 5-H D1 — 적재된 ProductImage row 합계
        private String status;            // "SUCCESS" | "PARTIAL" | "FAILED"
    }
}
