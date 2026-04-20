package backend.dto;

import lombok.*;
import java.util.List;

public class TagDto {

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class Request {
        private String name;
        private String color;
    }

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class Response {
        private Long id;
        private String name;
        private String color;
    }

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class BulkApplyRequest {
        private Long tagId;
        private List<Long> productIds;
    }
}