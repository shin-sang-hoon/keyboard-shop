package backend.repository;

import backend.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/**
 * Review 영속성 레포지토리 (5-H A2 + A6 통합).
 *
 * 메서드 구성:
 *  - 조회: findByProductId(페이징), findByUserId(마이페이지)
 *  - 집계: countByProductId, findAverageRatingByProductId
 *  - 구매 인증: existsByOrderItemId(작성 전 사전 체크), findByOrderItemId(주문별 리뷰 조회)
 *
 * UNIQUE(order_item_id) 위반은 DB 가 막지만, Service 에서 existsByOrderItemId 로 사전 검증해
 * 깔끔한 비즈니스 예외(ReviewAlreadyExistsException 등)로 변환하는 게 UX 상 좋음.
 *
 * B5 별점 분포 통계 쿼리 (1★~5★ count) 는 별도 추가 예정.
 */
public interface ReviewRepository extends JpaRepository<Review, Long> {

    /** 상품 페이지 — 정렬은 Pageable 에서 (createdAt DESC = 최신순, rating DESC = 별점순) */
    Page<Review> findByProductId(Long productId, Pageable pageable);

    /** 마이페이지 — 사용자가 작성한 모든 리뷰 (재구매로 동일 상품 여러 row 가능) */
    List<Review> findByUserId(Long userId);

    /** 상품 카드 표시용 카운트 */
    long countByProductId(Long productId);

    /** 평균 별점 — 리뷰 0건이면 null. Service 에서 0.0 변환 또는 null 그대로 응답 */
    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.product.id = :productId")
    Double findAverageRatingByProductId(Long productId);

    /** 구매 인증 — 이 OrderItem 에 이미 리뷰 작성됐는지. UNIQUE 사전 체크 */
    boolean existsByOrderItemId(Long orderItemId);

    /** 마이페이지의 "이 주문의 리뷰" 표시용 — 1 OrderItem 당 최대 1 Review */
    Optional<Review> findByOrderItemId(Long orderItemId);
}
