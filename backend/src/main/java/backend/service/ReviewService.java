package backend.service;

import backend.dto.PagedResponse;
import backend.dto.ReviewDto;
import backend.dto.ReviewStatsDto;
import backend.entity.Order;
import backend.entity.OrderItem;
import backend.entity.Review;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.OrderItemRepository;
import backend.repository.ProductRepository;
import backend.repository.ReviewRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 리뷰 도메인 서비스 (5-H A6 + B2 + B5).
 *
 * A6 create() 검증 4단계:
 *   1) OrderItem 존재? → 404
 *   2) OrderItem.order.user.id == 현재 사용자? → 403 (남의 주문 X)
 *   3) Order.status == DELIVERED? → 400 (배송 미완료 X)
 *   4) 이 OrderItem 에 이미 리뷰? → 409 (중복 X)
 *
 * 면접 포인트:
 *   - DB UNIQUE(order_item_id) 가 최후 안전망 (race condition 대응)
 *   - Service 사전 체크 4단계는 깔끔한 비즈니스 예외 변환 (UX)
 *   - "구매 인증 리뷰" 도메인 룰을 DB 제약 + Service 검증 2중으로 인코딩
 *
 * rating 검증: 1.0 ~ 5.0, 0.5 단위 — rating * 2 가 정수여야 함
 *
 * B5 별점 분포:
 *   - SQL FLOOR(rating) 으로 1~5 정수 버킷 정규화
 *   - 빈 버킷도 0 으로 명시 응답 (프론트가 0% 막대 그릴 수 있도록)
 *   - totalCount + averageRating 따로 집계 (분포 GROUP BY 와 결합 어려움)
 *
 * B2 PageImpl WARN 청산:
 *   - getReviewsByProduct 반환 타입 Page → PagedResponse (4/27 ProductService 패턴 일관)
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    // ─────────────────────────────────────────────────────
    // 조회 (B2)
    // ─────────────────────────────────────────────────────

    /**
     * 상품별 리뷰 페이지 — PagedResponse 직접 반환 (PageImpl WARN 회피).
     */
    public PagedResponse<ReviewDto.Response> getReviewsByProduct(Long productId, Pageable pageable) {
        if (!productRepository.existsById(productId)) {
            throw BusinessException.notFound("상품을 찾을 수 없습니다: " + productId);
        }
        Page<ReviewDto.Response> page = reviewRepository.findByProductId(productId, pageable)
                .map(ReviewDto.Response::from);
        return PagedResponse.from(page);
    }

    // ─────────────────────────────────────────────────────
    // 통계 (B5)
    // ─────────────────────────────────────────────────────

    /**
     * 별점 분포 통계 — 2 쿼리 (count+avg, distribution).
     *
     * 분포 GROUP BY FLOOR 와 전체 평균/카운트는 SQL 1쿼리로 합치기 어려움
     * (GROUP BY 적용된 row 별 AVG 가 되어버림). MySQL ROLLUP 으로 가능하지만
     * 코드 복잡도 증가 → 명료성 위해 2 쿼리로 분리.
     */
    public ReviewStatsDto getReviewStats(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw BusinessException.notFound("상품을 찾을 수 없습니다: " + productId);
        }

        // 1) 전체 카운트 + 평균
        long totalCount = reviewRepository.countByProductId(productId);
        Double averageRating = reviewRepository.findAverageRatingByProductId(productId);
        // 평균은 소수점 1자리로 반올림 (4.34 → 4.3)
        if (averageRating != null) {
            averageRating = Math.round(averageRating * 10.0) / 10.0;
        }

        // 2) 별점 분포 (1~5 버킷)
        List<Object[]> rawDistribution = reviewRepository.findRatingDistributionByProductId(productId);
        Map<Integer, Long> distribution = ReviewStatsDto.normalizeDistribution(rawDistribution);

        return ReviewStatsDto.builder()
                .productId(productId)
                .totalCount(totalCount)
                .averageRating(averageRating)
                .distribution(distribution)
                .build();
    }

    // ─────────────────────────────────────────────────────
    // CUD (A6 + B2)
    // ─────────────────────────────────────────────────────

    @Transactional
    public ReviewDto.Response create(String currentUserEmail, ReviewDto.CreateRequest request) {
        validateRating(request.getRating());

        // 1) OrderItem 존재? — EntityGraph 로 order/user/product 한 번에 fetch
        OrderItem orderItem = orderItemRepository.findById(request.getOrderItemId())
                .orElseThrow(() -> BusinessException.notFound(
                        "주문 항목을 찾을 수 없습니다: " + request.getOrderItemId()));

        User currentUser = findUserByEmail(currentUserEmail);

        // 2) 작성자 == 주문자?
        Long orderUserId = orderItem.getOrder().getUser().getId();
        if (!orderUserId.equals(currentUser.getId())) {
            throw BusinessException.forbidden("본인이 주문한 상품에만 리뷰를 작성할 수 있습니다.");
        }

        // 3) 배송 완료?
        Order.OrderStatus status = orderItem.getOrder().getStatus();
        if (status != Order.OrderStatus.DELIVERED) {
            throw BusinessException.badRequest(
                    "배송 완료된 주문에만 리뷰를 작성할 수 있습니다. (현재 상태: " + status + ")");
        }

        // 4) 이미 리뷰 있나?
        if (reviewRepository.existsByOrderItemId(orderItem.getId())) {
            throw BusinessException.conflict(
                    "이 주문 항목에는 이미 리뷰가 작성되어 있습니다. (orderItemId: "
                            + orderItem.getId() + ")");
        }

        Review review = Review.builder()
                .user(currentUser)
                .product(orderItem.getProduct())
                .orderItem(orderItem)
                .rating(request.getRating())
                .content(request.getContent())
                .build();

        return ReviewDto.Response.from(reviewRepository.save(review));
    }

    @Transactional
    public ReviewDto.Response update(String currentUserEmail, Long reviewId,
                                     ReviewDto.UpdateRequest request) {
        validateRating(request.getRating());

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> BusinessException.notFound(
                        "리뷰를 찾을 수 없습니다: " + reviewId));

        User currentUser = findUserByEmail(currentUserEmail);

        if (!review.getUser().getId().equals(currentUser.getId())) {
            throw BusinessException.forbidden("본인이 작성한 리뷰만 수정할 수 있습니다.");
        }

        // 도메인 메서드 호출 — dirty checking 으로 자동 UPDATE 발행 (save 불필요)
        review.updateContent(request.getRating(), request.getContent());

        return ReviewDto.Response.from(review);
    }

    @Transactional
    public void delete(String currentUserEmail, Long reviewId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> BusinessException.notFound(
                        "리뷰를 찾을 수 없습니다: " + reviewId));

        User currentUser = findUserByEmail(currentUserEmail);

        // 본인 또는 ADMIN 만 삭제 가능
        boolean isOwner = review.getUser().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getRole() == User.Role.ADMIN;
        if (!isOwner && !isAdmin) {
            throw BusinessException.forbidden("본인 리뷰만 삭제할 수 있습니다.");
        }

        reviewRepository.delete(review);
    }

    // ─────────────────────────────────────────────────────
    // 내부 helper
    // ─────────────────────────────────────────────────────

    /** rating 검증 — 1.0 ~ 5.0, 0.5 단위 */
    private void validateRating(Double rating) {
        if (rating == null) {
            throw BusinessException.badRequest("rating 은 필수입니다.");
        }
        if (rating < 1.0 || rating > 5.0) {
            throw BusinessException.badRequest(
                    "rating 은 1.0 ~ 5.0 사이여야 합니다. (입력: " + rating + ")");
        }
        // 0.5 단위 검증 — rating * 2 가 정수여야 함
        double doubled = rating * 2;
        if (doubled != Math.floor(doubled)) {
            throw BusinessException.badRequest(
                    "rating 은 0.5 단위여야 합니다. (입력: " + rating + ")");
        }
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다: " + email));
    }
}
