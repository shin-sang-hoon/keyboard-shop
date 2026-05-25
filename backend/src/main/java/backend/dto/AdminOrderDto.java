package backend.dto;

import backend.entity.Order;
import backend.entity.OrderItem;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 관리자 주문 관리 DTO (Phase 7-G 라운드 6).
 *
 * 중첩 구조:
 *   - AdminOrderDto.ListItem            : 주문 목록 응답 1행
 *   - AdminOrderDto.StatusUpdateRequest : 주문 상태 변경 요청 body
 *
 * 목록은 상품 상세를 펼치지 않고 "대표 상품명 + N건" 으로 요약한다.
 *   Order(1):OrderItem(N) 컬렉션을 페이징과 함께 fetch 하면 Hibernate 가
 *   메모리 페이징을 하므로, 컬렉션은 LAZY 로 두고 Service 트랜잭션 안에서
 *   요약 문자열만 만든다.
 */
public final class AdminOrderDto {

    private AdminOrderDto() {}

    /**
     * 주문 목록 1행.
     */
    public record ListItem(
            Long id,
            String userEmail,        // 주문자 (탈퇴/null 가드)
            String itemSummary,      // "기계식 키보드 외 2건" 형태
            int itemCount,           // 주문 상품 종류 수
            int totalPrice,
            String status,           // PENDING / PAID / SHIPPING / DELIVERED / CANCELLED
            LocalDateTime createdAt
    ) {
        /**
         * Order → ListItem 변환.
         * @Transactional 안에서 호출해야 한다 (items LAZY 초기화 발생).
         */
        public static ListItem from(Order o) {
            List<OrderItem> items = o.getItems();
            int count = (items == null) ? 0 : items.size();

            String summary;
            if (count == 0) {
                summary = "(주문 상품 없음)";
            } else {
                String firstName = items.get(0).getProduct() != null
                        ? items.get(0).getProduct().getName()
                        : "(상품 정보 없음)";
                summary = (count == 1)
                        ? firstName
                        : firstName + " 외 " + (count - 1) + "건";
            }

            return new ListItem(
                    o.getId(),
                    o.getUser() != null ? o.getUser().getEmail() : null,
                    summary,
                    count,
                    o.getTotalPrice(),
                    o.getStatus() != null ? o.getStatus().name() : null,
                    o.getCreatedAt()
            );
        }
    }

    /**
     * 주문 상태 변경 요청 body.
     * PATCH /api/admin/orders/{id}/status  { "status": "SHIPPING" }
     */
    public record StatusUpdateRequest(
            String status          // PENDING / PAID / SHIPPING / DELIVERED / CANCELLED
    ) {
    }
}
