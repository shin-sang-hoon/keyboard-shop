package backend.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 상품 리뷰 엔티티 (5-H A2 + A6 통합).
 *
 * 설계 결정:
 *  - rating: Double 1.0~5.0 (0.5 단위) — 검증은 Service 레이어
 *  - orderItem FK NOT NULL + UNIQUE(order_item_id) — "구매 인증 리뷰만 허용" 정책을 DB 로 강제
 *      · 1 OrderItem 당 최대 1 Review
 *      · 재구매 = 새 OrderItem = 새 Review 가능 (사용자 요구사항)
 *      · user-product 직접 UNIQUE 대신 OrderItem 경유 — 도메인 의미가 DB 에 인코딩됨
 *  - 단방향 ManyToOne (User/Product/OrderItem 수정 없음) — A4 일관성, N+1 회피
 *  - content nullable — 별점만 남기는 리뷰 허용
 *  - audit: created_at + updated_at (Review 는 수정 가능 도메인)
 *  - isVerifiedPurchase 필드 미추가 — orderItem 존재 자체가 인증 증거, DTO 에서 파생
 *
 * A6 에 남아있는 작업: ReviewService.create() 에서 "OrderItem.user == 리뷰 작성자" 검증 +
 *                    배송완료 상태 검증 + UNIQUE 위반 시 명시적 예외 변환
 */
@Entity
@Table(
    name = "reviews",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_review_order_item", columnNames = "order_item_id")
    },
    indexes = {
        @Index(name = "idx_review_product", columnList = "product_id"),
        @Index(name = "idx_review_user", columnList = "user_id")
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** 구매 인증 키 — UNIQUE 보장. OrderItem 이 "1번의 구매 행위" 를 표현 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_item_id", nullable = false)
    private OrderItem orderItem;

    /** 1.0 ~ 5.0, 0.5 단위 (Service 에서 검증) */
    @Column(nullable = false)
    private Double rating;

    /** nullable — 별점만 남기는 리뷰 허용 */
    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
