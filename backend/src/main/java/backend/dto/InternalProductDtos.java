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
        private String imageUrl;
        private Integer price;
        private String productUrl;
        private String layout;
        private String switchType;
        private String mountingType;
        private String connectionType;
    }

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class UpsertResponse {
        private Long productId;
        private String status; // "created" | "updated"
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
        private String status;            // "SUCCESS" | "PARTIAL" | "FAILED"
    }
}
