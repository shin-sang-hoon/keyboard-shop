package backend.dto;

import backend.entity.ReviewReport;

/**
 * 리뷰 신고 — 사용자 측 DTO (7-G R8).
 *
 * 관리자 측 신고 조회/처리 DTO 는 AdminReviewDto 에 정의.
 * 본 DTO 는 일반 사용자가 리뷰를 신고할 때의 요청 바디만 담당.
 */
public class ReviewReportDto {

    private ReviewReportDto() {
    }

    /**
     * 신고 등록 요청 — POST /api/reviews/{reviewId}/report 바디.
     *
     * @param reason 신고 사유 (필수) — SPAM/ABUSE/ADULT/FALSE_INFO/ETC
     * @param detail 추가 설명 (선택, 최대 500자) — Service 에서 길이 검증
     */
    public record CreateRequest(
            ReviewReport.ReportReason reason,
            String detail
    ) {
    }
}
