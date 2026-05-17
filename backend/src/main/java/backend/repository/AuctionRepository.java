package backend.repository;

import backend.entity.Auction;
import backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AuctionRepository extends JpaRepository<Auction, Long> {

    List<Auction> findBySeller(User seller);
    List<Auction> findByStatus(Auction.Status status);
    List<Auction> findByStatusOrderByEndAtAsc(Auction.Status status);

    // ─── Flash Deal 확장 (5/17) ───────────────────────────────────

    /**
     * 동일 상품의 진행 가능 상태 (ACTIVE/SCHEDULED) 경매 중복 방지용.
     * AdminAuctionService 등록 시 검증.
     *
     * 5/17 SCHEDULED 추가에 따라 List 반환 + status IN (ACTIVE, SCHEDULED).
     */
    List<Auction> findByProductIdAndStatusIn(Long productId, List<Auction.Status> statuses);

    /**
     * 단일 상태 조회 (이전 V9 시그니처 호환).
     */
    Optional<Auction> findByProductIdAndStatus(Long productId, Auction.Status status);

    /**
     * 플래시 딜 전체 (관리자 대시보드용).
     * 정렬: SCHEDULED → ACTIVE → ENDED → CANCELLED, 같은 상태는 endAt asc.
     */
    List<Auction> findByIsFlashDealTrueOrderByStatusAscEndAtAsc();

    /**
     * 활성 플래시 딜 (메인 페이지 배너용).
     */
    List<Auction> findByIsFlashDealTrueAndStatusOrderByEndAtAsc(Auction.Status status);

    /**
     * 일반 경매와 플래시 딜 분리 조회.
     */
    List<Auction> findByIsFlashDealAndStatusOrderByEndAtAsc(Boolean isFlashDeal, Auction.Status status);

    /**
     * 다중 상태 조회 (관리자 탭 필터: 진행중/대기/완료).
     */
    List<Auction> findByIsFlashDealAndStatusInOrderByCreatedAtDesc(
            Boolean isFlashDeal, List<Auction.Status> statuses);

    // ─── Scheduler 용 (V10, 5/17) ────────────────────────────────

    /**
     * SCHEDULED 중 startAt 도달한 경매 (자동 ACTIVE 전환 대상).
     * AuctionScheduler @Scheduled fixedRate=60000 매 분 호출.
     */
    List<Auction> findByStatusAndStartAtLessThanEqual(Auction.Status status, LocalDateTime now);

    /**
     * ACTIVE 중 endAt 지난 경매 (자동 ENDED 전환 대상).
     * 향후 Phase 8 자연 종료 처리용.
     */
    List<Auction> findByStatusAndEndAtLessThanEqual(Auction.Status status, LocalDateTime now);
}
