package backend.repository;

import backend.entity.QnA;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * QnA 영속성 레포지토리 (5-H A3 + B1 batch).
 *
 * 메서드 구성 (7개):
 *  - 조회: findByProductId(페이징), findByUserId(마이페이지)
 *  - 집계: countByProductId
 *  - 답변 대기 큐: findByAnswerContentIsNull, countByAnswerContentIsNull (관리자 admin UI)
 *  - 권한 체크: existsByIdAndUserId (비밀글 작성자 검증 helper, B3 Service 사용)
 *  - B1 batch: countByProductIds (목록 페이지 N+1 회피용 IN 절 일괄 카운트)
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
}
