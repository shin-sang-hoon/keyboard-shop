package backend.dto;

import backend.entity.Review;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 리뷰 DTO (5-H B2, R10 판매자 답글 노출).
 *
 * 구조:
 *   - CreateRequest: orderItemId 가 product 식별 + 구매 인증 키. productId 별도 X (도출)
 *   - UpdateRequest: rating/content 만 (orderItem/user 변경 불가)
 *   - Response: from(Review) factory + verifiedPurchase 항상 true (orderItem FK 존재 = 인증)
 *               + R10 판매자 답글(reply/repliedByName/repliedAt) — 답글 있을 때만 채워짐
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

    /**
     * 리뷰 응답 — 작성자 정보 + 구매 인증 배지 + R10 판매자 답글.
     *
     * 판매자 답글:
     *   - reply == null  → 미답변. 프론트(ReviewList)는 "판매자 답변" 블록을 렌더하지 않음.
     *   - reply != null  → "판매자 답변 — {repliedByName}" 블록 노출.
     *   repliedByName 은 답변 관리자의 displayName (이름(닉네임)) — repliedBy 계정 삭제 시 null 가능.
     */
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
        // ── R10 판매자 답글 (없으면 전부 null) ──
        private String reply;             // 답글 본문, null = 미답변
        private String repliedByName;     // 답변 관리자 displayName, null = 미답변 or 계정삭제
        private LocalDateTime repliedAt;  // 답변 시각, null = 미답변
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
                    .reply(review.getReply())
                    .repliedByName(
                            review.getRepliedBy() != null
                                    ? review.getRepliedBy().displayName()
                                    : null)
                    .repliedAt(review.getRepliedAt())
                    .createdAt(review.getCreatedAt())
                    .updatedAt(review.getUpdatedAt())
                    .build();
        }
    }
}
