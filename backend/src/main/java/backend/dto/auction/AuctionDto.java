package backend.dto.auction;

import backend.entity.Auction;
import backend.entity.AuctionBid;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

public class AuctionDto {

    @Getter
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ListItem {
        private Long id;
        private Long productId;
        private String productName;
        private String thumbnailUrl;
        private Integer startPrice;
        private Integer currentPrice;
        private String status;
        private String condition;
        private LocalDateTime endAt;
        private LocalDateTime createdAt;

        public static ListItem from(Auction a) {
            return ListItem.builder()
                    .id(a.getId())
                    .productId(a.getProduct() != null ? a.getProduct().getId() : null)
                    .productName(a.getProduct() != null ? a.getProduct().getName() : null)
                    .thumbnailUrl(a.getProduct() != null ? a.getProduct().getImageUrl() : null)
                    .startPrice(a.getStartPrice())
                    .currentPrice(a.getCurrentPrice())
                    .status(a.getStatus() != null ? a.getStatus().name() : null)
                    .condition(a.getCondition() != null ? a.getCondition().name() : null)
                    .endAt(a.getEndAt())
                    .createdAt(a.getCreatedAt())
                    .build();
        }
    }

    @Getter
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Detail {
        private Long id;
        private Long productId;
        private String productName;
        private String thumbnailUrl;
        private String description;
        private String itemImages;
        private Integer startPrice;
        private Integer currentPrice;
        private String status;
        private String condition;
        private LocalDateTime endAt;
        private LocalDateTime createdAt;
        private String sellerName;
        private Integer bidCount;
        private List<BidItem> recentBids;

        public static Detail from(Auction a, List<BidItem> recentBids, int totalBidCount) {
            return Detail.builder()
                    .id(a.getId())
                    .productId(a.getProduct() != null ? a.getProduct().getId() : null)
                    .productName(a.getProduct() != null ? a.getProduct().getName() : null)
                    .thumbnailUrl(a.getProduct() != null ? a.getProduct().getImageUrl() : null)
                    .description(a.getDescription())
                    .itemImages(a.getItemImages())
                    .startPrice(a.getStartPrice())
                    .currentPrice(a.getCurrentPrice())
                    .status(a.getStatus() != null ? a.getStatus().name() : null)
                    .condition(a.getCondition() != null ? a.getCondition().name() : null)
                    .endAt(a.getEndAt())
                    .createdAt(a.getCreatedAt())
                    .sellerName(a.getSeller() != null ? a.getSeller().getName() : null)
                    .bidCount(totalBidCount)
                    .recentBids(recentBids)
                    .build();
        }
    }

    @Getter
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BidItem {
        private Long id;
        private Integer bidPrice;
        private String bidderName;
        private LocalDateTime createdAt;

        public static BidItem from(AuctionBid b) {
            return BidItem.builder()
                    .id(b.getId())
                    .bidPrice(b.getBidPrice())
                    .bidderName(b.getUser() != null ? b.getUser().getName() : null)
                    .createdAt(b.getCreatedAt())
                    .build();
        }
    }
}
