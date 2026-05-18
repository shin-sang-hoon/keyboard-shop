package backend.repository;

import backend.entity.AuctionWatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 경매 관심 등록 Repository (Phase 7 Round 4, 5/18).
 * 패턴: WishlistRepository 와 동일.
 */
@Repository
public interface AuctionWatchRepository extends JpaRepository<AuctionWatch, Long> {

    /**
     * 특정 사용자가 특정 경매에 관심 등록했는지 확인.
     * AuctionDetailPage 진입 시 isWatchedByMe 계산용.
     */
    Optional<AuctionWatch> findByUser_IdAndAuction_Id(Long userId, Long auctionId);

    /**
     * 관심 해제 (삭제) - bulk delete 패턴.
     * 토글 시 사용.
     */
    @Modifying
    @Query("DELETE FROM AuctionWatch w WHERE w.user.id = :userId AND w.auction.id = :auctionId")
    int deleteByUserIdAndAuctionId(@Param("userId") Long userId, @Param("auctionId") Long auctionId);

    /**
     * 특정 경매의 관심 등록 수 (집계).
     * watchCount 컬럼과 검증/동기화 용.
     */
    long countByAuction_Id(Long auctionId);
}
