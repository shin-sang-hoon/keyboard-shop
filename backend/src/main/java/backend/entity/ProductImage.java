package backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "product_images",
        indexes = {
                @Index(name = "idx_product_image_order", columnList = "product_id, display_order")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "image_type", nullable = false)
    @Builder.Default
    private ImageType imageType = ImageType.GALLERY;

    public enum ImageType {
        THUMBNAIL,  // 메인 썸네일 (display_order=1, 카드 UI에 노출)
        GALLERY,    // 갤러리 추가 이미지 (display_order=2~7)
        DETAIL      // 상세페이지 인라인 이미지 (긴 세로 이미지 등)
    }
}
