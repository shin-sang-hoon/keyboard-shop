package backend.repository;

import backend.entity.Auction;
import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AuctionRepository extends JpaRepository<Auction, Long> {
    List<Auction> findBySeller(User seller);
    List<Auction> findByStatus(Auction.Status status);
    List<Auction> findByStatusOrderByEndAtAsc(Auction.Status status);
}