package backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 경매 관심 등록 (Phase 7 Round 4, 5/18).
 *
 * 사용자가 특정 경매에 관심 등록 = auction_watches 행 추가 + auctions.watch_count +1.
 * 관심 해제 = 행 삭제 + watch_count -1.
 *
 * UNIQUE(user_id, auction_id) 로 중복 등록 방지.
 *
 * 패턴: Wishlist 와 동일 (자산 #4: ProductLike + Wishlist 분리).
 * - ProductLike: ♥좋아요 public
 * - Wishlist: ⭐찜 private (상품용)
 * - AuctionWatch: 👁 관심 private (경매용, 사회적 증명 watch_count 집계)
 */
@Entity
@Table(name = "auction_watches",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_auction_watch_user_auction", columnNames = {"user_id", "auction_id"})
        },
        indexes = {
                @Index(name = "idx_auction_watch_user", columnList = "user_id"),
                @Index(name = "idx_auction_watch_auction", columnList = "auction_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuctionWatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_id", nullable = false)
    private Auction auction;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
