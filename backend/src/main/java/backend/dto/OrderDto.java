package backend.dto;

import backend.entity.Order;
import com.fasterxml.jackson.annotation.JsonInclude;
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
        // 3D 빌더 커스텀 옵션 (일반 상품은 null)
        private String layout;
        private String switchType;
        private String keycapColor;
        private String caseColor;
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
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class OrderItemResponse {
        private Long productId;
        private String productName;
        private String productImage;   // 상품 대표 이미지 URL (마이페이지 주문내역 썸네일용)
        private Integer price;         // 합계 금액 (unitPrice × quantity)
        private Integer quantity;
        private Integer unitPrice;     // 옵션 반영 개당 단가 (일반 상품은 product.price)
        // 3D 빌더 커스텀 옵션 (일반 상품은 null → JSON 생략)
        private String layout;
        private String switchType;
        private String keycapColor;
        private String caseColor;
    }
}