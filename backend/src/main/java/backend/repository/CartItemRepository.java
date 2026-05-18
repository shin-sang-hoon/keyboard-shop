package backend.repository;

import backend.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * CartItem Repository (Phase 8 5-D, 5/18).
 *
 * Cart Aggregate 안에서는 보통 Cart.items 로 접근하지만, 직접 조회/수정 필요할 때 사용.
 * 예: 수량 변경 (quantity update), 특정 아이템 삭제.
 */
@Repository
public interface CartItemRepository extends JpaRepository<CartItem, Long> {

    /**
     * cart + product 조합으로 특정 행 조회 (중복 체크용).
     */
    Optional<CartItem> findByCart_IdAndProduct_Id(Long cartId, Long productId);

    /**
     * 특정 사용자의 카트 안의 특정 아이템 삭제.
     * (보안: cart.user.id 검증 포함).
     */
    @Modifying
    @Query("DELETE FROM CartItem ci WHERE ci.id = :itemId AND ci.cart.user.id = :userId")
    int deleteByIdAndUserId(@Param("itemId") Long itemId, @Param("userId") Long userId);

    /**
     * 사용자의 카트 비우기 (주문 완료 시).
     */
    @Modifying
    @Query("DELETE FROM CartItem ci WHERE ci.cart.user.id = :userId")
    int deleteAllByUserId(@Param("userId") Long userId);

    /**
     * Header 배지용 총 quantity 합산.
     */
    @Query("SELECT COALESCE(SUM(ci.quantity), 0) FROM CartItem ci WHERE ci.cart.user.id = :userId")
    long sumQuantityByUserId(@Param("userId") Long userId);
}
