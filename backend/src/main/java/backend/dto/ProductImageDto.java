package backend.dto;

import backend.entity.ProductImage;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductImageDto {
    private Long id;
    private String imageUrl;
    private Integer displayOrder;
    private String imageType;  // ImageType enum name (GALLERY/THUMBNAIL/DETAIL)

    public static ProductImageDto from(ProductImage image) {
        return ProductImageDto.builder()
                .id(image.getId())
                .imageUrl(image.getImageUrl())
                .displayOrder(image.getDisplayOrder())
                .imageType(image.getImageType().name())
                .build();
    }
}
