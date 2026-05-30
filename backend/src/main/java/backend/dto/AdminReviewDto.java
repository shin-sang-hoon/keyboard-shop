package backend.dto;

import backend.entity.Review;
import backend.entity.ReviewReport;

import java.time.LocalDateTime;

/**
 * 관리자 리뷰·신고 운영 DTO (7-G R8, R10 답글).
 *
 *  - ListItem          : 리뷰 목록 한 행 (숨김 포함 + R10 답글 정보)
 *  - VisibilityRequest : 숨김/복원 요청 바디
 *  - ReplyRequest      : 답글 작성·수정 요청 바디 (R10)
 *  - ReportItem        : 신고 큐 한 행 (신고 정보 + 신고된 리뷰 정보)
 *
 * 사용자 측 신고 등록 DTO 는 ReviewReportDto 에 별도 정의.
 */
public class AdminReviewDto {

    private AdminReviewDto() {
    }

    /**
     * 관리자 리뷰 목록 항목.
     * 공개 페이지와 달리 hidden 리뷰도 포함하며 hidden 플래그를 그대로 노출.
     *
     * R10 — 답글 정보 추가:
     *   - reply          : 답글 본문 (null = 미답변)
     *   - repliedByName  : 답변 관리자 displayName (null = 미답변 or 계정삭제)
     *   - repliedAt      : 답변 시각 (null = 미답변)
     *   AdminReviewQnaPage 의 답글 작성/수정 UI, 마이페이지 "내가 답변한 리뷰" 탭이 함께 사용.
     */
    public record ListItem(
            Long id,
            Long productId,
            String productName,
            String userName,
            Double rating,
            String content,
            boolean hidden,
            // ── R10 답글 ──
            String reply,
            String repliedByName,
            LocalDateTime repliedAt,
            LocalDateTime createdAt
    ) {
        public static ListItem from(Review r) {
            return new ListItem(
                    r.getId(),
                    r.getProduct().getId(),
                    r.getProduct().getName(),
                    r.getUser().getName(),
                    r.getRating(),
                    r.getContent(),
                    Boolean.TRUE.equals(r.getHidden()),
                    r.getReply(),
                    r.getRepliedBy() != null ? r.getRepliedBy().displayName() : null,
                    r.getRepliedAt(),
                    r.getCreatedAt()
            );
        }
    }

    /** 리뷰 숨김/복원 요청 — PATCH /api/admin/reviews/{id}/visibility 바디 */
    public record VisibilityRequest(Boolean hidden) {
    }

    /**
     * 리뷰 답글 작성·수정 요청 — PATCH /api/admin/reviews/{id}/reply 바디 (R10).
     * content 는 Service 에서 공백 검증 (빈 답글 거부).
     */
    public record ReplyRequest(String content) {
    }

    /**
     * 신고 큐 항목 — 신고 메타 + 신고 대상 리뷰 스냅샷.
     * 관리자가 리뷰 본문을 보고 처리 여부를 판단할 수 있도록 reviewContent 까지 포함.
     */
    public record ReportItem(
            Long reportId,
            String reason,
            String reasonLabel,
            String detail,
            String status,
            String reporterName,
            LocalDateTime reportedAt,
            String handledByName,
            LocalDateTime handledAt,
            // ── 신고된 리뷰 정보 ──
            Long reviewId,
            String productName,
            String reviewAuthorName,
            Double reviewRating,
            String reviewContent,
            boolean reviewHidden
    ) {
        public static ReportItem from(ReviewReport rr) {
            Review rv = rr.getReview();
            return new ReportItem(
                    rr.getId(),
                    rr.getReason().name(),
                    reasonLabel(rr.getReason()),
                    rr.getDetail(),
                    rr.getStatus().name(),
                    rr.getReporter().getName(),
                    rr.getCreatedAt(),
                    rr.getHandledBy() != null ? rr.getHandledBy().getName() : null,
                    rr.getHandledAt(),
                    rv.getId(),
                    rv.getProduct().getName(),
                    rv.getUser().getName(),
                    rv.getRating(),
                    rv.getContent(),
                    Boolean.TRUE.equals(rv.getHidden())
            );
        }

        private static String reasonLabel(ReviewReport.ReportReason reason) {
            return switch (reason) {
                case SPAM -> "스팸/광고";
                case ABUSE -> "욕설/비방";
                case ADULT -> "음란성";
                case FALSE_INFO -> "허위정보";
                case ETC -> "기타";
            };
        }
    }
}
