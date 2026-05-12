package backend.dto.auction;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 클라이언트가 WebSocket 으로 보내는 입찰 요청 (Phase 7, 5/12).
 *
 * 클라이언트 흐름:
 *   stompClient.send('/app/auction/{auctionId}/bid', {}, JSON.stringify(payload));
 *
 * 보안 메모:
 *  - userId 는 인증 컨텍스트에서 추출해야 안전 (지금은 개발 편의로 payload 에 포함).
 *    Phase 8 시 STOMP ChannelInterceptor 에서 JWT 검증 후 Principal 로 대체 예정.
 */
@Getter
@Setter
@NoArgsConstructor
public class AuctionBidRequest {

    @NotNull(message = "userId required")
    @Min(value = 1, message = "userId must be positive")
    private Long userId;

    @NotNull(message = "bidPrice required")
    @Min(value = 1, message = "bidPrice must be positive")
    private Integer bidPrice;
}
