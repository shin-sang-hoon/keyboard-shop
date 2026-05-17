package backend.controller.auction;

import backend.dto.auction.AuctionDto;
import backend.service.auction.AuctionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/auctions")
@RequiredArgsConstructor
public class AuctionController {

    private final AuctionService auctionService;

    @GetMapping
    public ResponseEntity<List<AuctionDto.ListItem>> list() {
        List<AuctionDto.ListItem> items = auctionService.listActive();
        log.debug("Auction list returned: count={}", items.size());
        return ResponseEntity.ok(items);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AuctionDto.Detail> detail(@PathVariable Long id) {
        return auctionService.getDetail(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * GET /api/auctions/active/by-product/{productId}
     *
     * 특정 상품의 진행 중인 (ACTIVE) 경매 조회. 없으면 204 No Content.
     * ProductDetail 페이지에서 핫딜 활성 여부 확인용.
     *
     * 면접 자산: 도메인 경계 분리 (Product/Auction) + RESTful 자원 책임 분리
     *           + N+1 회귀 방지 (ProductDto LEFT JOIN 회피)
     */
    @GetMapping("/active/by-product/{productId}")
    public ResponseEntity<AuctionDto.Detail> activeByProduct(@PathVariable Long productId) {
        return auctionService.findActiveByProductId(productId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}/bids")
    public ResponseEntity<List<AuctionDto.BidItem>> bids(
            @PathVariable Long id,
            @RequestParam(defaultValue = "50") int limit) {
        List<AuctionDto.BidItem> bids = auctionService.listBids(id, limit);
        return ResponseEntity.ok(bids);
    }
}
