package backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 장바구니 개별 아이템 (Phase 8 5-D, 5/18).
 *
 * Cart Aggregate 의 child entity. Cart 를 통해서만 생성/삭제됨 (직접 save 권장 안 함).
 *
 * UNIQUE(cart_id, product_id) 로 중복 방지 — 같은 상품 2번 담으면 quantity 증가 (Cart.addItem 로직).
 *
 * 패턴 차이:
 * - Wishlist/AuctionWatch: User x Item N:M, 단순 존재 여부
 * - CartItem: Cart x Product N:M, quantity 필드 + updatedAt
 */
@Entity
@Table(name = "cart_items",
        indexes = {
                @Index(name = "idx_cart_item_cart", columnList = "cart_id"),
                @Index(name = "idx_cart_item_product", columnList = "product_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cart_id", nullable = false)
    private Cart cart;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /**
     * 수량 (1 이상).
     * DB CHECK 제약 + 어플리케이션 가드 (Cart.addItem 에서 0 이하 거부).
     */
    @Column(nullable = false)
    @Builder.Default
    private int quantity = 1;

    // ── 3D 빌더 커스텀 옵션 (일반 상품은 전부 null) ──────────────
    @Column(length = 20)
    private String layout;        // 65 / 75 / TKL / FULL

    @Column(name = "switch_type", length = 20)
    private String switchType;    // LINEAR / TACTILE / CLICKY

    @Column(name = "keycap_color", length = 20)
    private String keycapColor;   // original / white / black / gray / navy / red / mint

    @Column(name = "case_color", length = 20)
    private String caseColor;     // 빌더 케이스 색 id (가격 영향 없음, 표시용)

    /**
     * 옵션 반영 단가 (서버에서 가격표로 재계산해 저장 — 위변조 방어).
     * null = 일반 상품 → product.price 를 그대로 단가로 사용.
     */
    @Column(name = "unit_price")
    private Integer unitPrice;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.quantity <= 0) this.quantity = 1;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
