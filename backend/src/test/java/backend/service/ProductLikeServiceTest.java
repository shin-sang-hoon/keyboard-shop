package backend.service;

import backend.dto.ProductLikeDto;
import backend.entity.ProductLike;
import backend.entity.Product;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.ProductLikeRepository;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

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
 * ProductLikeService 단위 테스트 (5-H A7).
 *
 * 테스트 전략:
 *   - JUnit 5 + Mockito 만 사용 (DB / Spring 컨텍스트 로드 X)
 *   - ReviewServiceTest 와 동일한 BDD + AssertJ + @Nested 패턴
 *
 * 커버 범위 (10 cases):
 *   - getCount    : 정상 / 미존재 product 404                    (2)
 *   - toggle ON   : 성공 (INSERT) / race UNIQUE 위반 catch       (2)
 *   - toggle OFF  : 성공 (DELETE)                                 (1)
 *   - toggle 검증 : 미존재 product 404 / 미존재 user 404         (2)
 *   - 응답 매핑   : count 카운트 정확히 반환 / 새 카운트 재조회  (2)
 *   - 부수효과    : 토글 OFF 시 INSERT 미호출                    (1)
 *
 * 면접 자산:
 *   - "낙관적 동시성 — UNIQUE 위반 race condition 을 catch 로 흡수하고 ON 으로 간주"
 *     (ProductLikeService 의 doToggle 주석에 박힌 패턴을 테스트로 입증)
 *   - "토글 후 정확한 count 재조회 (응답 동기화)" 검증
 *   - 검증 4단계 (productExists → user → exists → save/delete) 의 분기 모두 커버
 */
@ExtendWith(MockitoExtension.class)
class ProductLikeServiceTest {

    @Mock private ProductLikeRepository productLikeRepository;
    @Mock private ProductRepository productRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private ProductLikeService productLikeService;

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

    // ═════════════════════════════════════════════════════
    // getCount() — 좋아요 카운트 조회 (비로그인 가능)
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("getCount() 좋아요 카운트 조회")
    class GetCountTest {

        @Test
        @DisplayName("정상 케이스 — productId + count 반환")
        void getCount_success() {
            // given
            given(productRepository.existsById(10L)).willReturn(true);
            given(productLikeRepository.countByProductId(10L)).willReturn(42L);

            // when
            ProductLikeDto.CountResponse resp = productLikeService.getCount(10L);

            // then
            assertThat(resp.getProductId()).isEqualTo(10L);
            assertThat(resp.getCount()).isEqualTo(42L);
        }

