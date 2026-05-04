package backend.controller;

import backend.dto.ProductLikeDto;
import backend.service.ProductLikeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 좋아요 컨트롤러 (B4).
 *
 * 엔드포인트:
 *   POST /api/products/{productId}/like        — 토글 (인증 필요)
 *   GET  /api/products/{productId}/like/count  — 카운트 (public)
 *
 * Security 정책 — 두 경로 분리:
 *   - count 는 비로그인 사용자도 조회 (♥ 표시)
 *   - 토글은 로그인 필수 (UNIQUE 가 user_id 기반)
 *   → SecurityConfig 에서 두 경로 별도 등록.
 *
 * 사용자 식별:
 *   - Authentication.getName() 으로 email 추출
 *   - ReviewController 와 동일 패턴
 */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductLikeController {

    private final ProductLikeService productLikeService;

    /** 좋아요 토글 (인증 필요) */
    @PostMapping("/{productId}/like")
    public ResponseEntity<ProductLikeDto.ToggleResponse> toggle(
            @PathVariable Long productId,
            Authentication authentication) {
        String email = authentication.getName();
        ProductLikeDto.ToggleResponse response = productLikeService.toggle(email, productId);
        return ResponseEntity.ok(response);
    }

    /** 좋아요 카운트 (public) */
    @GetMapping("/{productId}/like/count")
    public ResponseEntity<ProductLikeDto.CountResponse> getCount(
            @PathVariable Long productId) {
        ProductLikeDto.CountResponse response = productLikeService.getCount(productId);
        return ResponseEntity.ok(response);
    }
}
