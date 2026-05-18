package backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 장바구니 Aggregate Root (Phase 8 5-D, 5/18).
 *
 * 도메인 구조:
 *   User 1 ── 1 Cart ── N CartItem ── N Product
 *
 * 정책:
 * - 회원가입 시 자동 생성 (AuthService.signup + registerKakaoUser)
 * - 기존 사용자 backfill (V13 SQL 의 INSERT IGNORE)
 * - 사용자당 정확히 1개 (UNIQUE user_id 제약)
 * - 회원 탈퇴 시 CASCADE 로 Cart + CartItem 자동 삭제
 *
 * 패턴:
 * - Order Aggregate Root (Order/OrderItem) 와 대칭
 * - 향후 확장: appliedCoupon, shippingAddress, note 등 추가 가능
 */
@Entity
@Table(name = "carts",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_cart_user", columnNames = {"user_id"})
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Cart {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /**
     * 카트 아이템 (mappedBy로 양방향 연관관계).
     * CascadeType.ALL: Cart 저장/삭제 시 CartItem 도 같이.
     * orphanRemoval: items.remove(item) 만 호출해도 DB 에서 삭제됨.
     */
    @OneToMany(mappedBy = "cart", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CartItem> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ─── 도메인 메서드 (Aggregate Root behavior) ─────────────────

    /**
     * 아이템 추가. 같은 product 이미 있으면 quantity 증가.
     * @return 추가된/갱신된 CartItem
     */
    public CartItem addItem(Product product, int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }
        for (CartItem existing : items) {
            if (existing.getProduct().getId().equals(product.getId())) {
                existing.setQuantity(existing.getQuantity() + quantity);
                return existing;
            }
        }
        CartItem newItem = CartItem.builder()
                .cart(this)
                .product(product)
                .quantity(quantity)
                .build();
        items.add(newItem);
        return newItem;
    }

    /**
     * 총액 계산 (price × quantity 합).
     */
    public int getTotalPrice() {
        return items.stream()
                .mapToInt(item -> {
                    Integer price = item.getProduct().getPrice();
                    return (price != null ? price : 0) * item.getQuantity();
                })
                .sum();
    }

    /**
     * 총 quantity 합 (Header 배지용).
     */
    public int getTotalQuantity() {
        return items.stream().mapToInt(CartItem::getQuantity).sum();
    }
}
