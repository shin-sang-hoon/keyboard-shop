package backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 하위 카테고리 (P2, 2026-05-28).
 *
 * 설계:
 *   대분류 = Product.ProductType enum (KEYBOARD/KEYCAP/SWITCH_PART/ACCESSORY...) — 고정
 *     └ 하위분류 = SubCategory (product_type 종속) — 관리자가 CRUD
 *         └ 상품 = Product.subCategory FK
 *
 * 기존 categories(parent/children) 테이블과의 차별점:
 *   SubCategory 는 product_type 에 종속되어 "이 하위분류는 KEYBOARD 소속" 이라는
 *   대분류 연결고리를 가진다. categories 는 crawler 시절 미사용 레거시(category_id 0건).
 *
 * 제약: UNIQUE(product_type, name) — 같은 대분류 안에서 이름 중복 방지.
 *   '기타' 는 product_type 별 1개씩 V18 에서 시드됨 (삭제 불가 가드).
 */
@Entity
@Table(
    name = "sub_categories",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_subcat_type_name",
        columnNames = {"product_type", "name"}
    )
)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubCategory {

    /** 시드된 '기타' 의 이름 — 삭제 방어 기준. */
    public static final String DEFAULT_NAME = "기타";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 대분류 — Product.ProductType enum 의 name() 문자열.
     * enum 직접 참조 대신 문자열로 보관 (deprecated MOUSE 등 호환 + 느슨한 결합).
     */
    @Column(name = "product_type", nullable = false, length = 32)
    private String productType;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.sortOrder == null) {
            this.sortOrder = 0;
        }
    }

    /** 시드 '기타' 여부 — 삭제 방어. */
    public boolean isDefault() {
        return DEFAULT_NAME.equals(this.name);
    }
}
