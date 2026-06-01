package backend.service;

import backend.dto.OrderDto;
import backend.dto.ReviewableOrderItemDto;
import backend.entity.Order;
import backend.entity.OrderItem;
import backend.entity.Product;
import backend.entity.User;
import backend.repository.OrderItemRepository;
import backend.repository.OrderRepository;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final BuilderPriceCalculator priceCalculator;

    @Transactional
    public OrderDto.Response createOrder(String email, OrderDto.Request request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        List<OrderItem> items = request.getItems().stream().map(itemReq -> {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다."));

            // 서버측 단가 재계산 (위변조 방어) — 클라가 보낸 가격은 신뢰하지 않고 옵션 ID 로만 계산.
            // 옵션 없으면(일반 상품) null → product.price 를 단가로 사용. cart 와 동일 계산기.
            Integer unitPrice = priceCalculator.calcUnitPrice(
                    product, itemReq.getLayout(), itemReq.getSwitchType(), itemReq.getKeycapColor());
            int effectiveUnit = (unitPrice != null) ? unitPrice
                    : (product.getPrice() != null ? product.getPrice() : 0);

            return OrderItem.builder()
                    .product(product)
                    .quantity(itemReq.getQuantity())
                    .price(effectiveUnit * itemReq.getQuantity())
                    .unitPrice(unitPrice)
                    .layout(itemReq.getLayout())
                    .switchType(itemReq.getSwitchType())
                    .keycapColor(itemReq.getKeycapColor())
                    .caseColor(itemReq.getCaseColor())
                    .build();
        }).collect(Collectors.toList());

        int totalPrice = items.stream().mapToInt(OrderItem::getPrice).sum();

        Order order = Order.builder()
                .user(user)
                .totalPrice(totalPrice)
                .status(Order.OrderStatus.PENDING)
                .build();

        items.forEach(item -> item.setOrder(order));
        order.setItems(items);

        return toResponse(orderRepository.save(order));
    }

    public List<OrderDto.Response> getMyOrders(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
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
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

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

    private OrderDto.Response toResponse(Order order) {
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
