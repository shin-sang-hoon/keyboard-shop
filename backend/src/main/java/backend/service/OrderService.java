package backend.service;

import backend.dto.OrderDto;
import backend.dto.ReviewableOrderItemDto;
import backend.entity.Cart;
import backend.entity.CartItem;
import backend.entity.Order;
import backend.entity.OrderItem;
import backend.entity.Product;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.CartRepository;
import backend.repository.OrderItemRepository;
import backend.repository.OrderRepository;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final BuilderPriceCalculator priceCalculator;
    private final PurchaseGuard purchaseGuard;

    /**
     * 주문 생성 — 장바구니 기반 (O-1, Cart→Order aggregate).
     *
     * 서버측 장바구니를 권위 있는 소스로 사용한다 — 클라이언트가 보낸 품목 목록은
     * 신뢰하지 않는다(위변조 차단). 장바구니의 각 CartItem 을 중립 주문 라인(OrderLine)
     * 으로 변환한 뒤, 공통 코어 placeOrder 에 위임한다.
     *
     * 즉시구매(createOrderDirect)와 진입점만 다르고 — 장바구니에서 읽느냐, 단건 상품에서
     * 읽느냐 — 그 이후의 재고 가드·원자적 차감·가격 스냅샷·주문 생성은 placeOrder 한 곳을
     * 공유하므로 두 파이프라인의 동작이 코드 레벨에서 강제로 일치한다.
     */
    @Transactional
    public OrderDto.Response createOrderFromCart(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다."));

        // 장바구니를 주문의 단일 진실 공급원으로 사용 (items + product 까지 fetch join).
        Cart cart = cartRepository.findByUserIdWithItems(user.getId())
                .orElseThrow(() -> BusinessException.notFound("장바구니를 찾을 수 없습니다."));

        List<CartItem> cartItems = cart.getItems();
        if (cartItems.isEmpty()) {
            throw BusinessException.badRequest("장바구니가 비어 있습니다.");
        }

        // CartItem → 중립 주문 라인(OrderLine). 가격(unitPrice)은 담을 때 priceCalculator 로
        // 서버 계산되어 CartItem 에 저장된 값을 그대로 사용 (재계산 불필요, 동일 출처).
        List<OrderLine> lines = cartItems.stream()
                .map(ci -> new OrderLine(
                        ci.getProduct(), ci.getQuantity(), ci.getUnitPrice(),
                        ci.getLayout(), ci.getSwitchType(), ci.getKeycapColor(), ci.getCaseColor()))
                .collect(Collectors.toList());

        Order saved = placeOrder(user, lines);

        // 주문 성공 → 장바구니 비우기. Cart.items 는 orphanRemoval=true 라 clear() 만으로
        // cart_items 가 삭제된다. 같은 트랜잭션이므로 주문 저장과 원자적으로 묶인다.
        cart.getItems().clear();

        return toResponse(saved);
    }

    /**
     * 주문 생성 — 즉시구매 (Direct, B-1 6/4).
     *
     * 상품 상세 "구매하기" 및 3D 빌더 "바로구매" 진입점. 장바구니를 거치지 않고 단건
     * 상품(+옵션)을 곧바로 주문한다. 장바구니 경로와 동일한 안전장치를 모두 적용:
     *   1) 상품 존재 확인 (없으면 404)
     *   2) purchaseGuard — INACTIVE/경매 거부 (장바구니 담기와 동일 컴포넌트)
     *   3) priceCalculator — 3D 커스텀 옵션 단가를 서버에서 재계산 (위변조 차단, 동일 컴포넌트)
     *   4) placeOrder 코어 — 원자적 재고 차감 + 409 + 주문 생성 (장바구니와 동일 코어)
     *
     * 클라이언트가 보낸 productId/옵션만 받고, 가격은 절대 신뢰하지 않는다. 수량은 하한(≥1)만
     * 검증하며 상한은 placeOrder 의 원자적 재고 차감(deductStock)이 초과분을 409 로 막는다.
     */
    @Transactional
    public OrderDto.Response createOrderDirect(String email, OrderDto.DirectRequest request) {
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

        // 구매 가능 여부 가드 (INACTIVE 거부 + 핫딜 경매 거부) — 장바구니 담기와 동일 컴포넌트 공유.
        purchaseGuard.validatePurchasable(product);

        // 서버측 단가 재계산 (위변조 방어) — 클라가 보낸 가격은 신뢰하지 않음.
        // 옵션이 없으면(일반 상품) null → placeOrder 가 product.price 를 단가로 사용.
        // 케이스 색은 가격에 영향 없고 OrderItem 스냅샷에만 보존 (장바구니와 동일).
        Integer unitPrice = priceCalculator.calcUnitPrice(
                product, request.getLayout(), request.getSwitchType(), request.getKeycapColor());

        OrderLine line = new OrderLine(
                product, qty, unitPrice,
                request.getLayout(), request.getSwitchType(),
                request.getKeycapColor(), request.getCaseColor());

        Order saved = placeOrder(user, List.of(line));
        return toResponse(saved);
    }

    // =====================================================================
    // PortOne 결제 (6/5) — prepare/complete 2단계
    //
    //  기존 placeOrder(= 재고차감 + PAID 한 방)를 두 단계로 분해한 것:
    //   ┌ createPendingOrder : 가격 스냅샷 + Order(PENDING) 저장 + paymentId 발급. 재고 안 건드림.
    //   └ confirmPayment      : (PaymentService 가 PortOne 단건조회로 금액검증을 끝낸 뒤 호출)
    //                           재고 차감 + PENDING→PAID 전환.
    //  PaymentService 가 cart/direct 입력을 OrderLine 으로 변환해 createPendingOrder 를 호출하고,
    //  결제창 결제 후 PortOne 검증을 통과하면 confirmPayment 를 호출한다.
    //  주문 무결성(재고 원자 차감·가격 스냅샷)은 여전히 이 서비스 한 곳에 집중된다.
    // =====================================================================

    /**
     * 결제 1단계 — PENDING 주문 생성 (재고 미차감).
     *
     * 가격 스냅샷(OrderItem)을 만들고 Order 를 status=PENDING 으로 저장하며 paymentId 를 발급한다.
     * 재고는 여기서 건드리지 않는다 — 실제 결제가 PortOne 에서 완료되고 confirmPayment 의 검증을
     * 통과한 뒤에만 차감한다(결제 안 한 주문이 재고를 잠그는 사고 방지).
     *
     * @param user     주문자 (이미 조회된 엔티티)
     * @param lines    주문 라인 (장바구니/단건 어느 쪽에서 만들어졌든 동일)
     * @param shipping 배송지 정보 (null 가능 — 추후 검증은 호출부 정책)
     * @return 저장된 PENDING Order (paymentId 발급 완료, items 연결됨)
     */
    @Transactional
    public Order createPendingOrder(User user, List<OrderLine> lines, OrderDto.ShippingInfo shipping) {
        List<OrderItem> items = new ArrayList<>();
        for (OrderLine line : lines) {
            Product product = line.product();
            int qty = line.quantity();

            // 가격 스냅샷 — 재고 차감은 하지 않는다(결제 완료 후 confirmPayment 에서).
            Integer unitPrice = line.unitPrice();
            int effectiveUnit = (unitPrice != null) ? unitPrice
                    : (product.getPrice() != null ? product.getPrice() : 0);

            items.add(OrderItem.builder()
                    .product(product)
                    .quantity(qty)
                    .price(effectiveUnit * qty)
                    .unitPrice(unitPrice)
                    .layout(line.layout())
                    .switchType(line.switchType())
                    .keycapColor(line.keycapColor())
                    .caseColor(line.caseColor())
                    .build());
        }

        int totalPrice = items.stream().mapToInt(OrderItem::getPrice).sum();

        // 결제 고유번호 발급 — 가맹점이 생성하는 값. 주문과 1:1.
        // 형식: "swachron-{UUID}". 추측 불가하고 충돌 없음. (payment_id unique 제약과 함께 안전.)
        String paymentId = "swachron-" + java.util.UUID.randomUUID();

        Order.OrderBuilder builder = Order.builder()
                .user(user)
                .totalPrice(totalPrice)
                .status(Order.OrderStatus.PENDING)   // ★ 결제 전 = PENDING (재고 미차감)
                .paymentId(paymentId);

        if (shipping != null) {
            builder.receiverName(shipping.getReceiverName())
                   .receiverPhone(shipping.getReceiverPhone())
                   .postcode(shipping.getPostcode())
                   .address(shipping.getAddress())
                   .addressDetail(shipping.getAddressDetail());
        }

        Order order = builder.build();
        items.forEach(item -> item.setOrder(order));
        order.setItems(items);
        return orderRepository.save(order);
    }

    /**
     * 결제 2단계 — 결제 확정 (재고 차감 + PENDING→PAID).
     *
     * PaymentService 가 PortOne 단건조회로 "실제 결제됨 + 금액 일치"를 검증한 뒤 호출한다.
     * 이 메서드는 그 검증을 신뢰하고 주문을 확정한다:
     *   1) 라인별 원자적 재고 차감 (deductStock — 부족 시 409, 결제는 됐는데 재고가 없는 경우)
     *   2) status PENDING→PAID, payMethod 기록
     * 멱등성: 이미 PAID 면 아무 것도 하지 않고 그대로 반환(complete 중복 호출 안전).
     *
     * @param order     확정할 PENDING 주문 (paymentId 로 조회된 엔티티)
     * @param payMethod PortOne 응답의 결제수단 (표시용, null 가능)
     * @return 확정된(PAID) Order
     */
    @Transactional
    public Order confirmPayment(Order order, String payMethod) {
        // 멱등 처리 — 이미 확정된 주문이면 재차감/재전환하지 않는다.
        if (order.getStatus() == Order.OrderStatus.PAID) {
            return order;
        }
        if (order.getStatus() != Order.OrderStatus.PENDING) {
            throw BusinessException.conflict("결제를 확정할 수 없는 주문 상태입니다.");
        }

        // 재고 차감 — 결제가 실제로 완료된 시점에 비로소 차감(원자적 UPDATE, 부족 시 409).
        for (OrderItem item : order.getItems()) {
            int affected = productRepository.deductStock(item.getProduct().getId(), item.getQuantity());
            if (affected == 0) {
                throw BusinessException.conflict("재고가 부족합니다: " + item.getProduct().getName());
            }
        }

        order.setStatus(Order.OrderStatus.PAID);
        if (payMethod != null) {
            order.setPayMethod(payMethod);
        }
        return order; // 영속 상태 — 트랜잭션 커밋 시 flush (명시 save 불필요하나 무해)
    }

    /**
     * 결제 검증 실패 시 주문 취소 — 독립 트랜잭션(REQUIRES_NEW).
     *
     * PaymentService.complete 가 검증 실패로 예외를 던지기 직전에 호출한다. 호출부의 바깥
     * 트랜잭션은 그 예외로 롤백되므로, 만약 같은 트랜잭션에서 status 를 CANCELLED 로 바꾸면
     * 그 변경도 함께 롤백되어 주문이 PENDING 으로 남는다(추적 불가). 이를 막기 위해
     * REQUIRES_NEW 로 별도 트랜잭션을 열어 CANCELLED 를 독립적으로 커밋한다 — 바깥이 롤백돼도
     * 취소 기록은 보존된다.
     *
     * paymentId 로 주문을 다시 조회하는 이유: 바깥 트랜잭션의 영속 엔티티를 그대로 넘겨받아
     * 수정하면 같은 영속성 컨텍스트라 REQUIRES_NEW 의 격리가 깨질 수 있다. 새 트랜잭션에서
     * 독립적으로 조회→수정→커밋하여 확실히 분리한다. (PENDING 일 때만 취소 — 멱등.)
     *
     * @param paymentId 취소할 주문의 결제 식별자
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void cancelOrderByPaymentId(String paymentId) {
        orderRepository.findByPaymentIdWithItems(paymentId).ifPresent(order -> {
            if (order.getStatus() == Order.OrderStatus.PENDING) {
                order.setStatus(Order.OrderStatus.CANCELLED);
            }
        });
    }

    /**
     * 주문 생성 공통 코어 (단일 진실 원천) — [레거시/mock 경로].
     *
     * ⚠️ PortOne 연동(6/5) 이후 정식 결제 경로는 createPendingOrder + confirmPayment 다.
     * 이 메서드는 결제 없이 즉시 PAID 로 만드는 mock 경로로, createOrderFromCart/createOrderDirect
     * 가 아직 호출한다(하위 호환). PortOne 흐름이 프론트까지 완성되면 호출이 끊긴다.
     *
     * 한 트랜잭션 안에서:
     *   1) 라인별 원자적 재고 차감 (deductStock — UPDATE ... WHERE stock >= qty, 부족 시 409)
     *   2) 가격 스냅샷 — 라인의 unitPrice(서버 계산값) 사용, null 이면 product.price
     *   3) Order 저장 (status=PAID, mock 결제) + OrderItem 연결
     * → 전부 성공 or 전부 롤백 (All-or-Nothing). 재고 차감 후 실패 시 차감도 롤백된다.
     *
     * @param user  주문자 (이미 조회된 엔티티)
     * @param lines 주문 라인 목록 (장바구니/단건 어느 쪽에서 만들어졌든 동일하게 처리)
     * @return 저장된 Order (items 연결 완료)
     */
    private Order placeOrder(User user, List<OrderLine> lines) {
        List<OrderItem> items = new ArrayList<>();
        for (OrderLine line : lines) {
            Product product = line.product();
            int qty = line.quantity();

            // 원자적 재고 차감 — UPDATE ... WHERE stock >= qty 단일 문장이 검사+차감을 동시에.
            // 동시 주문이 마지막 재고를 노려도 DB 가 직렬화 → 초과판매 0. 영향행 0 = 재고 부족.
            int affected = productRepository.deductStock(product.getId(), qty);
            if (affected == 0) {
                throw BusinessException.conflict("재고가 부족합니다: " + product.getName());
            }

            // 가격 스냅샷 — 라인의 unitPrice(옵션 반영, 서버 계산값) 사용.
            // null = 일반 상품 → 현재 product.price. 장바구니 표시 금액(CartDto.ItemView)과 동일.
            Integer unitPrice = line.unitPrice();
            int effectiveUnit = (unitPrice != null) ? unitPrice
                    : (product.getPrice() != null ? product.getPrice() : 0);

            items.add(OrderItem.builder()
                    .product(product)
                    .quantity(qty)
                    .price(effectiveUnit * qty)
                    .unitPrice(unitPrice)
                    .layout(line.layout())
                    .switchType(line.switchType())
                    .keycapColor(line.keycapColor())
                    .caseColor(line.caseColor())
                    .build());
        }

        int totalPrice = items.stream().mapToInt(OrderItem::getPrice).sum();

        Order order = Order.builder()
                .user(user)
                .totalPrice(totalPrice)
                .status(Order.OrderStatus.PAID)   // mock 결제 — "결제하기"/"구매하기" = 결제 완료(PAID)
                .build();
        items.forEach(item -> item.setOrder(order));
        order.setItems(items);
        return orderRepository.save(order);
    }

    /**
     * 주문 생성 코어가 받는 중립 주문 라인.
     *
     * 장바구니(CartItem)에서도, 즉시구매(단건 상품+옵션)에서도 만들 수 있는 공통 입력 타입.
     * 진입점이 자신만의 방식으로 이 라인을 만들어 placeOrder/createPendingOrder 에 넘기면, 코어는
     * 출처를 알 필요 없이 동일하게 처리한다. unitPrice 는 서버 계산값(또는 일반 상품이면 null).
     *
     * PaymentService(결제 prepare)도 이 타입으로 라인을 만들어 createPendingOrder 를 호출하므로
     * public 으로 노출한다. 외부에서 직접 생성하지 않고 of() 정적 팩토리를 쓰도록 권장.
     */
    public record OrderLine(
            Product product,
            int quantity,
            Integer unitPrice,
            String layout,
            String switchType,
            String keycapColor,
            String caseColor) {

        /** 단건(상품+옵션+서버계산 단가)으로 주문 라인 생성. */
        public static OrderLine of(Product product, int quantity, Integer unitPrice,
                                   String layout, String switchType,
                                   String keycapColor, String caseColor) {
            return new OrderLine(product, quantity, unitPrice, layout, switchType, keycapColor, caseColor);
        }
    }

    public List<OrderDto.Response> getMyOrders(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다."));
        // N+1 방어: items + 각 item 의 product 까지 fetch join 으로 한 번에 로딩
        // (페이징 없는 List 라 컬렉션 fetch join 안전, DISTINCT 로 중복 제거).
        return orderRepository.findByUserWithItemsAndProduct(user)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    /**
     * UX P0 (5/28): 현재 사용자의 reviewable OrderItem 후보 조회.
     *
     * ReviewFormModal 진입 시 호출. 5-H A6 의 구매 인증 가드의 SELECT 역방향으로
     * "주문 상품 ID 를 외워 입력" 마찰을 제거. 서버측 4단계 검증은 그대로 유지.
     *
     * Repository 의 JOIN FETCH oi.product 로 N+1 회피. anti-join (NOT EXISTS) 으로
     * 리뷰 미작성 OrderItem 만 1쿼리 필터.
     */
    public List<ReviewableOrderItemDto> getReviewableItems(String email, Long productId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("사용자를 찾을 수 없습니다."));

        List<OrderItem> items = orderItemRepository
                .findReviewableByUserAndProduct(user.getId(), productId);

        return items.stream()
                .map(oi -> ReviewableOrderItemDto.builder()
                        .orderItemId(oi.getId())
                        .productId(oi.getProduct().getId())
                        .productName(oi.getProduct().getName())
                        .productImage(oi.getProduct().getImageUrl())
                        .orderedAt(oi.getOrder().getCreatedAt())
                        .price(oi.getPrice())
                        .quantity(oi.getQuantity())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Order → 응답 DTO 변환. PaymentService(complete 응답)도 재사용하므로 public.
     */
    public OrderDto.Response toResponse(Order order) {
        List<OrderDto.OrderItemResponse> itemResponses = order.getItems().stream()
                .map(item -> OrderDto.OrderItemResponse.builder()
                        .productId(item.getProduct().getId())
                        .productName(item.getProduct().getName())
                        .productImage(item.getProduct().getImageUrl())
                        .price(item.getPrice())
                        .quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice())
                        .layout(item.getLayout())
                        .switchType(item.getSwitchType())
                        .keycapColor(item.getKeycapColor())
                        .caseColor(item.getCaseColor())
                        .build())
                .collect(Collectors.toList());

        return OrderDto.Response.builder()
                .id(order.getId())
                .totalPrice(order.getTotalPrice())
                .status(order.getStatus())
                .items(itemResponses)
                .createdAt(order.getCreatedAt())
                .build();
    }
}
