package backend.repository;

import backend.entity.Wishlist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WishlistRepository extends JpaRepository<Wishlist, Long> {

    // 토글 체크용
    Optional<Wishlist> findByUserIdAndProductId(Long userId, Long productId);

    // 토글 OFF용
    void deleteByUserIdAndProductId(Long userId, Long productId);

    // 존재 여부만
    boolean existsByUserIdAndProductId(Long userId, Long productId);

    // 마이페이지 찜 목록 (페이징, 최신순)
    Page<Wishlist> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    // 사용자가 찜한 개수 (마이페이지 카운트 표시용)
    long countByUserId(Long userId);
}
