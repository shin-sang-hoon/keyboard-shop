package backend.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 상품 리뷰 엔티티 (5-H A2 + A6 통합, 7-G R8 hidden 추가).
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
 * 7-G R8 추가 — hidden 플래그:
 *  - 신고 처리 / 관리자 직접 숨김 시 true
 *  - hidden=true 리뷰는 공개 조회(상품 페이지·별점 통계)에서 제외 (ReviewRepository 가 필터)
 *  - 삭제(hard delete)가 아닌 soft hide — 신고 이력/통계 추적 보존
 *  - QnA.isSecret 과 동일하게 @Builder.Default 로 신규 row 는 false 기본값
 *
 * 도메인 메서드:
 *  - updateContent(rating, content): 본인 리뷰 수정. dirty checking 으로 자동 UPDATE.
 *  - updateHidden(hidden): 관리자 숨김/복원. dirty checking 으로 자동 UPDATE.
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

    /**
     * 7-G R8 — 관리자 숨김 플래그.
     * true 면 공개 리뷰 목록/별점 통계에서 제외 (ReviewRepository 의 공개 쿼리가 hidden=false 필터).
     * V16__add_review_hidden_and_reports.sql 로 컬럼 추가 (DEFAULT FALSE).
     */
    @Column(name = "hidden", nullable = false)
    @Builder.Default
    private Boolean hidden = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.hidden == null) {
            this.hidden = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 도메인 메서드 — 본인 리뷰 수정 (5-H B2).
     *
     * Setter 노출 없이 의도가 드러나는 도메인 인터페이스.
     * @Transactional 영속성 컨텍스트 안에서 호출하면 dirty checking 으로 UPDATE 자동 발행.
     * Service 가 Review 를 save() 다시 호출할 필요 없음.
     */
    public void updateContent(Double rating, String content) {
        this.rating = rating;
        this.content = content;
    }

    /**
     * 도메인 메서드 — 관리자 숨김/복원 (7-G R8).
     *
     * 신고 처리(resolve) 또는 관리자 직접 숨김 토글에서 호출.
     * dirty checking 으로 UPDATE 자동 발행.
     */
    public void updateHidden(boolean hidden) {
        this.hidden = hidden;
    }
}
