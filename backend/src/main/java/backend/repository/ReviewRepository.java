package backend.repository;

import backend.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Review 영속성 레포지토리 (5-H A2 + A6 + B1 batch + B5 stats, 7-G R8 hidden 필터, R10 답글).
 *
 * 메서드 구성:
 *  - 공개 조회: findByProductId(페이징), findByUserId(마이페이지)
 *  - 공개 집계: countByProductId, findAverageRatingByProductId
 *  - 구매 인증: existsByOrderItemId, findByOrderItemId
 *  - B1 batch: findReviewStatsByProductIds
 *  - B5 stats: findRatingDistributionByProductId
 *  - 7-G R8: findForAdmin(관리자 목록), countByHiddenTrue(숨김 카운트)
 *  - R10: findRepliedByAdmin(관리자가 답변한 리뷰 — 마이페이지 관리자 탭)
 *
 * ── 7-G R8 hidden 정책 ──────────────────────────────────────────────
 *  관리자가 숨긴 리뷰(hidden=true)는 "공개"로 노출되는 모든 경로에서 제외돼야 함.
 *  그렇지 않으면 숨긴 리뷰가 별점 평균/개수에 계속 반영되는 버그가 됨.
 *
 *  → 공개 조회/집계 5개 메서드(findByProductId, countByProductId,
 *    findAverageRatingByProductId, findReviewStatsByProductIds,
 *    findRatingDistributionByProductId)를 @Query 로 전환하고 hidden=false 를 추가.
 *
 *  메서드 "시그니처"는 그대로 유지 → ReviewService / ProductService 호출부 무수정.
 *  (파생 메서드명을 바꾸지 않고 @Query 만 얹어 동작을 교체하는 방식)
 *
 *  예외:
 *   - findByUserId : 마이페이지 — 작성자 본인은 숨김 리뷰도 볼 수 있어야 하므로 필터 안 함
 *   - existsByOrderItemId / findByOrderItemId : 구매 인증용 — 숨김이어도 "리뷰 존재"는 사실,
 *     중복 작성 방지를 위해 필터 안 함
 */
public interface ReviewRepository extends JpaRepository<Review, Long> {

    /**
     * 상품 페이지 — 공개 리뷰만 (hidden=false). 정렬은 Pageable 위임.
     * 파생 메서드명을 유지하되 @Query 로 hidden 필터를 적용 (호출부 무수정).
     *
     * R10: repliedBy 를 LEFT JOIN FETCH — 답글 있는 리뷰의 "판매자 답변" 노출 시
     *      답변자 displayName 접근으로 발생하는 N+1 을 선제 차단.
     *      LEFT 인 이유: 미답변 리뷰(repliedBy=null)도 결과에 포함돼야 하므로.
     *      user 는 from() 에서 항상 접근하므로 함께 fetch (product 는 product.id 만 써서 생략).
     */
    @Query(value = "SELECT r FROM Review r " +
                   "JOIN FETCH r.user " +
                   "LEFT JOIN FETCH r.repliedBy " +
                   "WHERE r.product.id = :productId AND r.hidden = false",
           countQuery = "SELECT COUNT(r) FROM Review r " +
                   "WHERE r.product.id = :productId AND r.hidden = false")
    Page<Review> findByProductId(@Param("productId") Long productId, Pageable pageable);

    /** 마이페이지 — 사용자 본인 리뷰 전체 (숨김 포함 — 본인은 볼 수 있어야 함) */
    List<Review> findByUserId(Long userId);

    /** 상품 카드 표시용 카운트 — 공개 리뷰만 */
    @Query("SELECT COUNT(r) FROM Review r " +
           "WHERE r.product.id = :productId AND r.hidden = false")
    long countByProductId(@Param("productId") Long productId);

    /** 평균 별점 — 공개 리뷰만. 리뷰 0건이면 null */
    @Query("SELECT AVG(r.rating) FROM Review r " +
           "WHERE r.product.id = :productId AND r.hidden = false")
    Double findAverageRatingByProductId(@Param("productId") Long productId);

