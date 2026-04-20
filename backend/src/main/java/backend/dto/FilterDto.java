package backend.dto;

import lombok.*;
import java.util.List;

public class FilterDto {

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class GroupRequest {
        private String name;
        private Integer displayOrder;
    }

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class OptionRequest {
        private Long filterGroupId;
        private String name;
        private String value;
        private Integer displayOrder;
    }

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class OptionResponse {
        private Long id;
        private String name;
        private String value;
        private Integer displayOrder;
    }

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class GroupResponse {
        private Long id;
        private String name;
        private Integer displayOrder;
        private List<OptionResponse> options;
    }
}