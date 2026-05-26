package backend.repository;

import backend.entity.QnA;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * QnA 영속성 레포지토리 (5-H A3 + B1 batch, 7-G R8 admin).
 *
 * 메서드 구성:
 *  - 조회: findByProductId(페이징), findByUserId(마이페이지)
 *  - 집계: countByProductId
 *  - 답변 대기 큐: findByAnswerContentIsNull, countByAnswerContentIsNull (관리자 admin UI)
 *  - 권한 체크: existsByIdAndUserId (비밀글 작성자 검증 helper, B3 Service 사용)
 *  - B1 batch: countByProductIds (목록 페이지 N+1 회피용 IN 절 일괄 카운트)
 *  - 7-G R8: findForAdmin (관리자 Q&A 운영 — answered 필터 + fetch join)
 *
 * 비밀글 마스킹은 Service 레이어 책임 — Repository 는 raw 데이터 그대로 반환.
 * idx_qna_answered_at 인덱스로 답변 대기 큐가 단일 쿼리로 효율적.
 */
public interface QnARepository extends JpaRepository<QnA, Long> {

    /** 상품 페이지 — 정렬은 Pageable (createdAt DESC = 최신순) */
    Page<QnA> findByProductId(Long productId, Pageable pageable);

    /** 마이페이지 — 사용자가 작성한 모든 질문 */
    List<QnA> findByUserId(Long userId);

    /** 상품 카드 표시용 카운트 */
    long countByProductId(Long productId);

    /** 답변 대기 큐 — 관리자 admin UI 용 (페이징). idx_qna_answered_at 으로 효율적 */
    Page<QnA> findByAnswerContentIsNull(Pageable pageable);

    /** 답변 대기 카운트 — 관리자 알림 배지 용 */
    long countByAnswerContentIsNull();

    /** 권한 체크 helper — 비밀글 작성자 본인인지 검증 (Service 레이어에서 사용) */
    boolean existsByIdAndUserId(Long id, Long userId);

    /**
     * 5-H B1: 목록 일괄 집계 — IN 절 1쿼리.
     * @return Object[]: [productId(Long), count(Long)]
     *         질문 0건 product 는 row 없음 (Service 에서 Map.getOrDefault 처리)
     */
    @Query("SELECT q.product.id, COUNT(q) " +
           "FROM QnA q WHERE q.product.id IN :productIds " +
           "GROUP BY q.product.id")
    List<Object[]> countByProductIds(@Param("productIds") List<Long> productIds);

    // ─────────────────────────────────────────────────────
    // 7-G R8: 관리자 Q&A 운영
    // ─────────────────────────────────────────────────────

    /**
     * 관리자 Q&A 목록 — answered 필터 선택적.
     *   answered = null  → 전체
     *   answered = true  → 답변 완료 (answer_content IS NOT NULL)
     *   answered = false → 미답변 큐    (answer_content IS NULL)
     *
     * user/product 를 JOIN FETCH + answeredBy 를 LEFT JOIN FETCH — DTO 변환 N+1 회피.
     * (모두 ManyToOne 단일 연관 → 페이징 + fetch join 동시 사용 안전)
     *
     * 기존 findByAnswerContentIsNull 은 "미답변만" 전용 — 본 메서드는 3가지 필터를 하나로 통합.
     */
    @Query(value = "SELECT q FROM QnA q " +
                   "JOIN FETCH q.user JOIN FETCH q.product " +
                   "LEFT JOIN FETCH q.answeredBy " +
                   "WHERE (:answered IS NULL) " +
                   "OR (:answered = true AND q.answerContent IS NOT NULL) " +
                   "OR (:answered = false AND q.answerContent IS NULL)",
           countQuery = "SELECT COUNT(q) FROM QnA q " +
                   "WHERE (:answered IS NULL) " +
                   "OR (:answered = true AND q.answerContent IS NOT NULL) " +
                   "OR (:answered = false AND q.answerContent IS NULL)")
    Page<QnA> findForAdmin(@Param("answered") Boolean answered, Pageable pageable);
}
