package backend.dto;

import lombok.*;

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
        private String status;
    }
}