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

    // P2 (5/28): 하위 카테고리 — product_type 종속 분류. V18 에서 컬럼/FK/기타 시드.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sub_category_id")
    private SubCategory subCategory;

    @Column(nullable = false)
    private String name;

    // P3 (5/29): 상세정보 HTML 본문 (WYSIWYG 작성, DOMPurify 후 렌더).
    //   - LONGTEXT 매핑 — columnDefinition 명시 필수 (미명시 시 Hibernate 가 varchar(255) 기대 → validate 실패).
    //   - 단건 상세 응답에서만 hydrate (목록 페이로드 제외 — detail-only 로딩).
    @Column(columnDefinition = "LONGTEXT")
    private String description;

    private String imageUrl;

    private Integer price;

    // 재고 — NOT NULL (V_stock: ALTER NOT NULL DEFAULT 0). importer/시드가 미지정 시
    //   @Builder.Default 로 0 주입 (Integer 라 무명시 시 null → DB NOT NULL 거부 방지).
    //   품절 판정은 stock=0 (B-1 방식, status 와 직교).
    @Column(nullable = false)
    @Builder.Default
    private Integer stock = 0;

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
