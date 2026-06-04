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

    /**
     * 즉시구매 요청 (Direct, B-1 6/4).
     *
     * 상품 상세 "구매하기" 및 3D 빌더 "바로구매" 가 보내는 단건 주문 바디.
     * 장바구니를 거치지 않고 상품 하나(+옵션)를 곧바로 주문한다.
     *
     * 서버는 productId·quantity·옵션만 신뢰하고 가격은 받지 않는다 — 단가는
     * BuilderPriceCalculator 가 서버에서 재계산한다(위변조 차단). 일반 상품은 옵션 필드가
     * 모두 null 이며, 3D 커스텀 빌드는 layout/switchType/keycapColor 로 단가가 가산된다
     * (caseColor 는 가격 무관, 스냅샷 표시용).
     */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DirectRequest {
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