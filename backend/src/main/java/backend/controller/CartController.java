package backend.controller;

import backend.dto.cart.CartDto;
import backend.service.CartService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * 장바구니 REST API (Phase 8 5-D, 5/18).
 *
 * 인증 필수 — 모든 endpoint 는 로그인 사용자만 접근 가능.
 * 비로그인 시 401 응답 (Spring Security ExceptionTranslationFilter).
 *
 * Endpoints:
 *   GET    /api/cart            - 현재 사용자 카트 조회
 *   GET    /api/cart/count      - 헤더 배지용 quantity 합
 *   POST   /api/cart/items      - 상품 담기
 *   PATCH  /api/cart/items/{id} - 수량 변경
 *   DELETE /api/cart/items/{id} - 카트 아이템 삭제
 *   DELETE /api/cart            - 카트 비우기
 *   POST   /api/cart/sync       - 비로그인 localStorage → 서버 머지 (로그인 직후)
 */
@Slf4j
@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    // ─── 조회 ────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<CartDto.View> getCart(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(cartService.getCart(userDetails.getUsername()));
    }

    @GetMapping("/count")
    public ResponseEntity<CartDto.CountView> getCount(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(cartService.getCount(userDetails.getUsername()));
    }

    // ─── 변경 ────────────────────────────────────────────

    @PostMapping("/items")
    public ResponseEntity<CartDto.View> addItem(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody CartDto.AddRequest request) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        int quantity = request.getQuantity() != null ? request.getQuantity() : 1;
        CartDto.View updated = cartService.addItem(
                userDetails.getUsername(), request.getProductId(), quantity);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/items/{itemId}")
    public ResponseEntity<CartDto.View> updateQuantity(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long itemId,
            @RequestBody CartDto.UpdateQuantityRequest request) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        if (request.getQuantity() == null) {
            return ResponseEntity.badRequest().build();
        }
        CartDto.View updated = cartService.updateQuantity(
                userDetails.getUsername(), itemId, request.getQuantity());
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<CartDto.View> removeItem(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long itemId) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        CartDto.View updated = cartService.removeItem(userDetails.getUsername(), itemId);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping
    public ResponseEntity<CartDto.View> clear(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        CartDto.View updated = cartService.clear(userDetails.getUsername());
        return ResponseEntity.ok(updated);
    }

    // ─── Sync (비로그인 → 로그인 머지) ──────────────────

    @PostMapping("/sync")
    public ResponseEntity<CartDto.View> sync(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody CartDto.SyncRequest request) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        CartDto.View merged = cartService.sync(userDetails.getUsername(), request.getItems());
        return ResponseEntity.ok(merged);
    }
}
