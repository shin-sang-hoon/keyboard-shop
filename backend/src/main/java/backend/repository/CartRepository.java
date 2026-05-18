package backend.repository;

import backend.entity.Cart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Cart Repository (Phase 8 5-D, 5/18).
 * Aggregate Root 패턴 — Cart 를 통해 CartItem 에 접근.
 */
@Repository
public interface CartRepository extends JpaRepository<Cart, Long> {

    /**
     * 사용자별 Cart 조회 (회원당 1개 보장됨, UNIQUE).
     */
    Optional<Cart> findByUser_Id(Long userId);

    /**
     * Cart + items + product 한 번에 fetch (N+1 회피).
     * Cart 페이지 표시용.
     */
    @Query("SELECT c FROM Cart c " +
           "LEFT JOIN FETCH c.items i " +
           "LEFT JOIN FETCH i.product " +
           "WHERE c.user.id = :userId")
    Optional<Cart> findByUserIdWithItems(@Param("userId") Long userId);

    /**
     * 사용자 ID 로 Cart 존재 여부 확인 (회원가입 backfill 검증용).
     */
    boolean existsByUser_Id(Long userId);
}
