package backend.service.auction;

import backend.dto.auction.AuctionDto;
import backend.entity.Auction;
import backend.entity.AuctionBid;
import backend.repository.AuctionBidRepository;
import backend.repository.AuctionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    public List<AuctionDto.ListItem> listActive() {
        return auctionRepository.findByStatusOrderByEndAtAsc(Auction.Status.ACTIVE)
                .stream()
                .map(this::toListItemWithCache)
                .toList();
    }

    public Optional<AuctionDto.Detail> getDetail(Long auctionId) {
        Optional<Auction> auctionOpt = auctionRepository.findById(auctionId);
        if (auctionOpt.isEmpty()) {
            return Optional.empty();
        }
        Auction auction = auctionOpt.get();

        auctionLiveService.getCurrentPrice(auctionId)
                .ifPresent(auction::setCurrentPrice);

        List<AuctionBid> allBids = auctionBidRepository
                .findByAuctionOrderByBidPriceDesc(auction);
        int totalCount = allBids.size();
        List<AuctionDto.BidItem> recentBids = allBids.stream()
                .limit(RECENT_BIDS_LIMIT)
                .map(AuctionDto.BidItem::from)
                .toList();

        return Optional.of(AuctionDto.Detail.from(auction, recentBids, totalCount));
    }

    /**
     * 특정 상품의 ACTIVE 경매 조회 (없으면 Optional.empty).
     * 사용자 ProductDetail 페이지에서 핫딜 표시용.
     */
    @Transactional(readOnly = true)
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

    private AuctionDto.ListItem toListItemWithCache(Auction a) {
        auctionLiveService.getCurrentPrice(a.getId())
                .ifPresent(a::setCurrentPrice);
        return AuctionDto.ListItem.from(a);
    }
}
