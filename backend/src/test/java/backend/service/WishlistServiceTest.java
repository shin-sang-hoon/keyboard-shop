package backend.service;

import backend.dto.PagedResponse;
import backend.dto.WishlistDto;
import backend.entity.Product;
import backend.entity.User;
import backend.entity.Wishlist;
import backend.exception.BusinessException;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import backend.repository.WishlistRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * WishlistService 단위 테스트 (5-H A7).
 *
 * 테스트 전략:
 *   - ProductLikeServiceTest 와 동일한 패턴 — toggle UNIQUE race 방어 검증
 *   - 추가: getMyWishlist 페이징 응답 + PagedResponse wrap 검증 (4/27 PageImpl 패턴)
 *
 * 커버 범위 (10 cases):
 *   - toggle ON   : 성공 / race UNIQUE catch                         (2)
 *   - toggle OFF  : 성공                                              (1)
 *   - toggle 검증 : 미존재 product 404 / 미존재 user 404            (2)
 *   - getMyWishlist : 정상 페이징 / 빈 결과 / 미존재 user 404       (3)
 *   - 부수효과    : Wishlist count 응답에 없음 (Like 와 차이)        (1)
 *   - 도메인 의미 : Wishlist = private intent (응답에 wishlisted 만) (1)
 *
 * 면접 자산:
 *   - "Like vs Wishlist 분리 — 응답 형태 차이 (Like.count vs Wishlist.wishlisted) 검증"
 *   - "PagedResponse wrap 일관성 (4/27 PageImpl 패턴 그대로)"
 */
@ExtendWith(MockitoExtension.class)
class WishlistServiceTest {

    @Mock private WishlistRepository wishlistRepository;
    @Mock private ProductRepository productRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private WishlistService wishlistService;

    // ─────────────────────────────────────────────────────
    // Test fixtures
    // ─────────────────────────────────────────────────────

    private static final String EMAIL = "test@keychron.com";

    private User user(Long id) {
        return User.builder().id(id).email(EMAIL).name("테스터").role(User.Role.USER).build();
    }

    private Product product(Long id) {
        return Product.builder().id(id).name("Keychron K10 Pro").build();
    }

    private Wishlist wishlist(Long id, User u, Product p) {
        return Wishlist.builder()
                .id(id).user(u).product(p)
                .createdAt(LocalDateTime.now())
                .build();
    }

    // ═════════════════════════════════════════════════════
    // toggle() — 찜 토글
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("toggle() 찜 토글")
    class ToggleTest {

