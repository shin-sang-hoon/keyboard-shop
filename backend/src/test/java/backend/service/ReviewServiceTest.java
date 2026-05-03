package backend.service;

import backend.dto.PagedResponse;
import backend.dto.ReviewDto;
import backend.entity.Order;
import backend.entity.OrderItem;
import backend.entity.Product;
import backend.entity.Review;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.OrderItemRepository;
import backend.repository.ProductRepository;
import backend.repository.ReviewRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * ReviewService 단위 테스트 (5-H A7).
 *
 * 테스트 전략:
 *   - JUnit 5 + Mockito 만 사용 (DB / Spring 컨텍스트 로드 X → 빠름, 격리)
 *   - @ExtendWith(MockitoExtension.class) — JUnit 5 Mockito 통합
 *   - @Mock + @InjectMocks — Repository 4개 mock 후 ReviewService 에 주입
 *   - BDD 스타일: given/when/then (Given-When-Then 패턴 명시)
 *   - AssertJ assertThatThrownBy — 비즈니스 예외 + HttpStatus 동시 검증
 *
 * 커버 범위 (13 cases):
 *   - create 검증 4단계 6 cases (success / 4 fail / rating 검증 3 sub)
 *   - update 도메인 메서드 + dirty checking (save 미호출 검증) 2 cases
 *   - delete 본인/ADMIN/타인 분기 3 cases
 *   - getReviewsByProduct PagedResponse 변환 1 case
 *   - getReviewStats 빈 버킷 보정 1 case
 *
 * 면접 포인트:
 *   - "DB 검증 4단계가 모든 분기마다 정확한 HttpStatus 던지는지" 명시적 검증
 *   - "update() 후 save() 호출 안 됨" verify(repo, never()).save(...) — dirty checking 정확히 의도대로
 *   - ArgumentCaptor 로 빌드된 Review 의 detail 검증 (rating/content 정확 전달)
 */
