package backend.controller;

import backend.dto.PagedResponse;
import backend.dto.ReviewDto;
import backend.dto.ReviewStatsDto;
import backend.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * 리뷰 컨트롤러 (5-H B2 + B5).
 *
 * 라우트 구조:
 *   - GET    /api/products/{id}/reviews         : 상품별 리뷰 목록 (공개, PagedResponse)
 *   - GET    /api/products/{id}/reviews/stats   : 별점 분포 통계 (공개) — B5 신규
 *   - POST   /api/reviews                       : 리뷰 작성 (인증)
 *   - PATCH  /api/reviews/{id}                  : 리뷰 수정 (본인)
 *   - DELETE /api/reviews/{id}                  : 리뷰 삭제 (본인 또는 ADMIN)
 *
 * SecurityConfig:
 *   - GET /api/products/** → permitAll (목록 + stats 둘 다 통과)
 *   - /api/reviews/**     → authenticated
 *
 * 5/3 변경: getProductReviews 반환 타입 Page → PagedResponse (PageImpl 직렬화 WARN 청산).
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Review API", description = "Product reviews with verified purchase + rating stats")
public class ReviewController {

    private final ReviewService reviewService;

    /** 상품별 리뷰 목록 (공개) — PagedResponse 로 직렬화 안전성 보장 */
    @GetMapping("/api/products/{productId}/reviews")
    @Operation(summary = "상품별 리뷰 목록 (페이징, 최신순)")
    public ResponseEntity<PagedResponse<ReviewDto.Response>> getProductReviews(
            @PathVariable Long productId,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ResponseEntity.ok(reviewService.getReviewsByProduct(productId, pageable));
    }

    /**
     * 별점 분포 통계 (공개) — 5-H B5 신규.
     *
     * 응답 예:
     *   {
     *     "productId": 1,
     *     "totalCount": 142,
     *     "averageRating": 4.3,
     *     "distribution": { "1": 5, "2": 8, "3": 12, "4": 47, "5": 70 }
     *   }
     *
     * 리뷰 0건일 때:
     *   { "productId": 1, "totalCount": 0, "averageRating": null,
     *     "distribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } }
     */
    @GetMapping("/api/products/{productId}/reviews/stats")
    @Operation(summary = "별점 분포 통계 (1★~5★ 카운트 + 평균 + 총 개수)")
    public ResponseEntity<ReviewStatsDto> getReviewStats(@PathVariable Long productId) {
        return ResponseEntity.ok(reviewService.getReviewStats(productId));
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
