package backend.repository;

import backend.entity.ProductLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductLikeRepository extends JpaRepository<ProductLike, Long> {

    // 토글 체크용 - 이미 좋아요 눌렀는지 조회
    Optional<ProductLike> findByUserIdAndProductId(Long userId, Long productId);

    // 토글 OFF용 - 좋아요 취소
    void deleteByUserIdAndProductId(Long userId, Long productId);

    // 존재 여부만 체크 (가벼움)
    boolean existsByUserIdAndProductId(Long userId, Long productId);

    // 상품의 좋아요 수 - 인기도 카운트 (B1 ProductDto 응답에 포함)
    long countByProductId(Long productId);
}
