package backend.service;

import backend.entity.Auction;
import backend.repository.AuctionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * 경매 상태 자동 전환 스케줄러 (V10, 5/17).
 *
 * 두 가지 작업:
 *  (1) SCHEDULED → ACTIVE: startAt 도달 시 자동 전환
 *  (2) ACTIVE → ENDED: endAt 지나면 자동 종료
 *
 * 주기: 매 1분 (fixedRate=60000ms).
 *
 * 면접 자산:
 *  - Spring @Scheduled — 별도 Quartz 없이 단순 cron 패턴
 *  - @Transactional — 상태 전환 원자성 보장
 *  - 옵션 A 타임존 일관성: LocalDateTime.now(ZoneOffset.UTC) 명시
 *
 * 향후 개선 (Phase 8):
 *  - 분산 환경 대비 leader election (ShedLock 등)
 *  - WebSocket broadcast 로 클라이언트에 상태 변경 알림
 *  - 자연 종료 시 낙찰 처리 + 알림 발송
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuctionScheduler {

    private final AuctionRepository auctionRepository;

    /**
     * SCHEDULED 중 startAt 도달한 경매 → ACTIVE 전환.
     *
     * 1분 주기로 체크. 사용자 입장에선 최대 1분 지연 발생 가능 (수용 가능).
     * 더 정밀한 타이밍 필요 시 Quartz cron 또는 fixedRate 단축.
     */
    @Scheduled(fixedRate = 60_000)
    @Transactional
    public void activateScheduledAuctions() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        List<Auction> dueScheduled = auctionRepository.findByStatusAndStartAtLessThanEqual(
                Auction.Status.SCHEDULED, now);

        if (dueScheduled.isEmpty()) {
            return; // 조용히 종료 (정상 동작)
        }

        for (Auction auction : dueScheduled) {
            auction.setStatus(Auction.Status.ACTIVE);
            // endAt 재계산 (혹시 수정으로 변경됐을 가능성 대비)
            auction.setEndAt(auction.getStartAt().plusHours(auction.getDurationHours()));
            log.info("Auction auto-activated: id={}, productId={}, startAt={}, endAt={}",
                    auction.getId(),
                    auction.getProduct() != null ? auction.getProduct().getId() : null,
                    auction.getStartAt(), auction.getEndAt());
        }
        log.info("Auto-activation batch complete: {} auctions activated", dueScheduled.size());
    }

    /**
     * ACTIVE 중 endAt 지난 경매 → ENDED 자동 종료.
     * 입찰 있으면 최고가 낙찰 (currentPrice 가 최종 낙찰가).
     */
    @Scheduled(fixedRate = 60_000)
    @Transactional
    public void endExpiredAuctions() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        List<Auction> expired = auctionRepository.findByStatusAndEndAtLessThanEqual(
                Auction.Status.ACTIVE, now);

        if (expired.isEmpty()) {
            return;
        }

        for (Auction auction : expired) {
            auction.setStatus(Auction.Status.ENDED);
            log.info("Auction auto-ended: id={}, finalPrice={}",
                    auction.getId(), auction.getCurrentPrice());
        }
        log.info("Auto-end batch complete: {} auctions ended", expired.size());
    }
}
