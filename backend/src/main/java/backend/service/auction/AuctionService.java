package backend.service.auction;

import backend.dto.auction.AuctionDto;
import backend.entity.Auction;
import backend.entity.AuctionBid;
import backend.entity.AuctionWatch;
import backend.entity.User;
import backend.repository.AuctionBidRepository;
import backend.repository.AuctionRepository;
import backend.repository.AuctionWatchRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuctionService {

    private static final int RECENT_BIDS_LIMIT = 10;

    private final AuctionRepository auctionRepository;
    private final AuctionBidRepository auctionBidRepository;
    private final AuctionLiveService auctionLiveService;
    // Phase 7 Round 4 (5/18) - view/watch 풀스택
    private final AuctionWatchRepository auctionWatchRepository;
    private final UserRepository userRepository;

    public List<AuctionDto.ListItem> listActive() {
        return auctionRepository.findByStatusOrderByEndAtAsc(Auction.Status.ACTIVE)
                .stream()
                .map(this::toListItemWithCache)
                .toList();
    }

    /**
     * 경매 상세 조회.
     * Phase 7 Round 4 (5/18): email nullable, 로그인 사용자면 isWatchedByMe 계산.
     *
     * @param auctionId 경매 ID
     * @param email     로그인 사용자 이메일 (비로그인 시 null)
     */
    public Optional<AuctionDto.Detail> getDetail(Long auctionId, String email) {
        Optional<Auction> auctionOpt = auctionRepository.findById(auctionId);
        if (auctionOpt.isEmpty()) {
            return Optional.empty();
        }
        Auction auction = auctionOpt.get();

        // Redis 캐시 현재가 우선
        auctionLiveService.getCurrentPrice(auctionId)
                .ifPresent(auction::setCurrentPrice);

        List<AuctionBid> allBids = auctionBidRepository
                .findByAuctionOrderByBidPriceDesc(auction);
        int totalCount = allBids.size();
        List<AuctionDto.BidItem> recentBids = allBids.stream()
                .limit(RECENT_BIDS_LIMIT)
                .map(AuctionDto.BidItem::from)
                .toList();

        // isWatchedByMe 계산 (비로그인 시 false)
        boolean watchedByMe = false;
        if (email != null) {
            Optional<User> userOpt = userRepository.findByEmail(email);
            if (userOpt.isPresent()) {
                watchedByMe = auctionWatchRepository
                        .findByUser_IdAndAuction_Id(userOpt.get().getId(), auctionId)
                        .isPresent();
            }
        }

        return Optional.of(AuctionDto.Detail.from(auction, recentBids, totalCount, watchedByMe));
    }

    /**
     * 하위 호환 오버로드 - 비로그인 호출.
     * @deprecated email 받는 버전 사용 권장
     */
    public Optional<AuctionDto.Detail> getDetail(Long auctionId) {
        return getDetail(auctionId, null);
    }

    /**
     * 특정 상품의 ACTIVE 경매 조회 (없으면 Optional.empty).
     * 사용자 ProductDetail 페이지에서 핫딜 표시용.
     */
    public Optional<AuctionDto.Detail> findActiveByProductId(Long productId) {
        return auctionRepository.findByProductIdAndStatus(productId, Auction.Status.ACTIVE)
                .map(AuctionDto.Detail::from);
    }

    public List<AuctionDto.BidItem> listBids(Long auctionId, int limit) {
        Optional<Auction> auctionOpt = auctionRepository.findById(auctionId);
        if (auctionOpt.isEmpty()) {
            return List.of();
        }
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return auctionBidRepository
                .findByAuctionOrderByBidPriceDesc(auctionOpt.get())
                .stream()
                .limit(safeLimit)
                .map(AuctionDto.BidItem::from)
                .toList();
    }

    // ─── Phase 7 Round 4 (5/18) - 사회적 증명 풀스택 ───────────────

    /**
     * 조회수 +1. 페이지 진입 시마다 호출.
     *
     * 정책: 단순 카운터 (운영 시 Redis SET 1h 캐싱으로 같은 IP 중복 방지 개선 가능).
     * 비로그인 사용자도 카운트.
     *
     * @param auctionId 경매 ID
     * @return 갱신된 viewCount, auction 없으면 -1
     */
    @Transactional
    public long incrementViewCount(Long auctionId) {
        Optional<Auction> auctionOpt = auctionRepository.findById(auctionId);
        if (auctionOpt.isEmpty()) {
            return -1L;
        }
        Auction auction = auctionOpt.get();
        Long current = auction.getViewCount() != null ? auction.getViewCount() : 0L;
        auction.setViewCount(current + 1);
        // @Transactional flush + JPA dirty checking 으로 UPDATE 자동 실행
        log.debug("viewCount +1: auctionId={}, before={}, after={}", auctionId, current, current + 1);
        return current + 1;
    }

    /**
     * 관심 등록 토글.
     *
     * 정책:
     * - 인증 필요 (email != null)
     * - UNIQUE(user_id, auction_id) 로 중복 방지
     * - 이미 등록 → 삭제 + watchCount -1
     * - 미등록 → 추가 + watchCount +1
     *
     * @param email     로그인 사용자 이메일 (필수, null 시 IllegalArgumentException)
     * @param auctionId 경매 ID
     * @return ToggleResult { watched: 결과 상태, watchCount: 갱신된 값 }
     */
    @Transactional
    public ToggleResult toggleWatch(String email, Long auctionId) {
        if (email == null) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        Auction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> new RuntimeException("경매를 찾을 수 없습니다."));

        Optional<AuctionWatch> existing = auctionWatchRepository
                .findByUser_IdAndAuction_Id(user.getId(), auctionId);

        Long current = auction.getWatchCount() != null ? auction.getWatchCount() : 0L;

        if (existing.isPresent()) {
            // 토글 OFF: 삭제 + watchCount -1
            auctionWatchRepository.delete(existing.get());
            long after = Math.max(0L, current - 1);
            auction.setWatchCount(after);
            log.debug("watch toggle OFF: userId={}, auctionId={}, watchCount={}",
                    user.getId(), auctionId, after);
            return new ToggleResult(false, after);
        } else {
            // 토글 ON: 추가 + watchCount +1
            // UNIQUE 위반 race condition 대비 try/catch
            try {
                AuctionWatch watch = AuctionWatch.builder()
                        .user(user)
                        .auction(auction)
                        .build();
                auctionWatchRepository.save(watch);
                long after = current + 1;
                auction.setWatchCount(after);
                log.debug("watch toggle ON: userId={}, auctionId={}, watchCount={}",
                        user.getId(), auctionId, after);
                return new ToggleResult(true, after);
            } catch (DataIntegrityViolationException e) {
                // 동시 호출로 이미 들어간 경우 - 멱등 처리
                log.warn("watch toggle ON race condition - already exists: userId={}, auctionId={}",
                        user.getId(), auctionId);
                return new ToggleResult(true, current);
            }
        }
    }

    /**
     * watch 토글 결과 DTO.
     */
    public record ToggleResult(boolean watched, long watchCount) {}

    // ─────────────────────────────────────────────────────────────

    private AuctionDto.ListItem toListItemWithCache(Auction a) {
        auctionLiveService.getCurrentPrice(a.getId())
                .ifPresent(a::setCurrentPrice);
        return AuctionDto.ListItem.from(a);
    }
}
