package backend.controller.auction;

import backend.dto.auction.AuctionBidBroadcast;
import backend.dto.auction.AuctionBidRequest;
import backend.entity.Auction;
import backend.entity.AuctionBid;
import backend.entity.User;
import backend.repository.AuctionBidRepository;
import backend.repository.AuctionRepository;
import backend.repository.UserRepository;
import backend.service.auction.AuctionLiveService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 실시간 경매 입찰 WebSocket 컨트롤러 (Phase 7, 5/12).
 *
 * 메시지 흐름:
 *   [client A]  ──STOMP send──> /app/auction/42/bid    (입찰 요청)
 *        │                          │
 *        │                          ▼
 *        │                  AuctionWebSocketController
 *        │                  - 경매 상태 검증
 *        │                  - 호가 검증
 *        │                  - DB 갱신 (낙관적 락 + 재시도)
 *        │                  - Redis 캐시 갱신 ⭐ Step 4
 *        │                          │
 *        │                          ▼
 *        │                  SimpMessagingTemplate.convertAndSend
 *        │                          │
 *        └──STOMP receive──< /topic/auction/42
 *
 * 동시성 (Phase 7 Step 3-B):
 *  - @Version 낙관적 락 + 재시도 1회 + REQUIRES_NEW.
 *  - OptimisticLockingFailureException catch + 10ms 백오프 후 재시도.
 *
 * Redis 캐싱 (Phase 7 Step 4):
 *  - AuctionLiveService.updateCurrentPrice() 로 입찰 성공 시 캐시 즉시 갱신.
 *  - 조회는 별도 REST API (Phase 7 후속) 에서 cache-aside 패턴 활용.
 *
 * 면접 자산:
 *  - 낙관적 락 vs 비관적 락 트레이드오프
 *  - REQUIRES_NEW 로 retry 트랜잭션 격리
 *  - Redis cache-aside + write-through 변형 (입찰 시 즉시 갱신)
 *  - @MessageMapping + SimpMessagingTemplate (수동 broadcast 유연성)
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class AuctionWebSocketController {

    private static final int MAX_RETRY = 1;

    private final AuctionRepository auctionRepository;
    private final AuctionBidRepository auctionBidRepository;
    private final UserRepository userRepository;
    private final AuctionLiveService auctionLiveService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/auction/{auctionId}/bid")
    public void handleBid(@DestinationVariable Long auctionId,
                          @Valid @Payload AuctionBidRequest request) {

        log.info("Bid received: auction={}, user={}, price={}",
                auctionId, request.getUserId(), request.getBidPrice());

        for (int attempt = 0; attempt <= MAX_RETRY; attempt++) {
            try {
                tryBid(auctionId, request);
                return;
            } catch (OptimisticLockingFailureException e) {
                if (attempt < MAX_RETRY) {
                    log.warn("Optimistic lock conflict, retrying (attempt={}, auction={}): {}",
                            attempt + 1, auctionId, e.getMessage());
                    try { Thread.sleep(10); } catch (InterruptedException ignored) {
                        Thread.currentThread().interrupt();
                    }
                } else {
                    log.error("Optimistic lock retry exhausted (auction={}): {}",
                            auctionId, e.getMessage());
                    sendRejection(auctionId, "Bid conflict, please retry");
                }
            } catch (Exception e) {
                log.error("Bid failed (auction={}): {}", auctionId, e.getMessage(), e);
                sendRejection(auctionId, "Internal error");
                return;
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    protected void tryBid(Long auctionId, AuctionBidRequest request) {

        // 1. 경매 조회
        Optional<Auction> auctionOpt = auctionRepository.findById(auctionId);
        if (auctionOpt.isEmpty()) {
            sendRejection(auctionId, "Auction not found");
            return;
        }
        Auction auction = auctionOpt.get();

        // 2. 상태 검증
        if (auction.getStatus() != Auction.Status.ACTIVE) {
            sendRejection(auctionId, "Auction is " + auction.getStatus());
            return;
        }

        // 3. 종료 시각 검증
        if (auction.getEndAt() != null && auction.getEndAt().isBefore(LocalDateTime.now(java.time.ZoneOffset.UTC))) {
            sendRejection(auctionId, "Auction has ended");
            auction.setStatus(Auction.Status.ENDED);
            auctionRepository.save(auction);
            auctionLiveService.evict(auctionId);  // 종료 시 캐시 무효화
            return;
        }

        // 4. 호가 검증
        if (request.getBidPrice() <= auction.getCurrentPrice()) {
            sendRejection(auctionId,
                    String.format("Bid must exceed current price %d", auction.getCurrentPrice()));
            return;
        }

        // 5. 사용자 조회
        Optional<User> userOpt = userRepository.findById(request.getUserId());
        if (userOpt.isEmpty()) {
            sendRejection(auctionId, "User not found");
            return;
        }
        User user = userOpt.get();

        // 6. DB 갱신 — @Version 자동 검증
        auction.setCurrentPrice(request.getBidPrice());
        auctionRepository.save(auction);

        // 7. 입찰 기록 저장
        AuctionBid bid = AuctionBid.builder()
                .auction(auction)
                .user(user)
                .bidPrice(request.getBidPrice())
                .build();
        auctionBidRepository.save(bid);

        // 8. Redis 캐시 갱신 (Phase 7 Step 4)
        auctionLiveService.updateCurrentPrice(auctionId, request.getBidPrice());

        // 9. broadcast
        AuctionBidBroadcast broadcast = AuctionBidBroadcast.builder()
                .type("BID_SUCCESS")
                .auctionId(auctionId)
                .currentPrice(request.getBidPrice())
                .bidderName(user.getName())
                .bidAt(bid.getCreatedAt() != null ? bid.getCreatedAt() : LocalDateTime.now(java.time.ZoneOffset.UTC))
                .build();

        messagingTemplate.convertAndSend("/topic/auction/" + auctionId, broadcast);
        log.info("Bid success: auction={}, newPrice={}, version={}",
                auctionId, request.getBidPrice(), auction.getVersion());
    }

    private void sendRejection(Long auctionId, String reason) {
        log.warn("Bid rejected: auction={}, reason={}", auctionId, reason);
        AuctionBidBroadcast broadcast = AuctionBidBroadcast.builder()
                .type("BID_REJECTED")
                .auctionId(auctionId)
                .reason(reason)
                .build();
        messagingTemplate.convertAndSend("/topic/auction/" + auctionId, broadcast);
    }
}
