package backend.controller;

import backend.dto.OrderDto;
import backend.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * PortOne V2 결제 API (6/5) — prepare / complete.
 *
 * 주문 조회/생성(OrderController, /api/orders)과 관심사를 분리해 /api/payments 로 둔다.
 * 전 엔드포인트 로그인 필요(@AuthenticationPrincipal). 결제 금액·검증은 전부 서버(PaymentService)가
 * 수행하며, 클라이언트가 보내는 값은 productId/옵션/배송지/ paymentId 로 한정한다(금액 미신뢰).
 *
 * 흐름:
 *   1) prepare/cart   장바구니 → PENDING 주문 + paymentId 발급 → {paymentId, amount, storeId, channelKey}
 *   1) prepare/direct 단건상품 → 〃
 *   2) (프론트) PortOne.requestPayment 로 결제창 → 결제
 *   3) complete       paymentId → PortOne 단건조회 금액검증 → 재고차감 + PAID
 */
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Tag(name = "결제 API", description = "PortOne V2 결제 prepare/complete")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/prepare/cart")
    @Operation(summary = "결제 준비 — 장바구니 기반 (PENDING 주문 생성 + paymentId 발급, 재고 미차감)")
    public ResponseEntity<OrderDto.PrepareResponse> prepareCart(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody OrderDto.PrepareCartRequest request) {
        return ResponseEntity.ok(
                paymentService.prepareCart(userDetails.getUsername(), request));
    }

    @PostMapping("/prepare/direct")
    @Operation(summary = "결제 준비 — 즉시구매 기반 (상품상세·3D빌더, PENDING 주문 생성 + paymentId 발급)")
    public ResponseEntity<OrderDto.PrepareResponse> prepareDirect(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody OrderDto.PrepareDirectRequest request) {
        return ResponseEntity.ok(
                paymentService.prepareDirect(userDetails.getUsername(), request));
    }

    @PostMapping("/complete")
    @Operation(summary = "결제 완료 — PortOne 단건조회 금액검증 → 재고차감 + PAID (실패 시 주문 CANCELLED)")
    public ResponseEntity<OrderDto.Response> complete(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody OrderDto.CompleteRequest request) {
        return ResponseEntity.ok(
                paymentService.complete(userDetails.getUsername(), request));
    }
}
