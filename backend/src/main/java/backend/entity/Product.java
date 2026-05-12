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

    /**
     * 상품 타입 분류 (5-J 재편: 5/13).
     *
     * 도메인 학습 후 진화:
     *  - swagkey.kr 표준 분석 결과 한국 기계식 키보드 시장은 Keyboards/Switches/Keycaps/Accessories 4축 구성
     *  - 초기 5-G Step 1 에서 MOUSE 추가했으나 swagkey crawler 버그로 키캡들이 KEYBOARD 로 묻혀있었던 것 발견
     *  - V7 SQL 로 KEYCAP 추가 + 키캡 93개 복원 + MOUSE ACTIVE → INACTIVE
     *  - MOUSE enum 값은 DB INACTIVE 213 row 호환성 위해 유지 (deprecated)
     */
    public enum ProductType {
        KEYBOARD,      // 키보드 본체 (메인 상품) - ACTIVE 104
        KEYCAP,        // 키캡 (염료승화/이중사출/PBT 등) - ACTIVE 93 (5-J NEW)
        SWITCH_PART,   // 스위치 교체 부품 - ACTIVE 1
        ACCESSORY,     // 케이블/팜레스트/데스크패드 등 - ACTIVE 24
        NOISE,         // 크롤러 노이즈
        UNCLASSIFIED,  // 미분류 (기본값)

        /** @deprecated 5-J 재편으로 비활성. DB 호환성 위해 enum 값 유지. */
        @Deprecated
        MOUSE          // INACTIVE 214 (213 naver + 1 keychron M5)
    }
}
