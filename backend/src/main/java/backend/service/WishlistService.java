package backend.service;

import backend.dto.PagedResponse;
import backend.dto.WishlistDto;
import backend.entity.User;
import backend.entity.Wishlist;
import backend.exception.BusinessException;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import backend.repository.WishlistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 찜(Wishlist) 서비스 (B4).
 *
 * Like 와의 분리 (메모 v2 — 4/29):
 *   - Like     = public count (♥ 카운트 노출)
 *   - Wishlist = private intent (⭐ 본인만 조회)
 *
 * 토글 동작은 Like 와 동일 (exists 체크 + UNIQUE race 방어).
 * 차이점: Wishlist 응답에는 count 가 없고 wishlisted 상태만.
 *
 * 추가 기능: 내 찜 목록 페이징 조회.
 *   - WishlistRepository.findByUserIdOrderByCreatedAtDesc 활용
 *   - 페이징 응답은 PagedResponse 로 wrap (4/27 PageImpl WARN 패턴)
 *
 * N+1 주의:
 *   - Wishlist.product 가 LAZY 라 페이지 단위 조회 시 product 마다 SELECT 1번 → N+1
 *   - 현재 Repository 메서드는 fetch join 없음 → Service 에서 그대로 부르면 N+1 발생
 *   - 임시 대응: open-in-view 가 켜져있어서 동작은 함 (성능 부채)
 *   - 추후 fetch join 메서드 추가 권장 (B1 같은 후속 정리 시)
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WishlistService {

    private final WishlistRepository wishlistRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    // ─────────────────────────────────────────────────────
    // 조회 — 내 찜 목록 (인증 필요)
    // ─────────────────────────────────────────────────────

    public PagedResponse<WishlistDto.Item> getMyWishlist(String currentUserEmail, Pageable pageable) {
        User currentUser = findUserByEmail(currentUserEmail);

        Page<WishlistDto.Item> page = wishlistRepository
                .findByUserIdOrderByCreatedAtDesc(currentUser.getId(), pageable)
                .map(WishlistDto.Item::from);

        return PagedResponse.from(page);
    }

    // ─────────────────────────────────────────────────────
    // 토글 (인증 필요)
    // ─────────────────────────────────────────────────────

    @Transactional
    public WishlistDto.ToggleResponse toggle(String currentUserEmail, Long productId) {
        if (!productRepository.existsById(productId)) {
            throw BusinessException.notFound("상품을 찾을 수 없습니다: " + productId);
        }

        User currentUser = findUserByEmail(currentUserEmail);
        boolean wishlisted = doToggle(currentUser.getId(), productId);

        return WishlistDto.ToggleResponse.builder()
                .wishlisted(wishlisted)
                .build();
    }

    /**
     * 토글 로직 — ProductLikeService.doToggle 과 동일 패턴.
     * UNIQUE race 방어를 동일하게 적용.
     */
    private boolean doToggle(Long userId, Long productId) {
        boolean exists = wishlistRepository.existsByUserIdAndProductId(userId, productId);

        if (exists) {
            wishlistRepository.deleteByUserIdAndProductId(userId, productId);
            return false;
        }

        try {
            Wishlist wishlist = Wishlist.builder()
                    .user(userRepository.getReferenceById(userId))
                    .product(productRepository.getReferenceById(productId))
                    .build();
            wishlistRepository.save(wishlist);
            return true;
        } catch (DataIntegrityViolationException e) {
            log.warn("Wishlist race detected — userId={}, productId={}, treated as ON",
                    userId, productId);
            return true;
        }
    }

    // ─────────────────────────────────────────────────────
    // helper
    // ─────────────────────────────────────────────────────

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다: " + email));
    }
}
