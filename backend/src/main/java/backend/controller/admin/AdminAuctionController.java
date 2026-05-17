package backend.controller.admin;

import backend.dto.auction.AdminAuctionDtos.*;
import backend.service.AdminAuctionService;
import backend.service.FlashDealThresholdService;
import backend.repository.ProductRepository;
import backend.entity.Product;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 관리자 경매 관리 REST 컨트롤러.
 *
 * 엔드포인트 6개:
 *  - GET    /api/admin/flash-deal/threshold       — 동적 임계값 조회
 *  - POST   /api/admin/flash-deal/threshold/refresh — 캐시 강제 갱신
 *  - POST   /api/admin/auctions/flash-deal        — 플래시 딜 등록
 *  - POST   /api/admin/auctions/normal           — 일반 경매 등록
 *  - GET    /api/admin/auctions/flash-deals      — 플래시 딜 전체 조회
 *  - DELETE /api/admin/auctions/{id}             — 경매 취소
 *
 * 모든 endpoint hasRole('ADMIN') 가드.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAuctionController {

    private final AdminAuctionService adminAuctionService;
    private final FlashDealThresholdService flashDealThresholdService;
    private final ProductRepository productRepository;

    @Value("${flashdeal.top-percent:5}")
    private int topPercent;

    // ─── 동적 임계값 ──────────────────────────────────────

    @GetMapping("/flash-deal/threshold")
    public ResponseEntity<FlashDealThresholdResponse> getThreshold() {
        int threshold = flashDealThresholdService.getThreshold();
        int total = (int) productRepository.findAll().stream()
                .filter(p -> p.getProductType() == Product.ProductType.KEYBOARD
                        && p.getStatus() == Product.ProductStatus.ACTIVE)
                .count();
        return ResponseEntity.ok(FlashDealThresholdResponse.builder()
                .threshold(threshold)
                .topPercent(topPercent)
                .totalKeyboards(total)
                .formula(String.format("Top %d%% of %d active keyboards", topPercent, total))
                .build());
    }

    @PostMapping("/flash-deal/threshold/refresh")
    public ResponseEntity<FlashDealThresholdResponse> refreshThreshold() {
        int threshold = flashDealThresholdService.refresh();
        int total = (int) productRepository.findAll().stream()
                .filter(p -> p.getProductType() == Product.ProductType.KEYBOARD
                        && p.getStatus() == Product.ProductStatus.ACTIVE)
                .count();
        log.info("Flash deal threshold manually refreshed: {}원", threshold);
        return ResponseEntity.ok(FlashDealThresholdResponse.builder()
                .threshold(threshold)
                .topPercent(topPercent)
                .totalKeyboards(total)
                .formula(String.format("Top %d%% of %d (refreshed)", topPercent, total))
                .build());
    }

    // ─── 경매 등록 ───────────────────────────────────────

    @PostMapping("/auctions/flash-deal")
    public ResponseEntity<AuctionResponse> createFlashDeal(
            @Valid @RequestBody CreateFlashDealRequest req,
            @AuthenticationPrincipal UserDetails admin) {
        AuctionResponse result = adminAuctionService.createFlashDeal(req, admin.getUsername());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/auctions/normal")
    public ResponseEntity<AuctionResponse> createNormalAuction(
            @Valid @RequestBody CreateNormalAuctionRequest req,
            @AuthenticationPrincipal UserDetails admin) {
        AuctionResponse result = adminAuctionService.createNormalAuction(req, admin.getUsername());
        return ResponseEntity.ok(result);
    }

    // ─── 경매 조회/취소 ───────────────────────────────────

    @GetMapping("/auctions/flash-deals")
    public ResponseEntity<List<AuctionResponse>> listFlashDeals() {
        return ResponseEntity.ok(adminAuctionService.listFlashDeals());
    }

    @DeleteMapping("/auctions/{id}")
    public ResponseEntity<Void> cancelAuction(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails admin) {
        adminAuctionService.cancelAuction(id, admin.getUsername());
        return ResponseEntity.noContent().build();
    }

    // ─── SCHEDULED 확장 (V10, 5/17) ──────────────────────────────────

    /**
     * 예약 플래시 딜 등록.
     * POST /api/admin/auctions/flash-deal/scheduled
     */
    @PostMapping("/auctions/flash-deal/scheduled")
    public ResponseEntity<AuctionResponse> createScheduledFlashDeal(
            @Valid @RequestBody CreateScheduledFlashDealRequest req,
            @AuthenticationPrincipal UserDetails admin) {
        return ResponseEntity.ok(
                adminAuctionService.createScheduledFlashDeal(req, admin.getUsername()));
    }

    /**
     * 예약 경매 수정 (SCHEDULED 만).
     * PATCH /api/admin/auctions/{id}
     */
    @PatchMapping("/auctions/{id}")
    public ResponseEntity<AuctionResponse> updateScheduledAuction(
            @PathVariable Long id,
            @Valid @RequestBody UpdateScheduledAuctionRequest req,
            @AuthenticationPrincipal UserDetails admin) {
        return ResponseEntity.ok(
                adminAuctionService.updateScheduledAuction(id, req, admin.getUsername()));
    }

    /**
     * 진행 중 경매 강제 종료.
     * POST /api/admin/auctions/{id}/force-end
     */
    @PostMapping("/auctions/{id}/force-end")
    public ResponseEntity<AuctionResponse> forceEndAuction(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails admin) {
        return ResponseEntity.ok(
                adminAuctionService.forceEndAuction(id, admin.getUsername()));
    }

    /**
     * 다중 상태 필터 조회 (탭: 진행중 / 대기 / 완료).
     * GET /api/admin/auctions/flash-deals?statuses=ACTIVE,SCHEDULED
     */
    @GetMapping("/auctions/flash-deals/by-statuses")
    public ResponseEntity<List<AuctionResponse>> listByStatuses(
            @RequestParam(name = "statuses") List<backend.entity.Auction.Status> statuses) {
        return ResponseEntity.ok(adminAuctionService.listFlashDealsByStatuses(statuses));
    }
}