package backend.repository;

import backend.entity.AuctionBid;
import backend.entity.Auction;
import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AuctionBidRepository extends JpaRepository<AuctionBid, Long> {
    List<AuctionBid> findByAuctionOrderByBidPriceDesc(Auction auction);
    List<AuctionBid> findByUser(User user);
    Optional<AuctionBid> findTopByAuctionOrderByBidPriceDesc(Auction auction);

    // ─── Flash Deal 확장 (5/17) ───────────────────────────────────

    /**
     * 특정 경매의 입찰 건수 (취소 가능 여부 판단용).
     * COUNT(*) 쿼리로 효율화 (findAll filter 대비 N배 빠름).
     */
    long countByAuctionId(Long auctionId);

    List<AuctionBid> findByUserOrderByCreatedAtDesc(User user);
}
