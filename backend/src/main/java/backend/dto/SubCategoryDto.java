package backend.dto;

import backend.entity.SubCategory;
import lombok.*;

public class SubCategoryDto {

    @Getter @Setter
    @NoArgsConstructor @AllArgsConstructor
    @Builder
    public static class Request {
        private String productType;   // 'KEYBOARD' 등 (생성 시 필수, 수정 시 변경 불가)
        private String name;
        private Integer sortOrder;
    }

    @Getter @Setter @Builder
    @NoArgsConstructor @AllArgsConstructor
    public static class Response {
        private Long id;
        private String productType;
        private String name;
        private Integer sortOrder;
        private boolean isDefault;     // 시드 '기타' 여부 (프론트에서 삭제 버튼 숨김)
        private long productCount;      // 이 하위분류를 쓰는 상품 수

        public static Response of(SubCategory s, long productCount) {
            return Response.builder()
                    .id(s.getId())
                    .productType(s.getProductType())
                    .name(s.getName())
                    .sortOrder(s.getSortOrder())
                    .isDefault(s.isDefault())
                    .productCount(productCount)
                    .build();
        }
    }
}
