package backend.dto.auction;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 서버가 STOMP /topic/auction/{auctionId} 로 브로드캐스트하는 입찰 알림 (Phase 7, 5/12).
 *
 * 구독자 흐름:
 *   stompClient.subscribe('/topic/auction/{auctionId}', msg => {
 *       const data = JSON.parse(msg.body);  // AuctionBidBroadcast
 *       updateCurrentPriceUI(data.currentPrice);
 *       appendBidHistory(data);
 *   });
 *
 * type 필드 활용:
 *  - "BID_SUCCESS": 정상 입찰 (currentPrice, bidder 채워짐)
 *  - "BID_REJECTED": 입찰 실패 (reason 채워짐)
 *  - "AUCTION_ENDED": 경매 종료 알림 (winnerName 채워짐)
 *
 * 클라이언트는 type 에 따라 UI 분기. 한 채널로 다양한 이벤트 전송 가능.
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuctionBidBroadcast {

    /** 메시지 종류 — BID_SUCCESS / BID_REJECTED / AUCTION_ENDED */
    private String type;

    /** 경매 ID (편의용 — 토픽으로도 알 수 있지만 명시) */
    private Long auctionId;

    /** 현재가 (BID_SUCCESS 시) */
    private Integer currentPrice;

    /** 입찰자 이름 (BID_SUCCESS 시 — 익명화 표시는 프론트에서) */
    private String bidderName;

    /** 입찰 시각 (BID_SUCCESS 시) */
    private LocalDateTime bidAt;

    /** 거절 사유 (BID_REJECTED 시 — "낮은 가격", "경매 종료" 등) */
    private String reason;

    /** 낙찰자 이름 (AUCTION_ENDED 시) */
    private String winnerName;
}
