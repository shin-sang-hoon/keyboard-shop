package backend.dto;

import backend.entity.Order;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

public class OrderDto {

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Request {
        private List<OrderItemRequest> items;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrderItemRequest {
        private Long productId;
        private Integer quantity;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Response {
        private Long id;
        private Integer totalPrice;
        private Order.OrderStatus status;
        private List<OrderItemResponse> items;
        private LocalDateTime createdAt;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrderItemResponse {
        private Long productId;
        private String productName;
        private String productImage;   // 상품 대표 이미지 URL (마이페이지 주문내역 썸네일용)
        private Integer price;
        private Integer quantity;
    }
}