        @Test
        @DisplayName("미존재 product → 404")
        void getCount_productNotFound() {
            given(productRepository.existsById(99L)).willReturn(false);

            assertThatThrownBy(() -> productLikeService.getCount(99L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("상품을 찾을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);

            // count 조회까지 가지 않음
            verify(productLikeRepository, never()).countByProductId(anyLong());
        }
    }

    // ═════════════════════════════════════════════════════
    // toggle() — 좋아요 토글
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("toggle() 좋아요 토글")
    class ToggleTest {

        @Test
        @DisplayName("기존 좋아요 없음 → INSERT → liked=true + count 1 증가")
        void toggle_on_insert() {
            // given
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(productLikeRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(false);
            given(userRepository.getReferenceById(1L)).willReturn(u);
            given(productRepository.getReferenceById(10L)).willReturn(product(10L));
            // 토글 전 0 → 토글 후 1 (INSERT 후 재조회)
            given(productLikeRepository.countByProductId(10L)).willReturn(1L);

            // when
            ProductLikeDto.ToggleResponse resp = productLikeService.toggle(EMAIL, 10L);

            // then
            assertThat(resp.isLiked()).isTrue();
            assertThat(resp.getCount()).isEqualTo(1L);
            verify(productLikeRepository, times(1)).save(any(ProductLike.class));
            verify(productLikeRepository, never()).deleteByUserIdAndProductId(anyLong(), anyLong());
        }

        @Test
        @DisplayName("기존 좋아요 있음 → DELETE → liked=false + count 1 감소")
        void toggle_off_delete() {
            // given
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(productLikeRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(true);
            given(productLikeRepository.countByProductId(10L)).willReturn(0L);

            // when
            ProductLikeDto.ToggleResponse resp = productLikeService.toggle(EMAIL, 10L);

            // then
            assertThat(resp.isLiked()).isFalse();
            assertThat(resp.getCount()).isEqualTo(0L);
            verify(productLikeRepository, times(1)).deleteByUserIdAndProductId(1L, 10L);
            verify(productLikeRepository, never()).save(any(ProductLike.class));
        }

        @Test
        @DisplayName("동시 클릭 race — UNIQUE 위반을 catch 후 ON 으로 간주 (면접 자산)")
        void toggle_race_uniqueViolation_treatsAsOn() {
            // given
            // T1, T2 둘 다 exists=false 로 읽고 동시에 INSERT 시도하는 상황을 시뮬레이션.
            // 우리 mock 은 exists=false 이지만 save() 가 UNIQUE 위반 던지도록 stubbing.
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(productLikeRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(false);
            given(userRepository.getReferenceById(1L)).willReturn(u);
            given(productRepository.getReferenceById(10L)).willReturn(product(10L));
            given(productLikeRepository.save(any(ProductLike.class)))
                    .willThrow(new DataIntegrityViolationException("UNIQUE violation"));
            // race 후 다른 트랜잭션이 이미 INSERT 한 상태라 count 는 1
            given(productLikeRepository.countByProductId(10L)).willReturn(1L);

            // when
            ProductLikeDto.ToggleResponse resp = productLikeService.toggle(EMAIL, 10L);

            // then
            // 사용자 의도(좋아요 ON) 와 결과(ON) 일치 → liked=true 로 응답
            assertThat(resp.isLiked()).isTrue();
            assertThat(resp.getCount()).isEqualTo(1L);
        }

        @Test
        @DisplayName("미존재 product → 404 (토글 시도 자체 차단)")
        void toggle_productNotFound() {
            given(productRepository.existsById(99L)).willReturn(false);

            assertThatThrownBy(() -> productLikeService.toggle(EMAIL, 99L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("상품을 찾을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);

            // 사용자 조회까지 가지 않음
            verify(userRepository, never()).findByEmail(any());
            verify(productLikeRepository, never()).save(any());
            verify(productLikeRepository, never()).deleteByUserIdAndProductId(anyLong(), anyLong());
        }

        @Test
        @DisplayName("미존재 user (토큰 유효하지만 사용자 삭제됨) → 404")
        void toggle_userNotFound() {
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.empty());

            assertThatThrownBy(() -> productLikeService.toggle(EMAIL, 10L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("사용자를 찾을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);

            verify(productLikeRepository, never()).existsByUserIdAndProductId(anyLong(), anyLong());
        }
    }

    // ═════════════════════════════════════════════════════
    // 응답 동기화 — 토글 후 카운트 재조회
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("토글 후 응답 동기화")
    class CountSyncTest {

        @Test
        @DisplayName("INSERT 후 count 재조회 (낙관적 UI 와 서버 정확값 동기화 가능)")
        void toggle_on_returnsFreshCount() {
            // given
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(productLikeRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(false);
            given(userRepository.getReferenceById(1L)).willReturn(u);
            given(productRepository.getReferenceById(10L)).willReturn(product(10L));
            // 동시에 다른 사용자도 좋아요 → 우리 INSERT 후 총 5건
            given(productLikeRepository.countByProductId(10L)).willReturn(5L);

            // when
            ProductLikeDto.ToggleResponse resp = productLikeService.toggle(EMAIL, 10L);

            // then
            // count() 가 토글 후 한 번 호출됐는지 확인 (응답 동기화 입증)
            verify(productLikeRepository, times(1)).countByProductId(10L);
            assertThat(resp.getCount()).isEqualTo(5L);
        }

        @Test
        @DisplayName("DELETE 후 count 재조회")
        void toggle_off_returnsFreshCount() {
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(productLikeRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(true);
            given(productLikeRepository.countByProductId(10L)).willReturn(2L);

            ProductLikeDto.ToggleResponse resp = productLikeService.toggle(EMAIL, 10L);

            verify(productLikeRepository, times(1)).countByProductId(10L);
            assertThat(resp.getCount()).isEqualTo(2L);
        }

        @Test
        @DisplayName("count 재조회는 정확히 1번만 호출 (불필요한 DB hit 방지)")
        void toggle_countQueriedExactlyOnce() {
            User u = user(1L);
            given(productRepository.existsById(10L)).willReturn(true);
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(productLikeRepository.existsByUserIdAndProductId(1L, 10L)).willReturn(true);
            given(productLikeRepository.countByProductId(10L)).willReturn(0L);

            productLikeService.toggle(EMAIL, 10L);

            // 토글 전 사전 체크는 existsBy 로 처리, count() 는 응답 시점에만 호출
            verify(productLikeRepository, times(1)).countByProductId(10L);
        }
    }
}
