package backend.controller;

import backend.dto.ReviewDto;
import backend.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * 리뷰 컨트롤러 (5-H B2).
 *
 * 라우트 분리 정책:
 *   - GET /api/products/{productId}/reviews  : product 컨텍스트 종속
 *                                              → /api/products/** permitAll 매칭으로 통과
 *   - POST/PATCH/DELETE /api/reviews/...     : orderItem 기반 CUD
 *                                              → SecurityConfig 별도 등록, authenticated
 *
 * 인증 추출 패턴:
 *   - JwtFilter 가 Spring Security UserDetails (username = email) 를 principal 로 set
 *   - Authentication.getName() = email 추출 → Service 내부에서 UserRepository 재조회
 *   - User 엔티티를 직접 principal 로 안 쓰는 이유: CustomUserDetailsService 가
 *     Spring 표준 UserDetails 빌더로 변환하기 때문
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Review API", description = "Product reviews with verified purchase")
public class ReviewController {

    private final ReviewService reviewService;

    /** 상품별 리뷰 목록 (공개) — /api/products/** permitAll 로 비로그인 접근 가능 */
    @GetMapping("/api/products/{productId}/reviews")
    @Operation(summary = "상품별 리뷰 목록 (페이징, 최신순)")
    public ResponseEntity<Page<ReviewDto.Response>> getProductReviews(
            @PathVariable Long productId,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ResponseEntity.ok(reviewService.getReviewsByProduct(productId, pageable));
    }

    /** 리뷰 작성 — 본인 주문의 배송 완료 상품만 (검증 4단계) */
    @PostMapping("/api/reviews")
    @Operation(summary = "리뷰 작성 — 본인 주문 + 배송 완료 + 1 OrderItem 1 리뷰")
    public ResponseEntity<ReviewDto.Response> create(
            Authentication auth,
            @RequestBody ReviewDto.CreateRequest request) {
        return ResponseEntity.ok(reviewService.create(auth.getName(), request));
    }

    /** 리뷰 수정 — 작성자 본인만 */
    @PatchMapping("/api/reviews/{id}")
    @Operation(summary = "리뷰 수정 — 작성자 본인만 (rating + content)")
    public ResponseEntity<ReviewDto.Response> update(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody ReviewDto.UpdateRequest request) {
        return ResponseEntity.ok(reviewService.update(auth.getName(), id, request));
    }

    /** 리뷰 삭제 — 작성자 본인 또는 ADMIN */
    @DeleteMapping("/api/reviews/{id}")
    @Operation(summary = "리뷰 삭제 — 작성자 본인 또는 ADMIN")
    public ResponseEntity<Void> delete(
            Authentication auth,
            @PathVariable Long id) {
        reviewService.delete(auth.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
