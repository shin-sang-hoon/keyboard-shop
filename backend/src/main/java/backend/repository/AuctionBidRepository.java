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
}