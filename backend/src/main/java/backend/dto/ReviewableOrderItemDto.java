package backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 리뷰 작성 가능한 OrderItem 응답 DTO (UX P0, 5/28).
 *
 * 사용 시나리오:
 *   ReviewFormModal 진입 시 GET /api/orders/my/reviewable-items?productId=X 호출.
 *   조건:
 *     1) 현재 로그인 사용자의 주문
 *     2) 주문 상태 = DELIVERED
 *     3) productId 일치 (현재 상품 상세 페이지에서 클릭한 상품)
 *     4) 아직 리뷰 작성 안 함 (NOT EXISTS Review)
 *
 * 5-H A6 의 구매 인증 3중 가드를 SELECT 조건으로 뒤집어
 * "사용자에게 후보를 미리 보여주는" UX 로 전환한 결과.
 * 결과 0개 = 등록 버튼 disabled, 1개 = 자동 선택, 2개+ = 재구매 시나리오 → 라디오 카드.
 *
 * 면접 talking point:
 *   "5-H 의 구매 인증 가드는 서버 검증을 떠나, UX 차원에서
 *    사용자가 'ID 를 외워 적는' 마찰을 만들었던 잔재가 있었음.
 *    가드의 SELECT 역방향으로 후보를 미리 노출 → 마찰 제거하면서
 *    서버측 4단계 검증은 그대로 유지 (defense in depth)."
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewableOrderItemDto {
    private Long orderItemId;
    private Long productId;
    private String productName;
    private String productImage;   // products.image_url (nullable)
    private LocalDateTime orderedAt;  // orders.created_at — 배송완료 시각은 현재 스키마에 없음 (부채)
    private int price;             // OrderItem.price (이미 quantity 곱해진 합산값)
    private int quantity;
}
