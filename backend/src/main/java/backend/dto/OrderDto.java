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

    // =====================================================================
    // PortOne V2 결제 (6/5) — prepare / complete
    // =====================================================================

    /**
     * 배송지 입력 정보. prepare 요청에 실려 PENDING 주문과 함께 저장된다.
     * 회원정보의 기본 주소와 별개로, 주문마다 다른 주소를 받을 수 있다.
     */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ShippingInfo {
        private String receiverName;
        private String receiverPhone;
        private String postcode;
        private String address;
        private String addressDetail;
    }

    /**
     * 결제 1단계(prepare) — 장바구니 기반.
     *
     * 서버측 장바구니를 권위 소스로 PENDING 주문을 만들고 paymentId 를 발급한다.
     * 클라이언트는 배송지만 보낸다(상품/금액은 서버가 장바구니에서 산출 — 위변조 차단).
     */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PrepareCartRequest {
        private ShippingInfo shipping;
    }

    /**
     * 결제 1단계(prepare) — 즉시구매 기반.
     *
     * 단건 상품(+옵션) + 배송지를 받아 PENDING 주문을 만들고 paymentId 를 발급한다.
     * 상품/옵션 필드는 기존 DirectRequest 와 동일하며 가격은 받지 않는다(서버 재계산).
     */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PrepareDirectRequest {
        private Long productId;
        private Integer quantity;
        private String layout;
        private String switchType;
        private String keycapColor;
        private String caseColor;
        private ShippingInfo shipping;
    }

    /**
     * 결제 1단계 응답(prepare → 프론트).
     *
     * 프론트는 이 값으로 PortOne 결제창(requestPayment)을 띄운다. paymentId 는 서버가
     * 발급한 결제 고유번호이고, storeId/channelKey 는 결제창 호출에 필요한 상점 식별값이다.
     * amount 는 서버가 산출한 결제 금액(프론트 표시 및 결제창 totalAmount 로 사용).
     */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PrepareResponse {
        private Long orderId;       // 생성된 PENDING 주문 id
        private String paymentId;   // 가맹점 발급 결제 고유번호
        private String orderName;   // 결제창에 표시될 주문명 (예: "키크론 K10 외 2건")
        private Integer amount;     // 결제 금액 (서버 산출)
        private String storeId;     // PortOne 상점 id (결제창 호출용)
        private String channelKey;  // PortOne 채널 키 (결제창 호출용)
    }

    /**
     * 결제 2단계 요청(complete).
     *
     * 결제창에서 결제가 끝난 뒤 프론트가 paymentId 를 보낸다. 서버는 이 값으로 포트원에
     * 단건조회하여 실결제액과 DB(PENDING 주문) 금액을 대조하고, 일치하면 재고 차감 + PAID 로 전환한다.
     */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CompleteRequest {
        private String paymentId;
    }

    // =====================================================================

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Response {
        private Long id;
        private Integer totalPrice;
        private Order.OrderStatus status;
        private List<OrderItemResponse> items;
        private LocalDateTime createdAt;
        // 결제/배송 정보 (PortOne, 6/5) — 없으면 JSON 생략
        private String paymentId;
        private String payMethod;
        private String receiverName;
        private String receiverPhone;
        private String postcode;
        private String address;
        private String addressDetail;
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
