package backend.service;

import backend.dto.AdminReviewDto;
import backend.dto.PagedResponse;
import backend.entity.Review;
import backend.entity.ReviewReport;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.ReviewReportRepository;
import backend.repository.ReviewRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 관리자 리뷰·신고 운영 서비스 (7-G R8, R10 답글).
 *
 * 담당 (관리자 행위):
 *  - 리뷰 목록 조회 (숨김 포함, hidden 필터)
 *  - 리뷰 숨김 / 복원 토글
 *  - 리뷰 답글 작성·수정·삭제 (R10) — 판매자 답변
 *  - 내가 답변한 리뷰 조회 (R10) — 마이페이지 관리자 탭
 *  - 신고 큐 조회 (status 필터)
 *  - 신고 인용 — 대상 리뷰 숨김 + 같은 리뷰의 PENDING 신고 일괄 RESOLVED
 *  - 신고 기각 — 해당 신고만 DISMISSED, 리뷰는 그대로 노출
 *
 * 사용자의 신고 "등록" 은 ReviewReportService 가 담당 — 행위 주체로 서비스 분리.
 *
 * hidden 정책:
 *  - 리뷰를 숨기면 ReviewRepository 의 공개 쿼리에서 자동 제외 (별점 통계 포함).
 *  - hard delete 가 아닌 soft hide — 신고 이력·통계 추적 보존.
 *
 * R10 답글 정책:
 *  - PATCH /reply 는 upsert — 최초 작성과 수정을 같은 엔드포인트로 처리 (Review.addReply).
 *  - 답변자(repliedBy)는 현재 로그인 관리자. 다른 관리자가 수정하면 답변자도 갱신됨.
 *  - 빈 본문은 거부 (badRequest) — 빈 답글로 "답변함" 상태를 만들지 않음.
 *  - 답글은 hidden 무관하게 작성 가능 (숨긴 리뷰에 내부 메모성 답변은 막지 않음) —
 *    단 공개 노출은 ReviewRepository 의 hidden=false 필터가 책임지므로 숨긴 리뷰 답글은 안 보임.
 *
 * 신고 인용 시 형제 신고 일괄 처리:
 *  - 한 리뷰에 여러 신고가 쌓일 수 있음. 리뷰가 숨겨지면 나머지 PENDING 신고는 의미 없어짐.
 *  - @Modifying 벌크 UPDATE 대신 findByReviewIdAndStatus 로 fetch 후 도메인 메서드 resolve() 루프 —
 *    영속성 컨텍스트와 일관, enum 리터럴 JPQL 이슈 회피, 신고 건수가 적어 성능 문제 없음.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminReviewService {

    private final ReviewRepository reviewRepository;
    private final ReviewReportRepository reviewReportRepository;
    private final UserRepository userRepository;

    // ─────────────────────────────────────────────────────
    // 리뷰 목록 / 숨김
    // ─────────────────────────────────────────────────────

    /**
     * 관리자 리뷰 목록 — hidden 필터 선택적 (null = 전체).
     */
    public PagedResponse<AdminReviewDto.ListItem> listReviews(Boolean hidden, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AdminReviewDto.ListItem> result = reviewRepository.findForAdmin(hidden, pageable)
                .map(AdminReviewDto.ListItem::from);
        return PagedResponse.from(result);
    }

    /**
     * 리뷰 숨김 / 복원.
     * @param hidden true = 숨김, false = 복원
     */
    @Transactional
    public AdminReviewDto.ListItem updateVisibility(Long reviewId, Boolean hidden) {
        if (hidden == null) {
            throw BusinessException.badRequest("hidden 값은 필수입니다.");
        }
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> BusinessException.notFound("리뷰를 찾을 수 없습니다: " + reviewId));

        // 도메인 메서드 — dirty checking 으로 UPDATE 자동 발행
        review.updateHidden(hidden);

        return AdminReviewDto.ListItem.from(review);
    }

    // ─────────────────────────────────────────────────────
    // R10: 리뷰 답글 (판매자 답변) — 작성·수정·삭제 + 내 답변 목록
    // ─────────────────────────────────────────────────────

    /**
     * 리뷰 답글 작성·수정 (upsert) — PATCH /api/admin/reviews/{id}/reply.
     *
     * 최초 작성과 수정을 같은 메서드로 처리. 답변자는 현재 로그인 관리자.
     * dirty checking 으로 UPDATE 자동 발행.
     */
    @Transactional
    public AdminReviewDto.ListItem addReply(Long reviewId, String content, String adminEmail) {
        if (content == null || content.isBlank()) {
            throw BusinessException.badRequest("답글 내용은 비어 있을 수 없습니다.");
        }
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> BusinessException.notFound("리뷰를 찾을 수 없습니다: " + reviewId));

        User admin = findUserByEmail(adminEmail);

        // 도메인 메서드 — reply/repliedBy/repliedAt 원자적 set, dirty checking 으로 UPDATE
        review.addReply(content.trim(), admin);

        return AdminReviewDto.ListItem.from(review);
    }

    /**
     * 리뷰 답글 삭제 — DELETE /api/admin/reviews/{id}/reply.
     *
     * 답글 3필드를 모두 null 로 되돌림 → 다시 "미답변" 상태.
     * 답글이 없는 리뷰에 호출하면 멱등(no-op)하게 동작 — 별도 에러 없이 미답변 유지.
     */
    @Transactional
    public AdminReviewDto.ListItem removeReply(Long reviewId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> BusinessException.notFound("리뷰를 찾을 수 없습니다: " + reviewId));

        review.removeReply();

        return AdminReviewDto.ListItem.from(review);
    }

    /**
     * 내가 답변한 리뷰 목록 (R10) — 마이페이지 관리자 탭.
     *
     * 현재 로그인 관리자(adminEmail)가 답변한 리뷰만, 답변 최신순.
     * Repository 가 user/product JOIN FETCH 로 N+1 회피, repliedBy 는 WHERE 조건.
     */
    public PagedResponse<AdminReviewDto.ListItem> listMyReplies(String adminEmail, int page, int size) {
        User admin = findUserByEmail(adminEmail);
        Pageable pageable = PageRequest.of(page, size);
        Page<AdminReviewDto.ListItem> result = reviewRepository
                .findRepliedByAdmin(admin.getId(), pageable)
                .map(AdminReviewDto.ListItem::from);
        return PagedResponse.from(result);
    }

    // ─────────────────────────────────────────────────────
    // 신고 큐 / 처리
    // ─────────────────────────────────────────────────────

    /**
     * 신고 큐 조회 — status 필터 선택적 (null = 전체).
     */
    public PagedResponse<AdminReviewDto.ReportItem> listReports(
            ReviewReport.ReportStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AdminReviewDto.ReportItem> result = reviewReportRepository.findForAdmin(status, pageable)
                .map(AdminReviewDto.ReportItem::from);
        return PagedResponse.from(result);
    }

    /**
     * 신고 인용 — 대상 리뷰를 숨기고, 같은 리뷰의 PENDING 신고를 모두 RESOLVED 처리.
     */
    @Transactional
    public void resolveReport(Long reportId, String adminEmail) {
        ReviewReport report = reviewReportRepository.findById(reportId)
                .orElseThrow(() -> BusinessException.notFound("신고를 찾을 수 없습니다: " + reportId));

        if (!report.isPending()) {
            throw BusinessException.badRequest("이미 처리된 신고입니다.");
        }

        User admin = findUserByEmail(adminEmail);
        Review review = report.getReview();

        // 1) 대상 리뷰 숨김 (dirty checking)
        review.updateHidden(true);

        // 2) 같은 리뷰의 모든 PENDING 신고 일괄 인용 (클릭한 신고 포함)
        List<ReviewReport> pendings = reviewReportRepository.findByReviewIdAndStatus(
                review.getId(), ReviewReport.ReportStatus.PENDING);
        for (ReviewReport rr : pendings) {
            rr.resolve(admin);
        }
    }

    /**
     * 신고 기각 — 해당 신고만 DISMISSED. 리뷰는 그대로 노출.
     */
    @Transactional
    public void dismissReport(Long reportId, String adminEmail) {
        ReviewReport report = reviewReportRepository.findById(reportId)
                .orElseThrow(() -> BusinessException.notFound("신고를 찾을 수 없습니다: " + reportId));

        if (!report.isPending()) {
            throw BusinessException.badRequest("이미 처리된 신고입니다.");
        }

        User admin = findUserByEmail(adminEmail);
        report.dismiss(admin);
    }

    // ─────────────────────────────────────────────────────
    // helper
    // ─────────────────────────────────────────────────────

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다: " + email));
    }
}
