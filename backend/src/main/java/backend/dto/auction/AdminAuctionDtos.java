package backend.dto.auction;

import backend.entity.Auction;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 관리자 경매 관리 DTO 컨테이너.
 * Flash Deal 등록/조회/취소용 Request & Response.
 */
public class AdminAuctionDtos {

    /**
     * 플래시 딜 등록 요청.
     * 시작가 = product.price * (startPricePercent / 100)
     * 종료시각 = now + durationHours
     */
    @Getter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateFlashDealRequest {
        @NotNull(message = "productId 는 필수입니다")
        private Long productId;

        @NotNull(message = "startPricePercent 는 필수입니다")
        @Min(value = 30, message = "시작가 비율은 30% 이상이어야 합니다")
        @Max(value = 70, message = "시작가 비율은 70% 이하여야 합니다")
        private Integer startPricePercent;

        @NotNull(message = "durationHours 는 필수입니다")
        @Min(value = 1, message = "지속 시간은 최소 1시간")
        @Max(value = 168, message = "지속 시간은 최대 7일(168h)")
        private Integer durationHours;

        @Size(max = 1000, message = "설명은 1000자 이내")
        private String description;

        private Auction.Condition condition;  // 신상품 등록 시 NEW 기본
    }

    /**
     * 일반 경매 등록 요청 (사용자가 본인 키보드 경매 등록).
     * 5/17 시점엔 관리자 단독 사용 가능. 향후 사용자 self-serve 확장.
     */
    @Getter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateNormalAuctionRequest {
        @NotNull
        private Long productId;

        @NotNull @Min(1000)
        private Integer startPrice;

        @NotNull @Min(1) @Max(168)
        private Integer durationHours;

        @Size(max = 1000)
        private String description;

        @NotNull
        private Auction.Condition condition;
    }

    /**
     * 플래시 딜 상세 응답.
     */
    @Getter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AuctionResponse {
        private Long id;
        private Long productId;
        private String productName;
        private Integer productPrice;        // 정가 (참고용)
        private String productImageUrl;
        private Long sellerId;
        private String sellerName;
        private Integer startPrice;
        private Integer currentPrice;
        private Auction.Status status;
        private Auction.Condition condition;
        private Boolean isFlashDeal;
        private Integer startPricePercent;
        private Integer durationHours;
        private LocalDateTime startAt;       // SCHEDULED 만 NOT NULL
        private LocalDateTime endAt;
        private LocalDateTime createdAt;
        private Long version;
        private Integer bidCount;             // 입찰 건수 (취소 가능 여부 판단)
        private String description;           // 플래시 딜 설명 (자산 #27 - 5/17 수정)
    }

    /**
     * 임계값 조회 응답 (관리자 UI 가 등록 폼에서 사용).
     */
    @Getter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class FlashDealThresholdResponse {
        private Integer threshold;        // 예: 529,000
        private Integer topPercent;       // 예: 5
        private Integer totalKeyboards;   // 예: 104
        private String formula;           // 예: "Top 5% of 104 active keyboards"
    }

    /**
     * 예약 플래시 딜 등록 요청 (V10, 5/17).
     * createFlashDeal 과 동일하지만 startAt 추가 (필수).
     */
    @Getter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateScheduledFlashDealRequest {
        @NotNull
        private Long productId;

        @NotNull @Min(30) @Max(70)
        private Integer startPricePercent;

        @NotNull @Min(1) @Max(168)
        private Integer durationHours;

        /**
         * 예약 시작 시각 (UTC).
         * Service 가 isBefore(now(UTC)) 로 미래 시각 검증.
         */
        @NotNull
        private LocalDateTime startAt;

        @Size(max = 1000)
        private String description;

        private Auction.Condition condition;
    }

    /**
     * 예약 경매 수정 요청 (SCHEDULED 만 수정 가능).
     * 모든 필드 nullable — null 인 필드는 변경 안 함.
     */
    @Getter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateScheduledAuctionRequest {
        private LocalDateTime startAt;

        @Min(1) @Max(168)
        private Integer durationHours;

        @Min(30) @Max(70)
        private Integer startPricePercent;

        @Size(max = 1000)
        private String description;
    }
}