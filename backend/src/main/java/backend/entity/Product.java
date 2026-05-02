package backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id")
    private Brand brand;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false)
    private String name;

    private String imageUrl;

    private Integer price;

    private Integer stock;

    @Column(unique = true)
    private String sourceId;

    private String layout;

    private String switchType;

    private String switchName;

    private String mountingType;

    private String connectionType;

    private String gbStatus;

    private String glbUrl;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProductStatus status = ProductStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "product_type")
    @Builder.Default
    private ProductType productType = ProductType.UNCLASSIFIED;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL)
    @Builder.Default
    private List<ProductTag> productTags = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    @Builder.Default
    private List<ProductImage> images = new ArrayList<>();

    // 편의 메서드 (양방향 동기화)
    public void addImage(ProductImage image) {
        images.add(image);
        image.setProduct(this);
    }

    public void removeImage(ProductImage image) {
        images.remove(image);
        image.setProduct(null);
    }

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    public enum ProductStatus {
        ACTIVE, INACTIVE, SOLD_OUT
    }

    public enum ProductType {
        KEYBOARD,      // 키보드 본체 (메인 상품) - 1880개
        MOUSE,         // 마우스 - 186 + 24 = 210개
        SWITCH_PART,   // 스위치 교체 부품 - 172개
        ACCESSORY,     // 키캡/케이블/팜레스트 등 - 53개
        NOISE,         // 크롤러 노이즈 - 미정 (Step 3에서 분류)
        UNCLASSIFIED   // 미분류 (기본값) - 162개
    }
}
