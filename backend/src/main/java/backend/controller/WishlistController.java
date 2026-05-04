package backend.controller;

import backend.dto.PagedResponse;
import backend.dto.WishlistDto;
import backend.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 찜(Wishlist) 컨트롤러 (B4).
 *
 * 엔드포인트:
 *   POST /api/products/{productId}/wishlist  — 토글 (인증 필요)
 *   GET  /api/wishlist                       — 내 찜 목록 (인증 필요, 페이징)
 *
 * 토글 경로를 /api/wishlist 가 아닌 /api/products/{productId}/wishlist 로 둔 이유:
 *   - RESTful: 찜은 product 의 부속 리소스
 *   - 클라이언트 일관성: like 와 동일 형태 (/products/:id/like, /products/:id/wishlist)
 *   - 목록 조회는 사용자 컨텍스트라 /api/wishlist (URL 의 user 는 토큰에서 추출)
 *
 * Security: 두 엔드포인트 모두 인증 필요. SecurityConfig 에서 등록.
 */
@RestController
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    /** 찜 토글 */
    @PostMapping("/api/products/{productId}/wishlist")
    public ResponseEntity<WishlistDto.ToggleResponse> toggle(
            @PathVariable Long productId,
            Authentication authentication) {
        String email = authentication.getName();
        WishlistDto.ToggleResponse response = wishlistService.toggle(email, productId);
        return ResponseEntity.ok(response);
    }

    /** 내 찜 목록 (최신순 페이징) */
    @GetMapping("/api/wishlist")
    public ResponseEntity<PagedResponse<WishlistDto.Item>> getMyWishlist(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable,
            Authentication authentication) {
        String email = authentication.getName();
        PagedResponse<WishlistDto.Item> response = wishlistService.getMyWishlist(email, pageable);
        return ResponseEntity.ok(response);
    }
}
