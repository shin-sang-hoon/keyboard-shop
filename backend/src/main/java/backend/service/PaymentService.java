package backend.service;

import backend.dto.OrderDto;
import backend.entity.Cart;
import backend.entity.CartItem;
import backend.entity.Order;
import backend.entity.Product;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.CartRepository;
import backend.repository.OrderRepository;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * PortOne V2 결제 서비스 (6/5) — prepare / complete.
 *
 * 결제 흐름(인증결제)을 두 단계로 오케스트레이션한다:
 *
 *   ① prepare  (prepareCart / prepareDirect)
 *      장바구니 또는 단건 상품을 OrderService.OrderLine 으로 변환 → createPendingOrder 호출로
 *      status=PENDING 주문을 만들고 paymentId 를 발급한다(재고 미차감). 프론트는 응답의
 *      paymentId/amount/storeId/channelKey 로 PortOne 결제창(requestPayment)을 띄운다.
 *
 *   ② complete
 *      결제창 결제 후 프론트가 paymentId 를 보낸다. PortOneClient 로 단건조회하여
 *      "실제 PAID + 금액 일치"를 검증하고, 통과하면 OrderService.confirmPayment 로 재고 차감 +
 *      PENDING→PAID 전환. 검증 실패 시 주문을 CANCELLED 로 막고 예외를 던진다(재고는 PENDING
 *      이라 차감된 적 없으므로 별도 복구 불필요).
 *
 * 설계:
 *  - 주문 무결성(재고 원자 차감·가격 스냅샷)은 OrderService 에 두고, 여기서는 결제 오케스트레이션
 *    (입력→라인 변환, PortOne 검증, 상태 전이 지시)만 담당해 책임을 분리한다.
 *  - cart 입력은 CartService 와 동일하게 서버측 장바구니를 권위 소스로 사용(클라 금액 불신).
 *  - direct 입력은 createOrderDirect 와 동일하게 PurchaseGuard + priceCalculator 로 검증·재계산.
 *  - 금액 검증은 "프론트 신뢰 0" 원칙 — PortOne 원본 금액 vs DB(PENDING 주문) 금액 대조.
 *
 * 면접 자산:
 *  - 결제 위변조 방어: 결제 금액을 클라가 못 정하게 prepare 에서 서버가 산출·저장하고,
 *    complete 에서 PG 원본과 재대조. paymentId 는 서버 발급 + unique 제약.
 *  - 재고 차감 타이밍을 결제 확정(complete) 이후로 미뤄 미결제 주문의 재고 잠금/초과판매 방지.
 *  - 멱등 complete(이미 PAID 면 무동작) — 결제창 콜백 중복/새로고침에도 안전.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PaymentService {

    private final OrderService orderService;
    private final PortOneClient portOneClient;
    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final ProductRepository productRepository;
    private final BuilderPriceCalculator priceCalculator;
    private final PurchaseGuard purchaseGuard;
    private final OrderRepository orderRepository;

    @Value("${portone.store-id}")
    private String storeId;

    @Value("${portone.channel-key}")
    private String channelKey;

    /**
     * 결제 1단계 — 장바구니 기반 PENDING 주문 생성 + paymentId 발급.
     *
     * 서버측 장바구니를 권위 소스로 사용(클라 금액 불신). 각 CartItem 을 OrderLine 으로
     * 변환해 createPendingOrder 에 위임. 장바구니는 결제 완료(complete) 시점이 아니라
     * 여기서 비우지 않는다 — 결제 실패 시 장바구니가 살아 있어야 재시도가 가능하기 때문.
     * (장바구니 비우기는 complete 성공 후 처리.)
     */
    @Transactional
    public OrderDto.PrepareResponse prepareCart(String email, OrderDto.PrepareCartRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다."));

        Cart cart = cartRepository.findByUserIdWithItems(user.getId())
                .orElseThrow(() -> BusinessException.notFound("장바구니를 찾을 수 없습니다."));

        List<CartItem> cartItems = cart.getItems();
        if (cartItems.isEmpty()) {
            throw BusinessException.badRequest("장바구니가 비어 있습니다.");
        }

        List<OrderService.OrderLine> lines = cartItems.stream()
                .map(ci -> OrderService.OrderLine.of(
                        ci.getProduct(), ci.getQuantity(), ci.getUnitPrice(),
                        ci.getLayout(), ci.getSwitchType(), ci.getKeycapColor(), ci.getCaseColor()))
                .collect(Collectors.toList());

        Order pending = orderService.createPendingOrder(
                user, lines, request != null ? request.getShipping() : null);

        return toPrepareResponse(pending);
    }

    /**
     * 결제 1단계 — 즉시구매 기반 PENDING 주문 생성 + paymentId 발급.
     *
     * 단건 상품(+옵션)을 createOrderDirect 와 동일하게 검증(존재·가드)·재계산(단가)한 뒤
     * OrderLine 하나로 createPendingOrder 에 위임. 가격은 받지 않고 서버가 재계산(위변조 차단).
     */
    @Transactional
    public OrderDto.PrepareResponse prepareDirect(String email, OrderDto.PrepareDirectRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다."));

        if (request == null || request.getProductId() == null) {
            throw BusinessException.badRequest("상품 정보가 없습니다.");
        }
        int qty = (request.getQuantity() != null) ? request.getQuantity() : 0;
        if (qty <= 0) {
            throw BusinessException.badRequest("수량은 1개 이상이어야 합니다.");
        }

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> BusinessException.notFound(
                        "상품을 찾을 수 없습니다: " + request.getProductId()));

        // 즉시구매와 동일 가드 (INACTIVE/경매 거부) + 서버 단가 재계산.
        purchaseGuard.validatePurchasable(product);
        Integer unitPrice = priceCalculator.calcUnitPrice(
                product, request.getLayout(), request.getSwitchType(), request.getKeycapColor());

        OrderService.OrderLine line = OrderService.OrderLine.of(
                product, qty, unitPrice,
                request.getLayout(), request.getSwitchType(),
                request.getKeycapColor(), request.getCaseColor());

        Order pending = orderService.createPendingOrder(user, List.of(line), request.getShipping());
        return toPrepareResponse(pending);
    }

    /**
     * 결제 2단계 — 결제완료 검증 + 확정.
     *
     * 프론트가 보낸 paymentId 로:
     *   1) DB 의 PENDING 주문 조회 (없으면 404). 본인 주문인지 확인(타인 결제 확정 차단).
     *   2) 이미 PAID 면 멱등 반환.
     *   3) PortOne 단건조회 → status==PAID && 실결제액==주문금액 검증.
     *      실패 시 주문 CANCELLED + 예외(재고 미차감 상태라 복구 불필요).
     *   4) 통과 → confirmPayment(재고 차감 + PAID). 장바구니 비우기(있으면).
     */
    @Transactional
    public OrderDto.Response complete(String email, OrderDto.CompleteRequest request) {
        if (request == null || request.getPaymentId() == null || request.getPaymentId().isBlank()) {
            throw BusinessException.badRequest("결제 식별자가 없습니다.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다."));

        Order order = orderRepository.findByPaymentIdWithItems(request.getPaymentId())
                .orElseThrow(() -> BusinessException.notFound("주문을 찾을 수 없습니다."));

        // 본인 주문인지 확인 — 타인의 paymentId 로 확정 시도 차단.
        if (order.getUser() == null || !order.getUser().getId().equals(user.getId())) {
            throw BusinessException.badRequest("본인 주문이 아닙니다.");
        }

        // 멱등 — 이미 확정된 주문이면 그대로 반환(결제창 콜백 중복/새로고침 안전).
        if (order.getStatus() == Order.OrderStatus.PAID) {
            return orderService.toResponse(order);
        }

        // PortOne 단건조회 — 권위 있는 결제 원본.
        PortOneClient.PaymentResult payment = portOneClient.getPayment(request.getPaymentId());

        // 검증 1: 실제 결제 완료(PAID) 상태인가.
        // 검증 2: 실결제액 == DB 주문 금액 (위변조 차단의 핵심).
        boolean ok = payment.isPaid() && payment.paidAmount() == order.getTotalPrice();
        if (!ok) {
            // 검증 실패 → 주문 취소(재고는 PENDING 이라 차감된 적 없음). 추적 위해 CANCELLED 로 보존.
            // ★ 별도 트랜잭션(REQUIRES_NEW)으로 취소를 커밋한다 — 아래 throw 로 현재 트랜잭션이
            //   롤백되어도 취소 기록은 남기기 위함. (같은 트랜잭션에서 setStatus 하면 함께 롤백됨.)
            log.warn("[Payment] 검증 실패 → 주문 취소 paymentId={} status={} paidAmount={} orderAmount={}",
                    request.getPaymentId(), payment.status(), payment.paidAmount(), order.getTotalPrice());
            orderService.cancelOrderByPaymentId(request.getPaymentId());
            throw BusinessException.badRequest("결제 검증에 실패했습니다. 결제가 정상 처리되지 않았습니다.");
        }

        // 검증 통과 → 재고 차감 + PAID 전환.
        Order confirmed = orderService.confirmPayment(order, payment.payMethod());

        // 장바구니 결제였다면 비우기 (cart 가 있고 비어있지 않을 때). 단건/이미 빈 cart 는 무시.
        cartRepository.findByUserIdWithItems(user.getId()).ifPresent(cart -> {
            if (!cart.getItems().isEmpty()) {
                cart.getItems().clear();
            }
        });

        return orderService.toResponse(confirmed);
    }

    private OrderDto.PrepareResponse toPrepareResponse(Order pending) {
        return OrderDto.PrepareResponse.builder()
                .orderId(pending.getId())
                .paymentId(pending.getPaymentId())
                .orderName(buildOrderName(pending))
                .amount(pending.getTotalPrice())
                .storeId(storeId)
                .channelKey(channelKey)
                .build();
    }

    /**
     * 결제창에 표시할 주문명 생성. "대표상품명" 또는 "대표상품명 외 N건".
     * 첫 OrderItem 의 상품명을 대표로 쓰고, 품목이 여러 개면 "외 N건"을 붙인다.
     */
    private String buildOrderName(Order order) {
        List<backend.entity.OrderItem> items = order.getItems();
        if (items == null || items.isEmpty()) {
            return "주문";
        }
        String first = items.get(0).getProduct().getName();
        if (items.size() == 1) {
            return first;
        }
        return first + " 외 " + (items.size() - 1) + "건";
    }
}
