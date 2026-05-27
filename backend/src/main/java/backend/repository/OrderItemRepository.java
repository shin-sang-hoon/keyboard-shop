package backend.repository;

import backend.entity.OrderItem;
import backend.entity.Order;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    List<OrderItem> findByOrder(Order order);

    /**
     * 5-H A6+B2: 리뷰 검증용 — order/order.user/product 한 번에 fetch.
     *
     * Review 작성 검증 시 orderItem.order.user.id (작성자 == 주문자?) 와
     * orderItem.order.status (배송 완료?) 모두 접근하므로 LAZY 체인 N+1 방지.
     * 기본 findById 를 EntityGraph 로 오버라이드.
     */
    @EntityGraph(attributePaths = {"order", "order.user", "product"})
    @Override
    Optional<OrderItem> findById(Long id);

    // ─────────────────────────────────────────────────────
    // UX P0 (5/28): 리뷰 작성 가능한 OrderItem 후보 조회
    // ─────────────────────────────────────────────────────

    /**
     * 현재 사용자의 reviewable OrderItem 목록 (특정 상품에 한정).
     *
     * 조건 3개 (5-H A6 구매 인증 가드의 SELECT 역방향):
     *   1) 본인 주문         o.user.id = :userId
     *   2) 배송 완료         o.status = DELIVERED
     *   3) 상품 일치         p.id = :productId
     *   4) 리뷰 미작성       NOT EXISTS (Review r WHERE r.orderItem.id = oi.id)
     *
     * NOT EXISTS = anti-join 패턴.
     * 순진하게 List 조회 후 reviewRepository.existsByOrderItemId 호출하면 N+1 폭발 →
     * 단일 쿼리로 anti-join 처리. (면접 talking)
     *
     * JOIN FETCH oi.product:
     *   결과를 DTO 로 변환할 때 productName/imageUrl 접근하므로 LAZY 회피.
     *   product 는 ManyToOne 단일 연관이라 컬렉션 fetch 페이징 함정과 무관.
     *
     * ORDER BY oi.id DESC:
     *   재구매 시나리오 대비 최신 주문 먼저. createdAt 은 orders 테이블 컬럼이라
     *   FETCH 안 한 상태에서 정렬에 쓰면 추가 쿼리/혼란 가능성 → 단조 증가하는
     *   oi.id 로 안전하게 대체. (재구매 = 같은 product 의 더 큰 order_item_id)
     */
    @Query("SELECT oi FROM OrderItem oi " +
           "JOIN FETCH oi.product p " +
           "JOIN oi.order o " +
           "WHERE o.user.id = :userId " +
           "  AND o.status = backend.entity.Order.OrderStatus.DELIVERED " +
           "  AND p.id = :productId " +
           "  AND NOT EXISTS (SELECT 1 FROM Review r WHERE r.orderItem.id = oi.id) " +
           "ORDER BY oi.id DESC")
    List<OrderItem> findReviewableByUserAndProduct(
            @Param("userId") Long userId,
            @Param("productId") Long productId);
}
