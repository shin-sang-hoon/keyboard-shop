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
     * 아이템 추가 (일반 상품 — 옵션 없음). 같은 product 있으면 quantity 증가.
     */
    public CartItem addItem(Product product, int quantity) {
        return addItem(product, quantity, null, null, null, null, null);
    }

    /**
     * 아이템 추가 (3D 빌더 커스텀 옵션 포함).
     * 같은 product + 같은 옵션 조합이면 quantity 합산, 옵션이 다르면 별도 아이템으로 추가.
     * @param unitPrice 서버에서 재계산한 옵션 반영 단가 (null=일반 상품 → product.price 사용)
     * @return 추가된/갱신된 CartItem
     */
    public CartItem addItem(Product product, int quantity,
                            String layout, String switchType, String keycapColor, String caseColor,
                            Integer unitPrice) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }
        for (CartItem existing : items) {
            if (existing.getProduct().getId().equals(product.getId())
                    && sameOption(existing.getLayout(), layout)
                    && sameOption(existing.getSwitchType(), switchType)
                    && sameOption(existing.getKeycapColor(), keycapColor)
                    && sameOption(existing.getCaseColor(), caseColor)) {
                existing.setQuantity(existing.getQuantity() + quantity);
                return existing;
            }
        }
        CartItem newItem = CartItem.builder()
                .cart(this)
                .product(product)
                .quantity(quantity)
                .layout(layout)
                .switchType(switchType)
                .keycapColor(keycapColor)
                .caseColor(caseColor)
                .unitPrice(unitPrice)
                .build();
        items.add(newItem);
        return newItem;
    }

    /** 옵션 동등 비교 (null-safe). */
    private static boolean sameOption(String a, String b) {
        return (a == null) ? (b == null) : a.equals(b);
    }

    /**
     * 총액 계산. unitPrice(옵션 반영 단가)가 있으면 그것, 없으면 product.price.
     */
    public int getTotalPrice() {
        return items.stream()
                .mapToInt(item -> {
                    Integer unit = item.getUnitPrice();
                    int price = (unit != null)
                            ? unit
                            : (item.getProduct().getPrice() != null ? item.getProduct().getPrice() : 0);
                    return price * item.getQuantity();
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
