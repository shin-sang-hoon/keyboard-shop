package backend.controller.auction;

import backend.dto.auction.AuctionDto;
import backend.service.auction.AuctionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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

    /**
     * 경매 상세 조회.
     * Phase 7 Round 4 (5/18): 로그인 사용자면 isWatchedByMe 계산해서 응답.
     */
    @GetMapping("/{id}")
    public ResponseEntity<AuctionDto.Detail> detail(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return auctionService.getDetail(id, email)
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

    // ─── Phase 7 Round 4 (5/18) - 사회적 증명 풀스택 ───────────────

    /**
     * POST /api/auctions/{id}/view
     *
     * 페이지 진입 시 viewCount +1.
     * 인증 불필요 (비로그인 사용자도 카운트).
     *
     * @return { viewCount: 갱신된 값 } 또는 404
     */
    @PostMapping("/{id}/view")
    public ResponseEntity<Map<String, Long>> incrementView(@PathVariable Long id) {
        long newCount = auctionService.incrementViewCount(id);
        if (newCount < 0) {
            return ResponseEntity.notFound().build();
        }
        log.debug("viewCount incremented: auctionId={}, newCount={}", id, newCount);
        return ResponseEntity.ok(Map.of("viewCount", newCount));
    }

    /**
     * POST /api/auctions/{id}/watch
     *
     * 관심 등록 토글. 인증 필수.
     * - 미등록 → 추가 (watched=true, watchCount+1)
     * - 등록됨 → 삭제 (watched=false, watchCount-1)
     *
     * @return { watched: bool, watchCount: 갱신된 값 } 또는 401
     */
    @PostMapping("/{id}/watch")
    public ResponseEntity<Map<String, Object>> toggleWatch(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }
        try {
            AuctionService.ToggleResult result = auctionService.toggleWatch(userDetails.getUsername(), id);
            return ResponseEntity.ok(Map.of(
                    "watched", result.watched(),
                    "watchCount", result.watchCount()
            ));
        } catch (RuntimeException e) {
            log.warn("watch toggle failed: auctionId={}, email={}, reason={}",
                    id, userDetails.getUsername(), e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
