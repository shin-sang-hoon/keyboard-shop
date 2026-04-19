package backend.dto;

import lombok.*;
import java.time.LocalDateTime;

public class CustomBuildDto {

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Request {
        private Long productId;
        private String buildConfig; // JSON 문자열
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Response {
        private Long id;
        private Long productId;
        private String productName;
        private String buildConfig; // JSON 문자열
        private LocalDateTime createdAt;
    }
}