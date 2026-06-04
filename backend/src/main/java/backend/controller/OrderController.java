package backend.controller;

import backend.dto.OrderDto;
import backend.dto.ReviewableOrderItemDto;
import backend.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@Tag(name = "주문 API", description = "주문 생성 및 조회")
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    @Operation(summary = "주문 생성 — 장바구니 기반 (Cart→Order: 서버 장바구니 기반, status=PAID mock)")
    public ResponseEntity<OrderDto.Response> createOrder(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(orderService.createOrderFromCart(userDetails.getUsername()));
    }

    @PostMapping("/direct")
    @Operation(summary = "주문 생성 — 즉시구매 (상품상세 '구매하기'·3D 빌더 '바로구매', 장바구니 미경유, status=PAID mock)")
    public ResponseEntity<OrderDto.Response> createOrderDirect(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody OrderDto.DirectRequest request) {
        return ResponseEntity.ok(
                orderService.createOrderDirect(userDetails.getUsername(), request));
    }

    @GetMapping("/my")
    @Operation(summary = "내 주문 목록 조회")
    public ResponseEntity<List<OrderDto.Response>> getMyOrders(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(orderService.getMyOrders(userDetails.getUsername()));
    }

    /**
     * UX P0 (5/28): 리뷰 작성 가능한 OrderItem 후보 조회.
     *
     * ReviewFormModal 진입 시 호출 — 사용자가 "주문 상품 ID" 를 외워 입력하는
     * 마찰을 제거하기 위해, 현재 상품(productId)에 대해 본인이 구매·배송완료한
     * 후보 OrderItem 목록을 자동으로 fetch.
     *
     * 결과:
     *   - 0개 → 모달 상단에 "구매 이력 없음" 안내 + 등록 버튼 disabled
     *   - 1개 → 자동 선택, 주문일·가격 카드만 표시
     *   - 2개+ → 라디오 카드로 선택 (재구매 시나리오)
     */
    @GetMapping("/my/reviewable-items")
    @Operation(summary = "리뷰 작성 가능한 OrderItem 후보 조회")
    public ResponseEntity<List<ReviewableOrderItemDto>> getReviewableItems(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam Long productId) {
        return ResponseEntity.ok(
                orderService.getReviewableItems(userDetails.getUsername(), productId));
    }
}
