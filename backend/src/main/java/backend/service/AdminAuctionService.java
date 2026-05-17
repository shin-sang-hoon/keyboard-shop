package backend.service;

import backend.dto.auction.AdminAuctionDtos.*;
import backend.entity.Auction;
import backend.entity.Product;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.AuctionBidRepository;
import backend.repository.AuctionRepository;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * 관리자 경매 관리 서비스.
 *
 * 핵심 책임:
 *  - 플래시 딜 등록 (상위 5% 검증 + 시작가 계산)
 *  - 일반 경매 등록 (관리자가 자체 운영 상품 등록)
 *  - 동일 상품 중복 ACTIVE 방지
 *  - 입찰자 신뢰 보호 (0건 입찰만 취소 가능)
 *
 * 옵션 A 타임존 일관성: LocalDateTime.now(ZoneOffset.UTC) 명시 (자산 #22 패턴)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuctionService {

    private final AuctionRepository auctionRepository;
    private final AuctionBidRepository auctionBidRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final FlashDealThresholdService flashDealThresholdService;

    /**
     * 플래시 딜 등록.
     * 검증: 상품 존재 + KEYBOARD + ACTIVE + 가격 ≥ 상위 5% 임계값 + 중복 ACTIVE 없음.
     */
    @Transactional
    public AuctionResponse createFlashDeal(CreateFlashDealRequest req, String adminEmail) {
        // 1. 상품 존재 검증
        Product product = productRepository.findById(req.getProductId())
                .orElseThrow(() -> BusinessException.notFound("상품을 찾을 수 없습니다: " + req.getProductId()));

        // 2. KEYBOARD + ACTIVE 만 등록 가능
        if (product.getProductType() != Product.ProductType.KEYBOARD) {
            throw BusinessException.badRequest("플래시 딜은 KEYBOARD 타입 상품만 등록 가능합니다");
        }
        if (product.getStatus() != Product.ProductStatus.ACTIVE) {
            throw BusinessException.badRequest("ACTIVE 상태 상품만 등록 가능합니다");
        }

        // 3. 상위 5% 임계값 검증 (동적 계산)
        int threshold = flashDealThresholdService.getThreshold();
        if (product.getPrice() < threshold) {
            throw BusinessException.badRequest(String.format(
                    "플래시 딜은 상위 5%% 고가 키보드 (≥%,d원) 만 가능합니다. 현재 상품 가격: %,d원",
                    threshold, product.getPrice()));
        }

        // 4. 동일 상품 중복 ACTIVE/SCHEDULED 방지 (V10 SCHEDULED 추가)
        List<Auction> existing = auctionRepository.findByProductIdAndStatusIn(
                product.getId(),
                List.of(Auction.Status.ACTIVE, Auction.Status.SCHEDULED));
        if (!existing.isEmpty()) {
            throw BusinessException.conflict(String.format(
                    "이미 진행 중이거나 예약된 경매가 있습니다 (auctionId=%d, status=%s)",
                    existing.get(0).getId(), existing.get(0).getStatus()));
        }

        // 5. 관리자 조회 (seller = 관리자, 자체 운영)
        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> BusinessException.notFound("관리자 정보 없음: " + adminEmail));

        // 6. 시작가 계산 + 종료시각 계산
        int startPrice = product.getPrice() * req.getStartPricePercent() / 100;
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime endAt = now.plusHours(req.getDurationHours());

        // 7. 경매 생성
        Auction auction = Auction.builder()
                .product(product)
                .seller(admin)
                .startPrice(startPrice)
                .currentPrice(startPrice)
                .status(Auction.Status.ACTIVE)
                .condition(req.getCondition() != null ? req.getCondition() : Auction.Condition.NEW)
                .description(req.getDescription())
                .endAt(endAt)
                .isFlashDeal(true)
                .startPricePercent(req.getStartPricePercent())
                .durationHours(req.getDurationHours())
                .build();

        Auction saved = auctionRepository.save(auction);

        log.info("Flash deal created: auctionId={}, productId={}, startPrice={} ({}% of {}), endAt={}",
                saved.getId(), product.getId(), startPrice, req.getStartPricePercent(),
                product.getPrice(), endAt);

        return toResponse(saved, 0);
    }

    /**
     * 일반 경매 등록 (관리자 자체 운영 상품).
     */
    @Transactional
    public AuctionResponse createNormalAuction(CreateNormalAuctionRequest req, String adminEmail) {
        Product product = productRepository.findById(req.getProductId())
                .orElseThrow(() -> BusinessException.notFound("상품을 찾을 수 없습니다"));

        if (product.getStatus() != Product.ProductStatus.ACTIVE) {
            throw BusinessException.badRequest("ACTIVE 상태 상품만 등록 가능합니다");
        }

        List<Auction> existingNormal = auctionRepository.findByProductIdAndStatusIn(
                product.getId(),
                List.of(Auction.Status.ACTIVE, Auction.Status.SCHEDULED));
        if (!existingNormal.isEmpty()) {
            throw BusinessException.conflict("이미 진행 중이거나 예약된 경매가 있습니다");
        }

        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> BusinessException.notFound("관리자 정보 없음"));

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        LocalDateTime endAt = now.plusHours(req.getDurationHours());

        Auction auction = Auction.builder()
                .product(product)
                .seller(admin)
                .startPrice(req.getStartPrice())
                .currentPrice(req.getStartPrice())
                .status(Auction.Status.ACTIVE)
                .condition(req.getCondition())
                .description(req.getDescription())
                .endAt(endAt)
                .isFlashDeal(false)
                .durationHours(req.getDurationHours())
                .build();

        Auction saved = auctionRepository.save(auction);
        log.info("Normal auction created: auctionId={}, startPrice={}, endAt={}",
                saved.getId(), req.getStartPrice(), endAt);
        return toResponse(saved, 0);
    }

    /**
     * 플래시 딜 목록 조회 (관리자 대시보드).
     */
    @Transactional(readOnly = true)
    public List<AuctionResponse> listFlashDeals() {
        return auctionRepository.findByIsFlashDealTrueOrderByStatusAscEndAtAsc()
                .stream()
                .map(a -> toResponse(a, countBids(a.getId())))
                .toList();
    }

    /**
     * 경매 취소 (입찰 0건만 가능).
     */
    @Transactional
    public void cancelAuction(Long auctionId, String adminEmail) {
        Auction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> BusinessException.notFound("경매를 찾을 수 없습니다"));

        // ACTIVE + SCHEDULED 둘 다 허용 (SCHEDULED 는 시작 전이라 입찰 0건 보장).
        // 5/17 fix — SCHEDULED 경매 취소 가능 정책 추가.
        if (auction.getStatus() != Auction.Status.ACTIVE
                && auction.getStatus() != Auction.Status.SCHEDULED) {
            throw BusinessException.badRequest("진행 중이거나 예약된 경매만 취소 가능합니다");
        }

        int bidCount = countBids(auctionId);
        if (bidCount > 0) {
            throw BusinessException.conflict(String.format(
                    "이미 %d건의 입찰이 있어 취소할 수 없습니다 (입찰자 신뢰 보호)", bidCount));
        }

        auction.setStatus(Auction.Status.CANCELLED);
        log.info("Auction cancelled by admin: auctionId={}, admin={}", auctionId, adminEmail);
    }

    // ─── 내부 헬퍼 ─────────────────────────────────────────

    private int countBids(Long auctionId) {
        // 효율적 COUNT(*) 쿼리 — Repository 메서드 활용 (자산 #5 N+1 방어 일관성)
        return (int) auctionBidRepository.countByAuctionId(auctionId);
    }

    private AuctionResponse toResponse(Auction a, int bidCount) {
        Product p = a.getProduct();
        return AuctionResponse.builder()
                .id(a.getId())
                .productId(p != null ? p.getId() : null)
                .productName(p != null ? p.getName() : null)
                .productPrice(p != null ? p.getPrice() : null)
                .productImageUrl(p != null ? p.getImageUrl() : null)
                .sellerId(a.getSeller() != null ? a.getSeller().getId() : null)
                .sellerName(a.getSeller() != null ? a.getSeller().getName() : null)
                .startPrice(a.getStartPrice())
                .currentPrice(a.getCurrentPrice())
                .status(a.getStatus())
                .condition(a.getCondition())
                .isFlashDeal(a.getIsFlashDeal())
                .startPricePercent(a.getStartPricePercent())
                .durationHours(a.getDurationHours())
                .endAt(a.getEndAt())
                .createdAt(a.getCreatedAt())
                .version(a.getVersion())
                .bidCount(bidCount)
                .description(a.getDescription())  // 자산 #27 - 5/17 fix
                .startAt(a.getStartAt())          // 자산 #27 - 5/17 fix (SCHEDULED 만 NOT NULL)
                .build();
    }

    // ─── SCHEDULED 확장 (V10, 5/17) ──────────────────────────────────

    /**
     * 예약 플래시 딜 등록 (관리자 미래 시작 시각 설정).
     *
     * 검증: 기본 createFlashDeal 동일 + startAt 미래 시각 강제.
     * status=SCHEDULED 로 저장 → AuctionScheduler 가 startAt 도달 시 ACTIVE 전환.
     */
    @Transactional
    public AuctionResponse createScheduledFlashDeal(CreateScheduledFlashDealRequest req, String adminEmail) {
        Product product = productRepository.findById(req.getProductId())
                .orElseThrow(() -> BusinessException.notFound("상품을 찾을 수 없습니다"));

        if (product.getProductType() != Product.ProductType.KEYBOARD) {
            throw BusinessException.badRequest("플래시 딜은 KEYBOARD 타입 상품만 가능합니다");
        }
        if (product.getStatus() != Product.ProductStatus.ACTIVE) {
            throw BusinessException.badRequest("ACTIVE 상태 상품만 등록 가능합니다");
        }

        int threshold = flashDealThresholdService.getThreshold();
        if (product.getPrice() < threshold) {
            throw BusinessException.badRequest(String.format(
                    "플래시 딜은 상위 N%% 고가 키보드 (≥%,d원) 만 가능합니다. 현재: %,d원",
                    threshold, product.getPrice()));
        }

        // 중복 ACTIVE/SCHEDULED 방지
        List<Auction> existing = auctionRepository.findByProductIdAndStatusIn(
                product.getId(),
                List.of(Auction.Status.ACTIVE, Auction.Status.SCHEDULED));
        if (!existing.isEmpty()) {
            throw BusinessException.conflict(String.format(
                    "이미 진행 중이거나 예약된 경매가 있습니다 (auctionId=%d)",
                    existing.get(0).getId()));
        }

        // startAt 미래 시각 강제 (UTC 일관성)
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        if (req.getStartAt() == null || req.getStartAt().isBefore(now)) {
            throw BusinessException.badRequest("startAt 은 현재 시각보다 미래여야 합니다");
        }

        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> BusinessException.notFound("관리자 정보 없음"));

        int startPrice = product.getPrice() * req.getStartPricePercent() / 100;
        LocalDateTime endAt = req.getStartAt().plusHours(req.getDurationHours());

        Auction auction = Auction.builder()
                .product(product)
                .seller(admin)
                .startPrice(startPrice)
                .currentPrice(startPrice)
                .status(Auction.Status.SCHEDULED)
                .condition(req.getCondition() != null ? req.getCondition() : Auction.Condition.NEW)
                .description(req.getDescription())
                .startAt(req.getStartAt())
                .endAt(endAt)
                .isFlashDeal(true)
                .startPricePercent(req.getStartPricePercent())
                .durationHours(req.getDurationHours())
                .build();

        Auction saved = auctionRepository.save(auction);
        log.info("Scheduled flash deal created: auctionId={}, productId={}, startPrice={} ({}%), startAt={}, endAt={}",
                saved.getId(), product.getId(), startPrice, req.getStartPricePercent(),
                req.getStartAt(), endAt);
        return toResponse(saved, 0);
    }

    /**
     * 예약 경매 수정 (SCHEDULED 상태만).
     * ACTIVE 진입 후엔 수정 불가 (입찰자 신뢰 보호).
     */
    @Transactional
    public AuctionResponse updateScheduledAuction(Long auctionId, UpdateScheduledAuctionRequest req, String adminEmail) {
        Auction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> BusinessException.notFound("경매를 찾을 수 없습니다"));

        if (auction.getStatus() != Auction.Status.SCHEDULED) {
            throw BusinessException.badRequest("SCHEDULED 상태 경매만 수정 가능합니다");
        }

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        // startAt 수정 (있으면)
        if (req.getStartAt() != null) {
            if (req.getStartAt().isBefore(now)) {
                throw BusinessException.badRequest("startAt 은 미래여야 합니다");
            }
            auction.setStartAt(req.getStartAt());
            // endAt 재계산
            int duration = req.getDurationHours() != null ? req.getDurationHours() : auction.getDurationHours();
            auction.setEndAt(req.getStartAt().plusHours(duration));
        }

        if (req.getDurationHours() != null) {
            auction.setDurationHours(req.getDurationHours());
            // startAt 기준으로 endAt 재계산
            auction.setEndAt(auction.getStartAt().plusHours(req.getDurationHours()));
        }

        if (req.getStartPricePercent() != null) {
            auction.setStartPricePercent(req.getStartPricePercent());
            int newStartPrice = auction.getProduct().getPrice() * req.getStartPricePercent() / 100;
            auction.setStartPrice(newStartPrice);
            auction.setCurrentPrice(newStartPrice);
        }

        if (req.getDescription() != null) {
            auction.setDescription(req.getDescription());
        }

        log.info("Scheduled auction updated: auctionId={}, admin={}", auctionId, adminEmail);
        return toResponse(auction, 0);
    }

    /**
     * 진행 중 경매 강제 종료 (관리자 권한).
     * 입찰 있어도 즉시 ENDED 전환. 최고가 입찰자 낙찰 처리.
     */
    @Transactional
    public AuctionResponse forceEndAuction(Long auctionId, String adminEmail) {
        Auction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> BusinessException.notFound("경매를 찾을 수 없습니다"));

        if (auction.getStatus() != Auction.Status.ACTIVE) {
            throw BusinessException.badRequest(String.format(
                    "ACTIVE 상태 경매만 강제 종료 가능합니다 (현재: %s)", auction.getStatus()));
        }

        auction.setStatus(Auction.Status.ENDED);
        auction.setEndAt(LocalDateTime.now(ZoneOffset.UTC));  // 종료 시각 갱신

        int bidCount = countBids(auctionId);
        log.warn("Auction force-ended by admin: auctionId={}, admin={}, bidCount={}, finalPrice={}",
                auctionId, adminEmail, bidCount, auction.getCurrentPrice());

        return toResponse(auction, bidCount);
    }

    /**
     * SCHEDULED 또는 ACTIVE 다중 상태 조회 (탭 필터).
     */
    @Transactional(readOnly = true)
    public List<AuctionResponse> listFlashDealsByStatuses(List<Auction.Status> statuses) {
        return auctionRepository.findByIsFlashDealAndStatusInOrderByCreatedAtDesc(true, statuses)
                .stream()
                .map(a -> toResponse(a, countBids(a.getId())))
                .toList();
    }
}