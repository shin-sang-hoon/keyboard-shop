package backend.service;

import backend.dto.ReviewReportDto;
import backend.entity.Review;
import backend.entity.ReviewReport;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.ReviewReportRepository;
import backend.repository.ReviewRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 리뷰 신고 서비스 — 사용자 측 (7-G R8).
 *
 * 책임: 일반 사용자가 부적절한 리뷰를 신고하는 것만 담당.
 * 관리자의 신고 처리(인용/기각)는 AdminReviewService 가 담당 — 행위 주체로 서비스 분리.
 *
 * createReport 검증 3단계:
 *   1) 리뷰 존재? → 404
 *   2) 본인이 작성한 리뷰? → 400 (자기 리뷰 신고 불가)
 *   3) 이미 신고했나? → 409 (중복 신고 불가)
 *      · Service 사전 체크 + DB UNIQUE(review_id, reporter_id) 2중 방어
 *      · 동시 요청 race condition 은 DB UNIQUE 가 최후 안전망
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReviewReportService {

    private static final int DETAIL_MAX_LENGTH = 500;

    private final ReviewReportRepository reviewReportRepository;
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;

    /**
     * 리뷰 신고 등록.
     *
     * @param reporterEmail 신고자 이메일 (JWT principal)
     * @param reviewId      신고 대상 리뷰 id
     * @param request       신고 사유 + 상세
     */
    @Transactional
    public void createReport(String reporterEmail, Long reviewId, ReviewReportDto.CreateRequest request) {
        validateRequest(request);

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> BusinessException.notFound("리뷰를 찾을 수 없습니다: " + reviewId));

        User reporter = userRepository.findByEmail(reporterEmail)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다: " + reporterEmail));

        // 본인 리뷰는 신고 불가
        if (review.getUser().getId().equals(reporter.getId())) {
            throw BusinessException.badRequest("본인이 작성한 리뷰는 신고할 수 없습니다.");
        }

        // 중복 신고 사전 체크 (DB UNIQUE 가 최후 안전망)
        if (reviewReportRepository.existsByReviewIdAndReporterId(reviewId, reporter.getId())) {
            throw BusinessException.conflict("이미 신고한 리뷰입니다.");
        }

        ReviewReport report = ReviewReport.builder()
                .review(review)
                .reporter(reporter)
                .reason(request.reason())
                .detail(request.detail())
                .build();

        reviewReportRepository.save(report);
    }

    private void validateRequest(ReviewReportDto.CreateRequest request) {
        if (request == null || request.reason() == null) {
            throw BusinessException.badRequest("신고 사유는 필수입니다.");
        }
        if (request.detail() != null && request.detail().length() > DETAIL_MAX_LENGTH) {
            throw BusinessException.badRequest(
                    "신고 상세는 " + DETAIL_MAX_LENGTH + "자를 초과할 수 없습니다.");
        }
    }
}