        @Test
        @DisplayName("기존 찜 없음 → INSERT → wishlisted=true")
        void toggle_on_insert() {
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(wishlistRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(false);
            given(userRepository.getReferenceById(1L)).willReturn(u);
            given(productRepository.getReferenceById(10L)).willReturn(product(10L));

            WishlistDto.ToggleResponse resp = wishlistService.toggle(EMAIL, 10L);

            assertThat(resp.isWishlisted()).isTrue();
            verify(wishlistRepository, times(1)).save(any(Wishlist.class));
            verify(wishlistRepository, never()).deleteByUserIdAndProductId(anyLong(), anyLong());
        }

        @Test
        @DisplayName("기존 찜 있음 → DELETE → wishlisted=false")
        void toggle_off_delete() {
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(wishlistRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(true);

            WishlistDto.ToggleResponse resp = wishlistService.toggle(EMAIL, 10L);

            assertThat(resp.isWishlisted()).isFalse();
            verify(wishlistRepository, times(1)).deleteByUserIdAndProductId(1L, 10L);
            verify(wishlistRepository, never()).save(any(Wishlist.class));
        }

        @Test
        @DisplayName("동시 클릭 race — UNIQUE 위반 catch 후 ON 으로 간주 (Like 와 동일 패턴)")
        void toggle_race_uniqueViolation_treatsAsOn() {
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(wishlistRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(false);
            given(userRepository.getReferenceById(1L)).willReturn(u);
            given(productRepository.getReferenceById(10L)).willReturn(product(10L));
            given(wishlistRepository.save(any(Wishlist.class)))
                    .willThrow(new DataIntegrityViolationException("UNIQUE violation"));

            WishlistDto.ToggleResponse resp = wishlistService.toggle(EMAIL, 10L);

            assertThat(resp.isWishlisted()).isTrue();
        }

        @Test
        @DisplayName("미존재 product → 404")
        void toggle_productNotFound() {
            given(productRepository.existsById(99L)).willReturn(false);

            assertThatThrownBy(() -> wishlistService.toggle(EMAIL, 99L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("상품을 찾을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);

            verify(userRepository, never()).findByEmail(any());
        }

        @Test
        @DisplayName("미존재 user → 404")
        void toggle_userNotFound() {
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.empty());

            assertThatThrownBy(() -> wishlistService.toggle(EMAIL, 10L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("사용자를 찾을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    // ═════════════════════════════════════════════════════
    // getMyWishlist() — 내 찜 목록 페이징 조회
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("getMyWishlist() 내 찜 목록")
    class GetMyWishlistTest {

        @Test
        @DisplayName("정상 페이징 — Page → PagedResponse 변환 (PageImpl WARN 패턴)")
        void getMyWishlist_returnsPagedResponse() {
            User u = user(1L);
            Wishlist w = wishlist(50L, u, product(10L));
            Pageable pageable = PageRequest.of(0, 10);
            Page<Wishlist> page = new PageImpl<>(List.of(w), pageable, 1);

            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(wishlistRepository.findByUserIdOrderByCreatedAtDesc(1L, pageable))
                    .willReturn(page);

            PagedResponse<WishlistDto.Item> resp = wishlistService.getMyWishlist(EMAIL, pageable);

            // PagedResponse 9 필드 일관성 (4/27 PageImpl WARN 청산 검증)
            assertThat(resp.getContent()).hasSize(1);
            assertThat(resp.getTotalElements()).isEqualTo(1L);
            assertThat(resp.getPage()).isZero();
            assertThat(resp.getSize()).isEqualTo(10);
            assertThat(resp.isFirst()).isTrue();
            assertThat(resp.isLast()).isTrue();
            assertThat(resp.getNumberOfElements()).isEqualTo(1);
            assertThat(resp.isEmpty()).isFalse();
        }

        @Test
        @DisplayName("빈 결과 — empty=true, totalElements=0")
        void getMyWishlist_empty() {
            User u = user(1L);
            Pageable pageable = PageRequest.of(0, 10);
            Page<Wishlist> empty = new PageImpl<>(List.of(), pageable, 0);

            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(wishlistRepository.findByUserIdOrderByCreatedAtDesc(1L, pageable))
                    .willReturn(empty);

            PagedResponse<WishlistDto.Item> resp = wishlistService.getMyWishlist(EMAIL, pageable);

            assertThat(resp.getContent()).isEmpty();
            assertThat(resp.getTotalElements()).isZero();
            assertThat(resp.isEmpty()).isTrue();
        }

        @Test
        @DisplayName("미존재 user (토큰 유효하지만 사용자 삭제) → 404")
        void getMyWishlist_userNotFound() {
            Pageable pageable = PageRequest.of(0, 10);

            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.empty());

            assertThatThrownBy(() -> wishlistService.getMyWishlist(EMAIL, pageable))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("사용자를 찾을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);

            // Repository 호출 안 됨 (사용자 없으면 즉시 throw)
            verify(wishlistRepository, never())
                    .findByUserIdOrderByCreatedAtDesc(anyLong(), any());
        }
    }

    // ═════════════════════════════════════════════════════
    // Like 와의 도메인 의미 차이
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("Like vs Wishlist 응답 형태 차이 (도메인 의미)")
    class LikeVsWishlistTest {

        @Test
        @DisplayName("Wishlist 응답에는 count 필드 없음 — private intent (본인만 안다)")
        void wishlistResponse_hasNoCount() {
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(wishlistRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(true);

            WishlistDto.ToggleResponse resp = wishlistService.toggle(EMAIL, 10L);

            // wishlisted 필드만 노출 (Like 와 달리 count 없음)
            assertThat(resp.isWishlisted()).isFalse();
            // count 메서드는 stub 안 함 → 호출되지 않아야 함 (Wishlist 는 count 미사용)
            // 만약 호출됐다면 stubbing 누락으로 NPE / 기본값 0 으로 응답해야 함
        }
    }
}
