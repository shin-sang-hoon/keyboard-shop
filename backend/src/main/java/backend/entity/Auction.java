package backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 경매 엔티티.
 *
 * Phase 7 WebSocket (5/12) 변경:
 *  - @Version 낙관적 락 추가 — 동시 입찰 시 currentPrice race condition 방지.
 *    두 스레드가 동시에 같은 currentPrice 를 읽고 각각 +1000 시도하면
 *    JPA 가 version 충돌 감지 → OptimisticLockingFailureException 발생.
 *    Controller 에서 catch + retry 로 처리.
 *
 * Phase 7 Round 4 (5/18) 변경:
 *  - viewCount / watchCount 필드 추가 (V11 컬럼) — 사회적 증명용.
 *  - viewCount: AuctionDetailPage 페이지 진입 시 +1 (POST /auctions/{id}/view).
 *  - watchCount: 관심 등록 토글 시 +1/-1 (POST /auctions/{id}/watch).
 *    auction_watches 테이블의 UNIQUE(user_id, auction_id) 와 함께 동작.
 */
@Entity
@Table(name = "auctions")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Auction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id")
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "item_images")
    private String itemImages;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_condition", nullable = false)
    private Condition condition;

    @Column(name = "start_price", nullable = false)
    private int startPrice;

    @Column(name = "current_price", nullable = false)
    private int currentPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // ─── Flash Deal 확장 (V9, 5/17) ───────────────────────────────
    /**
     * 플래시 딜 여부.
     * - TRUE: 관리자가 등록한 한정판 콜라보 이벤트 경매 (고가 키보드 상위 5%)
     * - FALSE: 일반 경매 (어제 만든 Auction 트랙 기본값)
     */
    @Column(name = "is_flash_deal", nullable = false)
    @Builder.Default
    private Boolean isFlashDeal = false;

    /**
     * 시작가 비율 (30~70, 플래시 딜 전용).
     * 정가의 N% 를 시작가로 설정. NULL = 일반 경매 (관리자가 startPrice 직접 입력).
     * 예: 정가 500,000원 x 50% = 시작가 250,000원
     */
    @Column(name = "start_price_percent")
    private Integer startPricePercent;

    /**
     * 경매 지속 시간 (1~168시간, 기본 24h).
     * createdAt + duration_hours = endAt 자동 계산용.
     */
    @Column(name = "duration_hours", nullable = false)
    @Builder.Default
    private Integer durationHours = 24;

    /**
     * 예약 시작 시각 (V10, 5/17).
     * - NULL: 등록 즉시 ACTIVE
     * - NOT NULL + SCHEDULED status: 해당 시각에 자동 ACTIVE 전환
     *
     * AuctionScheduler.@Scheduled(fixedRate=60000) 가 매 분 체크하여
     * startAt <= now AND status=SCHEDULED 인 row 를 ACTIVE 전환 + endAt 재계산
     * (endAt = startAt + durationHours).
     */
    @Column(name = "start_at")
    private LocalDateTime startAt;
    // ──────────────────────────────────────────────────────────────

    // ─── Social Proof 카운터 (V11, 5/18, Phase 7 Round 4) ─────────
    /**
     * 조회수.
     * AuctionDetailPage 페이지 진입 시 +1 (POST /auctions/{id}/view).
     * 비로그인 사용자도 카운트 (단순 카운터).
     */
    @Column(name = "view_count", nullable = false)
    @Builder.Default
    private Long viewCount = 0L;

    /**
     * 관심 등록 수.
     * 사용자가 관심 등록 시 +1, 해제 시 -1.
     * auction_watches 테이블의 행 수와 동기화됨.
     * UNIQUE(user_id, auction_id) 제약으로 한 사용자당 최대 1번.
     */
    @Column(name = "watch_count", nullable = false)
    @Builder.Default
    private Long watchCount = 0L;
    // ──────────────────────────────────────────────────────────────

    /**
     * 낙관적 락 버전 (Phase 7 WebSocket, 5/12).
     * JPA 가 자동으로 UPDATE 시 WHERE version=? 추가 + version+1.
     * 동시 수정 충돌 시 OptimisticLockingFailureException 발생.
     */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now(java.time.ZoneOffset.UTC);
        if (this.status == null) this.status = Status.ACTIVE;
        if (this.currentPrice == 0) this.currentPrice = this.startPrice;
        if (this.version == null) this.version = 0L;
        if (this.viewCount == null) this.viewCount = 0L;
        if (this.watchCount == null) this.watchCount = 0L;
    }

    public enum Condition {
        NEW, EXCELLENT, GOOD, FAIR
    }

    public enum Status {
        /**
         * 진행 중 — 입찰 가능.
         */
        ACTIVE,
        /**
         * 자연 종료 — endAt 도달, 최고입찰자 낙찰.
         */
        ENDED,
        /**
         * 취소 — 관리자 직접 취소 또는 입찰 0건 상태 취소.
         */
        CANCELLED,
        /**
         * 예약 등록 (V10, 5/17) — startAt 도달 시 자동 ACTIVE 전환.
         * AuctionScheduler.@Scheduled(fixedRate=60000) 가 매 분 체크.
         */
        SCHEDULED
    }
}
