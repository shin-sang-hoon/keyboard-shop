package backend.dto;

import backend.entity.Review;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 리뷰 DTO (5-H B2).
 *
 * 구조:
 *   - CreateRequest: orderItemId 가 product 식별 + 구매 인증 키. productId 별도 X (도출)
 *   - UpdateRequest: rating/content 만 (orderItem/user 변경 불가)
 *   - Response: from(Review) factory + verifiedPurchase 항상 true (orderItem FK 존재 = 인증)
 */
public class ReviewDto {

    /** 리뷰 작성 요청 — orderItemId 가 product 식별 + 구매 인증 키 */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateRequest {
        private Long orderItemId;
        private Double rating;       // 1.0 ~ 5.0, 0.5 단위 (Service 에서 검증)
        private String content;      // nullable
    }

    /** 리뷰 수정 요청 — rating + content 만 */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateRequest {
        private Double rating;
        private String content;
    }

    /** 리뷰 응답 — 작성자 정보 + 구매 인증 배지 */
    @Getter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Response {
        private Long id;
        private Long productId;
        private Long userId;
        private String userName;          // 작성자 표시용 (마스킹은 프론트 책임)
        private Long orderItemId;
        private Double rating;
        private String content;
        private boolean verifiedPurchase; // 항상 true (orderItem FK 존재가 인증 증거)
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public static Response from(Review review) {
            return Response.builder()
                    .id(review.getId())
                    .productId(review.getProduct().getId())
                    .userId(review.getUser().getId())
                    .userName(review.getUser().getName())
                    .orderItemId(review.getOrderItem().getId())
                    .rating(review.getRating())
                    .content(review.getContent())
                    .verifiedPurchase(true)
                    .createdAt(review.getCreatedAt())
                    .updatedAt(review.getUpdatedAt())
                    .build();
        }
    }
}
