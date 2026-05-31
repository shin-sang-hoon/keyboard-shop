package backend.dto;

import backend.entity.Review;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 리뷰 DTO (5-H B2, R10 판매자 답글 노출, 마이페이지 MyReviewItem).
 *
 * 구조:
 *   - CreateRequest: orderItemId 가 product 식별 + 구매 인증 키. productId 별도 X (도출)
 *   - UpdateRequest: rating/content 만 (orderItem/user 변경 불가)
 *   - Response: from(Review) factory + verifiedPurchase 항상 true (orderItem FK 존재 = 인증)
 *               + R10 판매자 답글(reply/repliedByName/repliedAt) — 답글 있을 때만 채워짐
 *   - MyReviewItem: 마이페이지 "작성한 리뷰" 카드용. 상품명/이미지 포함 (어느 상품 리뷰인지 표시).
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

    /**
     * 마이페이지 "작성한 리뷰" 카드 — 상품 컨텍스트 포함.
     *
     * Response 와 별도 DTO 인 이유:
     *   - Response 는 "상품 상세 안의 리뷰" 라 상품 정보가 불필요(이미 그 상품 페이지).
     *   - 마이페이지는 여러 상품에 걸친 내 리뷰 목록이라 "어느 상품인지"(이름·이미지)가 필수.
     *   - Response 에 productName/imageUrl 을 넣으면 findByProductId 등 다른 경로에서도
     *     product.getName()/getImageUrl() 을 타게 되는데, 그 경로들은 product 를 fetch 안 할 수
     *     있어 LAZY 위험. 마이페이지 전용 DTO 로 분리해 from() 호출 시점(fetch 된 상태)을 보장.
     *
     * 필드:
     *   - reviewId/productId: 네비게이션(상품 페이지로 이동) + 수정·삭제 호출 키
     *   - productName/productImageUrl: 카드 표시
     *   - rating/content: 리뷰 본문
     *   - hidden: true 면 "관리자에 의해 숨김" 안내 배지 (본인은 보이되 비공개 상태임을 알림)
     *   - hasReply/reply/repliedByName: 판매자 답변이 달렸으면 카드에 함께 노출
     *   - createdAt/updatedAt: 작성·수정 시각
     */
    @Getter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class MyReviewItem {
        private Long reviewId;
        private Long productId;
        private String productName;
        private String productImageUrl;
        private Double rating;
        private String content;
        private boolean hidden;           // 관리자 숨김 여부 (본인 목록엔 보이되 비공개 표시)
        private boolean hasReply;         // 판매자 답변 존재 여부
        private String reply;             // 판매자 답변 본문 (없으면 null)
        private String repliedByName;     // 답변 관리자 displayName (없으면 null)
        private LocalDateTime repliedAt;  // 답변 시각 (없으면 null)
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public static MyReviewItem from(Review review) {
            return MyReviewItem.builder()
                    .reviewId(review.getId())
                    .productId(review.getProduct().getId())
                    .productName(review.getProduct().getName())
                    .productImageUrl(review.getProduct().getImageUrl())
                    .rating(review.getRating())
                    .content(review.getContent())
                    .hidden(Boolean.TRUE.equals(review.getHidden()))
                    .hasReply(review.hasReply())
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
