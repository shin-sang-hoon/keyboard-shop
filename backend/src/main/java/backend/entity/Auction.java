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
        this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = Status.ACTIVE;
        if (this.currentPrice == 0) this.currentPrice = this.startPrice;
        if (this.version == null) this.version = 0L;
    }

    public enum Condition {
        NEW, EXCELLENT, GOOD, FAIR
    }

    public enum Status {
        ACTIVE, ENDED, CANCELLED
    }
}
