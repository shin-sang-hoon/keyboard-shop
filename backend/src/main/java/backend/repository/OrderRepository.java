package backend.repository;

import backend.entity.Order;
import backend.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUser(User user);
    List<Order> findByUserOrderByCreatedAtDesc(User user);

    /**
     * 마이페이지 주문내역 — items + 각 item 의 product 까지 한 번에 fetch (N+1 방어).
     *
     * getMyOrders 는 페이징 없는 List 라서 컬렉션 fetch join 을 안전하게 쓸 수 있다
     * (페이징과 함께 쓰면 HHH90003004 메모리 페이징 경고가 뜨지만 여기는 해당 없음).
     * Order 1:N OrderItem fetch join 으로 중복 row 가 생기므로 DISTINCT 로 제거.
     * 정렬은 createdAt DESC.
     */
    @Query("SELECT DISTINCT o FROM Order o " +
           "LEFT JOIN FETCH o.items i " +
           "LEFT JOIN FETCH i.product " +
           "WHERE o.user = :user " +
           "ORDER BY o.createdAt DESC")
    List<Order> findByUserWithItemsAndProduct(@Param("user") User user);

    // ─── 7-G 라운드 6 (5/25): 관리자 주문 관리 ──────────────────────────
    /**
     * 관리자 주문 목록 — 전체 (status 필터 없음).
     * @EntityGraph 로 user 만 fetch → 주문자 정보 N+1 방어.
     *   items(컬렉션)는 fetch 하지 않는다 — 컬렉션 fetch + 페이징을 함께 쓰면
     *   Hibernate 가 메모리에서 페이징(HHH90003004 경고)하기 때문.
     *   목록은 "상품 N건" 요약만 필요하므로 items 는 LAZY 로 두고
     *   Service 의 @Transactional 안에서 size() 만 호출한다.
     */
    @EntityGraph(attributePaths = {"user"})
    Page<Order> findAllBy(Pageable pageable);

    /**
     * 관리자 주문 목록 — 특정 status 필터.
     */
    @EntityGraph(attributePaths = {"user"})
    Page<Order> findByStatus(Order.OrderStatus status, Pageable pageable);

    /**
     * 상태별 주문 수 — 향후 통계용 (현재 미사용, 확장 대비).
     */
    long countByStatus(Order.OrderStatus status);

    // ─── PortOne 결제 (6/5): complete 검증용 ───────────────────────────
    /**
     * paymentId 로 주문을 items + product 까지 fetch 해서 조회.
     *
     * 결제완료(complete) 검증에서 사용 — confirmPayment 가 각 OrderItem 의 product 로
     * 재고를 차감해야 하므로 items 와 product 를 함께 로딩한다(LAZY 접근 시 트랜잭션 밖 예외 방지).
     * payment_id 는 unique 라 결과는 0 또는 1건.
     */
    @Query("SELECT o FROM Order o " +
           "LEFT JOIN FETCH o.items i " +
           "LEFT JOIN FETCH i.product " +
           "WHERE o.paymentId = :paymentId")
    java.util.Optional<Order> findByPaymentIdWithItems(@Param("paymentId") String paymentId);
}
