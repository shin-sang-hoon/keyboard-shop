package backend.dto;

import lombok.*;

public class BrandDto {

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class Request {
        private String name;
        private String logoUrl;
        private String description;
    }

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class Response {
        private Long id;
        private String name;
        private String logoUrl;
        private String description;
    }
}