@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock private ReviewRepository reviewRepository;
    @Mock private OrderItemRepository orderItemRepository;
    @Mock private ProductRepository productRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private ReviewService reviewService;

    // ─────────────────────────────────────────────────────
    // Test fixtures (재사용 가능한 mock 객체)
    // ─────────────────────────────────────────────────────

    private static final String EMAIL = "test@keychron.com";

    private User user(Long id, User.Role role) {
        return User.builder().id(id).email(EMAIL).name("테스터").role(role).build();
    }

    private Product product(Long id) {
        return Product.builder().id(id).name("Keychron K10 Pro").build();
    }

    private Order order(Long id, User u, Order.OrderStatus status) {
        return Order.builder().id(id).user(u).status(status).totalPrice(100000).build();
    }

    private OrderItem orderItem(Long id, Order o, Product p) {
        return OrderItem.builder().id(id).order(o).product(p).quantity(1).price(100000).build();
    }

    private Review review(Long id, User u, Product p, OrderItem oi, Double rating, String content) {
        return Review.builder()
                .id(id).user(u).product(p).orderItem(oi)
                .rating(rating).content(content)
                .build();
    }

    // ═════════════════════════════════════════════════════
    // create() — 검증 4단계 + rating
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("create() 리뷰 작성")
    class CreateTest {

        @Test
        @DisplayName("정상 케이스 — 모든 검증 통과 → Review 저장")
        void create_success() {
            // given
            User u = user(1L, User.Role.USER);
            Product p = product(10L);
            Order o = order(100L, u, Order.OrderStatus.DELIVERED);
            OrderItem oi = orderItem(1000L, o, p);

            given(orderItemRepository.findById(1000L)).willReturn(Optional.of(oi));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(reviewRepository.existsByOrderItemId(1000L)).willReturn(false);
            given(reviewRepository.save(any(Review.class)))
                    .willAnswer(inv -> {
                        Review r = inv.getArgument(0);
                        // save 시 ID 부여 시뮬레이션 — 실제 JPA 동작과 일치
                        return Review.builder()
                                .id(999L)
                                .user(r.getUser())
                                .product(r.getProduct())
                                .orderItem(r.getOrderItem())
                                .rating(r.getRating())
                                .content(r.getContent())
                                .build();
                    });

            ReviewDto.CreateRequest req = ReviewDto.CreateRequest.builder()
                    .orderItemId(1000L).rating(4.5).content("좋아요").build();

            // when
            ReviewDto.Response resp = reviewService.create(EMAIL, req);

            // then
            assertThat(resp.getId()).isEqualTo(999L);
            assertThat(resp.getRating()).isEqualTo(4.5);
            assertThat(resp.getContent()).isEqualTo("좋아요");
            assertThat(resp.isVerifiedPurchase()).isTrue();

            // ArgumentCaptor — save 에 전달된 Review 의 detail 검증
            ArgumentCaptor<Review> captor = ArgumentCaptor.forClass(Review.class);
            verify(reviewRepository).save(captor.capture());
            Review saved = captor.getValue();
            assertThat(saved.getUser().getId()).isEqualTo(1L);
            assertThat(saved.getProduct().getId()).isEqualTo(10L);
            assertThat(saved.getOrderItem().getId()).isEqualTo(1000L);
            assertThat(saved.getRating()).isEqualTo(4.5);
        }

        @Test
        @DisplayName("OrderItem 존재하지 않음 → 404")
        void create_orderItemNotFound() {
            given(orderItemRepository.findById(1000L)).willReturn(Optional.empty());

            ReviewDto.CreateRequest req = ReviewDto.CreateRequest.builder()
                    .orderItemId(1000L).rating(4.5).build();

            assertThatThrownBy(() -> reviewService.create(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("주문 항목을 찾을 수 없습니다")
                    .extracting("status").isEqualTo(HttpStatus.NOT_FOUND);

            verify(reviewRepository, never()).save(any());
        }

        @Test
        @DisplayName("남의 주문에 리뷰 시도 → 403")
        void create_notMyOrder() {
            User me = user(1L, User.Role.USER);
            User otherUser = user(2L, User.Role.USER);
            Order otherOrder = order(100L, otherUser, Order.OrderStatus.DELIVERED);
            OrderItem oi = orderItem(1000L, otherOrder, product(10L));

            given(orderItemRepository.findById(1000L)).willReturn(Optional.of(oi));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(me));

            ReviewDto.CreateRequest req = ReviewDto.CreateRequest.builder()
                    .orderItemId(1000L).rating(4.5).build();

            assertThatThrownBy(() -> reviewService.create(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("본인이 주문한 상품에만")
                    .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);

            verify(reviewRepository, never()).save(any());
        }

        @Test
        @DisplayName("배송 미완료 (PENDING) → 400")
        void create_notDelivered_PENDING() {
            User u = user(1L, User.Role.USER);
            Order o = order(100L, u, Order.OrderStatus.PENDING);
            OrderItem oi = orderItem(1000L, o, product(10L));

            given(orderItemRepository.findById(1000L)).willReturn(Optional.of(oi));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));

            ReviewDto.CreateRequest req = ReviewDto.CreateRequest.builder()
                    .orderItemId(1000L).rating(5.0).build();

            assertThatThrownBy(() -> reviewService.create(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("배송 완료된 주문에만")
                    .hasMessageContaining("PENDING")
                    .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("이미 리뷰 작성됨 → 409 (UNIQUE 사전 체크)")
        void create_alreadyReviewed() {
            User u = user(1L, User.Role.USER);
            Order o = order(100L, u, Order.OrderStatus.DELIVERED);
            OrderItem oi = orderItem(1000L, o, product(10L));

            given(orderItemRepository.findById(1000L)).willReturn(Optional.of(oi));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));
            given(reviewRepository.existsByOrderItemId(1000L)).willReturn(true);

            ReviewDto.CreateRequest req = ReviewDto.CreateRequest.builder()
                    .orderItemId(1000L).rating(5.0).build();

            assertThatThrownBy(() -> reviewService.create(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("이미 리뷰가 작성되어 있습니다")
                    .extracting("status").isEqualTo(HttpStatus.CONFLICT);

            verify(reviewRepository, never()).save(any());
        }

        @Test
        @DisplayName("rating null → 400")
        void create_invalidRating_null() {
            ReviewDto.CreateRequest req = ReviewDto.CreateRequest.builder()
                    .orderItemId(1000L).rating(null).build();

            assertThatThrownBy(() -> reviewService.create(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("rating 은 필수")
                    .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);

            // rating 검증이 가장 먼저 → orderItemRepository 조회 안 함
            verify(orderItemRepository, never()).findById(any());
        }

        @Test
        @DisplayName("rating 범위 초과 (5.5) → 400")
        void create_invalidRating_outOfRange() {
            ReviewDto.CreateRequest req = ReviewDto.CreateRequest.builder()
                    .orderItemId(1000L).rating(5.5).build();

            assertThatThrownBy(() -> reviewService.create(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("1.0 ~ 5.0")
                    .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        @DisplayName("rating 0.5 단위 위반 (3.7) → 400")
        void create_invalidRating_notHalfStep() {
            ReviewDto.CreateRequest req = ReviewDto.CreateRequest.builder()
                    .orderItemId(1000L).rating(3.7).build();

            assertThatThrownBy(() -> reviewService.create(EMAIL, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("0.5 단위")
                    .extracting("status").isEqualTo(HttpStatus.BAD_REQUEST);
        }
    }

    // ═════════════════════════════════════════════════════
    // update() — 도메인 메서드 + dirty checking
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("update() 리뷰 수정")
    class UpdateTest {

        @Test
        @DisplayName("본인 리뷰 수정 → 도메인 메서드 호출 + save() 미호출 (dirty checking)")
        void update_success_dirtyChecking() {
            User u = user(1L, User.Role.USER);
            Review r = review(50L, u, product(10L), orderItem(1000L, order(100L, u, Order.OrderStatus.DELIVERED), product(10L)), 3.0, "원래내용");

            given(reviewRepository.findById(50L)).willReturn(Optional.of(r));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));

            ReviewDto.UpdateRequest req = ReviewDto.UpdateRequest.builder()
                    .rating(5.0).content("바꾼내용").build();

            ReviewDto.Response resp = reviewService.update(EMAIL, 50L, req);

            // 도메인 메서드 호출 결과 확인
            assertThat(r.getRating()).isEqualTo(5.0);
            assertThat(r.getContent()).isEqualTo("바꾼내용");
            assertThat(resp.getRating()).isEqualTo(5.0);

            // 핵심 검증 — save() 호출 안 됨 (dirty checking 으로 자동 UPDATE)
            verify(reviewRepository, never()).save(any());
        }

        @Test
        @DisplayName("타인 리뷰 수정 시도 → 403")
        void update_notOwner() {
            User me = user(1L, User.Role.USER);
            User author = user(2L, User.Role.USER);
            Review r = review(50L, author, product(10L), orderItem(1000L, order(100L, author, Order.OrderStatus.DELIVERED), product(10L)), 3.0, "원래");

            given(reviewRepository.findById(50L)).willReturn(Optional.of(r));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(me));

            ReviewDto.UpdateRequest req = ReviewDto.UpdateRequest.builder()
                    .rating(1.0).content("악의적 수정").build();

            assertThatThrownBy(() -> reviewService.update(EMAIL, 50L, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("본인이 작성한 리뷰만")
                    .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);

            // 원본 변경 안 됨
            assertThat(r.getRating()).isEqualTo(3.0);
            assertThat(r.getContent()).isEqualTo("원래");
        }
    }

    // ═════════════════════════════════════════════════════
    // delete() — 본인/ADMIN/타인 분기
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("delete() 리뷰 삭제")
    class DeleteTest {

        @Test
        @DisplayName("본인 삭제 → 정상")
        void delete_byOwner() {
            User u = user(1L, User.Role.USER);
            Review r = review(50L, u, product(10L), orderItem(1000L, order(100L, u, Order.OrderStatus.DELIVERED), product(10L)), 5.0, "good");

            given(reviewRepository.findById(50L)).willReturn(Optional.of(r));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(u));

            reviewService.delete(EMAIL, 50L);

            verify(reviewRepository, times(1)).delete(r);
        }

        @Test
        @DisplayName("ADMIN 이 타인 리뷰 삭제 → 정상")
        void delete_byAdmin() {
            User admin = user(99L, User.Role.ADMIN);
            User author = user(1L, User.Role.USER);
            Review r = review(50L, author, product(10L), orderItem(1000L, order(100L, author, Order.OrderStatus.DELIVERED), product(10L)), 5.0, "good");

            given(reviewRepository.findById(50L)).willReturn(Optional.of(r));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(admin));

            reviewService.delete(EMAIL, 50L);

            verify(reviewRepository, times(1)).delete(r);
        }

        @Test
        @DisplayName("일반 사용자가 타인 리뷰 삭제 시도 → 403")
        void delete_byOther_forbidden() {
            User me = user(1L, User.Role.USER);
            User author = user(2L, User.Role.USER);
            Review r = review(50L, author, product(10L), orderItem(1000L, order(100L, author, Order.OrderStatus.DELIVERED), product(10L)), 5.0, "good");

            given(reviewRepository.findById(50L)).willReturn(Optional.of(r));
            given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(me));

            assertThatThrownBy(() -> reviewService.delete(EMAIL, 50L))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("본인 리뷰만 삭제")
                    .extracting("status").isEqualTo(HttpStatus.FORBIDDEN);

            verify(reviewRepository, never()).delete(any());
        }
    }

    // ═════════════════════════════════════════════════════
    // getReviewsByProduct + getReviewStats
    // ═════════════════════════════════════════════════════

    @Nested
    @DisplayName("조회 / 통계")
    class QueryTest {

        @Test
        @DisplayName("getReviewsByProduct — Page → PagedResponse 변환")
        void getReviewsByProduct_returnsPagedResponse() {
            User u = user(1L, User.Role.USER);
            Product p = product(10L);
            Review r = review(50L, u, p, orderItem(1000L, order(100L, u, Order.OrderStatus.DELIVERED), p), 4.0, "ok");
            Pageable pageable = PageRequest.of(0, 10);
            Page<Review> page = new PageImpl<>(List.of(r), pageable, 1);

            given(productRepository.existsById(10L)).willReturn(true);
            given(reviewRepository.findByProductId(10L, pageable)).willReturn(page);

            PagedResponse<ReviewDto.Response> resp = reviewService.getReviewsByProduct(10L, pageable);

            // PagedResponse 9 필드 일관성 확인 (PageImpl WARN 청산 검증)
            assertThat(resp.getContent()).hasSize(1);
            assertThat(resp.getContent().get(0).getRating()).isEqualTo(4.0);
            assertThat(resp.getTotalElements()).isEqualTo(1L);
            assertThat(resp.getPage()).isZero();
            assertThat(resp.getSize()).isEqualTo(10);
            assertThat(resp.isFirst()).isTrue();
            assertThat(resp.isLast()).isTrue();
            assertThat(resp.getNumberOfElements()).isEqualTo(1);
            assertThat(resp.isEmpty()).isFalse();
        }

        @Test
        @DisplayName("getReviewStats — 빈 버킷 보정 (DB GAP → 5개 키 0L)")
        void getReviewStats_emptyBucketsNormalized() {
            given(productRepository.existsById(10L)).willReturn(true);
            given(reviewRepository.countByProductId(10L)).willReturn(3L);
            given(reviewRepository.findAverageRatingByProductId(10L)).willReturn(4.333);
            // DB 가 4★, 5★ 버킷만 반환 (1★~3★ 버킷 row 없음)
            given(reviewRepository.findRatingDistributionByProductId(10L))
                    .willReturn(List.of(
                            new Object[]{4, 1L},
                            new Object[]{5, 2L}
                    ));

            var stats = reviewService.getReviewStats(10L);

            assertThat(stats.getProductId()).isEqualTo(10L);
            assertThat(stats.getTotalCount()).isEqualTo(3L);
            assertThat(stats.getAverageRating()).isEqualTo(4.3); // 4.333 → 반올림 4.3
            assertThat(stats.getDistribution())
                    .containsEntry(1, 0L)
                    .containsEntry(2, 0L)
                    .containsEntry(3, 0L)
                    .containsEntry(4, 1L)
                    .containsEntry(5, 2L);
            assertThat(stats.getDistribution()).hasSize(5);
        }
    }
}
