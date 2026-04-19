package backend.dto;

import lombok.*;
import java.util.List;

public class CategoryDto {

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Response {
        private Long id;
        private String name;
        private String slug;
        private Long parentId;
        private List<Response> children;
    }
}