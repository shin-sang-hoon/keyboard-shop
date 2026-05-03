package backend.repository;

import backend.entity.OrderItem;
import backend.entity.Order;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