    /** 구매 인증 — 이 OrderItem 에 이미 리뷰 작성됐는지 (숨김 포함 — 중복 작성 방지) */
    boolean existsByOrderItemId(Long orderItemId);

    /** 마이페이지의 "이 주문의 리뷰" 표시용 — 1 OrderItem 당 최대 1 Review (숨김 포함) */
    Optional<Review> findByOrderItemId(Long orderItemId);

    /**
     * 5-H B1: 목록 일괄 집계 — IN 절 1쿼리 (공개 리뷰만).
     * @return Object[]: [productId(Long), count(Long), avgRating(Double)]
     */
    @Query("SELECT r.product.id, COUNT(r), AVG(r.rating) " +
           "FROM Review r WHERE r.product.id IN :productIds AND r.hidden = false " +
           "GROUP BY r.product.id")
    List<Object[]> findReviewStatsByProductIds(@Param("productIds") List<Long> productIds);

    /**
     * 5-H B5: 별점 분포 — FLOOR(rating) 5버킷 GROUP BY (공개 리뷰만).
     * @return Object[]: [bucket(Integer 1~5), count(Long)]
     */
    @Query("SELECT FLOOR(r.rating), COUNT(r) " +
           "FROM Review r WHERE r.product.id = :productId AND r.hidden = false " +
           "GROUP BY FLOOR(r.rating)")
    List<Object[]> findRatingDistributionByProductId(@Param("productId") Long productId);

    // ─────────────────────────────────────────────────────
    // 7-G R8: 관리자 운영 — 숨김 리뷰 포함 전체 조회
    // ─────────────────────────────────────────────────────

    /**
     * 관리자 리뷰 목록 — hidden 필터 선택적 (null = 전체).
     *
     * user/product 를 JOIN FETCH — DTO 변환 시 N+1 회피.
     * (둘 다 ManyToOne 단일 연관 → 페이징 + fetch join 동시 사용 안전, 메모리 페이징 경고 없음)
     */
    @Query(value = "SELECT r FROM Review r " +
                   "JOIN FETCH r.user JOIN FETCH r.product " +
                   "WHERE (:hidden IS NULL OR r.hidden = :hidden)",
           countQuery = "SELECT COUNT(r) FROM Review r " +
                   "WHERE (:hidden IS NULL OR r.hidden = :hidden)")
    Page<Review> findForAdmin(@Param("hidden") Boolean hidden, Pageable pageable);

    /** 관리자 헤더 통계용 — 현재 숨김 처리된 리뷰 수 */
    long countByHiddenTrue();

    // ─────────────────────────────────────────────────────
    // R10: 판매자 답글 — 관리자가 답변한 리뷰 (마이페이지 관리자 탭)
    // ─────────────────────────────────────────────────────

    /**
     * 마이페이지 "내가 답변한 리뷰" — 특정 관리자(repliedBy)가 답변한 리뷰 목록.
     *
     * user/product 를 JOIN FETCH — DTO 변환 시 N+1 회피 (단방향 ManyToOne 2개 → 페이징 안전).
     * repliedBy 는 WHERE 조건이므로 fetch 불필요 (현재 로그인 관리자 == 답변자, 이미 알고 있음).
     * 정렬: 답변 최신순 (replied_at DESC) — idx_review_replied_by(replied_by, replied_at) 활용.
     */
    @Query(value = "SELECT r FROM Review r " +
                   "JOIN FETCH r.user JOIN FETCH r.product " +
                   "WHERE r.repliedBy.id = :adminId " +
                   "ORDER BY r.repliedAt DESC",
           countQuery = "SELECT COUNT(r) FROM Review r " +
                   "WHERE r.repliedBy.id = :adminId")
    Page<Review> findRepliedByAdmin(@Param("adminId") Long adminId, Pageable pageable);
}
