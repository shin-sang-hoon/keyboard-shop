package backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "order_items")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false)
    private int price;

    // ── 3D 빌더 커스텀 옵션 (일반 상품은 전부 null) ──────────────
    @Column(length = 20)
    private String layout;

    @Column(name = "switch_type", length = 20)
    private String switchType;

    @Column(name = "keycap_color", length = 20)
    private String keycapColor;

    @Column(name = "case_color", length = 20)
    private String caseColor;

    /**
     * 옵션 반영 단가 스냅샷 (서버 재계산값, 주문 시점 가격 고정).
     * null = 일반 상품 → product.price 가 단가.
     * price 필드는 unitPrice × quantity 의 합계 금액.
     */
    @Column(name = "unit_price")
    private Integer unitPrice;
}