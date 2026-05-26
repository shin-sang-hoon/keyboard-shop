package backend.repository;

import backend.entity.ReviewReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * ReviewReport 영속성 레포지토리 (7-G R8).
 *
 * 메서드 구성:
 *  - 중복 신고 방지: existsByReviewIdAndReporterId (Service 사전 체크 — DB UNIQUE 가 최후 안전망)
 *  - 형제 신고 일괄 처리: findByReviewIdAndStatus (한 리뷰의 PENDING 신고 모두 조회)
 *  - 관리자 신고 큐: findForAdmin (status 필터 + 깊은 fetch join)
 *  - 헤더 통계: countByStatus (PENDING 배지)
 */
public interface ReviewReportRepository extends JpaRepository<ReviewReport, Long> {

    /** 중복 신고 사전 체크 — UNIQUE(review_id, reporter_id) 위반을 깔끔한 예외로 변환 */
    boolean existsByReviewIdAndReporterId(Long reviewId, Long reporterId);

    /**
     * 한 리뷰에 달린 특정 상태의 신고 목록.
     * 신고 인용(resolve) 시 같은 리뷰의 PENDING 신고를 일괄 RESOLVED 처리하는 데 사용.
     */
    List<ReviewReport> findByReviewIdAndStatus(Long reviewId, ReviewReport.ReportStatus status);

    /** 관리자 헤더 배지 — 처리 대기 신고 수 */
    long countByStatus(ReviewReport.ReportStatus status);

    /**
     * 관리자 신고 큐 — status 필터 선택적 (null = 전체).
     *
     * DTO(ReportItem)가 신고 정보 + 신고된 리뷰 정보(상품/작성자/내용)까지 보여주므로
     * review → product / review → user / reporter / handledBy 를 모두 fetch join.
     * handledBy 는 PENDING 일 때 null 이므로 LEFT JOIN FETCH.
     * (전부 ManyToOne 단일 연관 → 페이징 + fetch join 동시 사용 안전)
     */
    @Query(value = "SELECT rr FROM ReviewReport rr " +
                   "JOIN FETCH rr.review rv " +
                   "JOIN FETCH rv.product " +
                   "JOIN FETCH rv.user " +
                   "JOIN FETCH rr.reporter " +
                   "LEFT JOIN FETCH rr.handledBy " +
                   "WHERE (:status IS NULL OR rr.status = :status)",
           countQuery = "SELECT COUNT(rr) FROM ReviewReport rr " +
                   "WHERE (:status IS NULL OR rr.status = :status)")
    Page<ReviewReport> findForAdmin(@Param("status") ReviewReport.ReportStatus status, Pageable pageable);
}
