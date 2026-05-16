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

    @GetMapping("/{id}/bids")
    public ResponseEntity<List<AuctionDto.BidItem>> bids(
            @PathVariable Long id,
            @RequestParam(defaultValue = "50") int limit) {
        List<AuctionDto.BidItem> bids = auctionService.listBids(id, limit);
        return ResponseEntity.ok(bids);
    }
}
