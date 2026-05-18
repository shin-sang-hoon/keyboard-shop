package backend.dto.cart;

import backend.entity.Cart;
import backend.entity.CartItem;
import backend.entity.Product;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 장바구니 DTO (Phase 8 5-D, 5/18).
 *
 * 응답: CartView (Cart + items + totalPrice + totalQuantity)
 * 요청: AddRequest / UpdateQuantityRequest / SyncRequest
 */
public class CartDto {

    // ─── 응답 DTO ──────────────────────────────────────────

    @Getter
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class View {
        private Long id;
        private List<ItemView> items;
        private Integer totalPrice;
        private Integer totalQuantity;
        private LocalDateTime updatedAt;

        public static View from(Cart cart) {
            List<ItemView> itemViews = cart.getItems().stream()
                    .map(ItemView::from)
                    .toList();
            return View.builder()
                    .id(cart.getId())
                    .items(itemViews)
                    .totalPrice(cart.getTotalPrice())
                    .totalQuantity(cart.getTotalQuantity())
                    .updatedAt(cart.getUpdatedAt())
                    .build();
        }
    }

    @Getter
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ItemView {
        private Long itemId;
        private Long productId;
        private String productName;
        private String thumbnailUrl;
        private String brandName;
        private Integer price;
        private Integer quantity;
        private Integer subtotal; // price * quantity
        private LocalDateTime updatedAt;

        public static ItemView from(CartItem item) {
            Product p = item.getProduct();
            Integer price = p != null ? p.getPrice() : 0;
            Integer q = item.getQuantity();
            return ItemView.builder()
                    .itemId(item.getId())
                    .productId(p != null ? p.getId() : null)
                    .productName(p != null ? p.getName() : null)
                    .thumbnailUrl(p != null ? p.getImageUrl() : null)
                    .brandName(p != null && p.getBrand() != null ? p.getBrand().getName() : null)
                    .price(price)
                    .quantity(q)
                    .subtotal(price != null ? price * q : 0)
                    .updatedAt(item.getUpdatedAt())
                    .build();
        }
    }

    // ─── 요청 DTO ──────────────────────────────────────────

    /**
     * POST /api/cart/items 요청 - 상품 1개 담기.
     * quantity 기본 1, 같은 product 이미 있으면 quantity 합산.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class AddRequest {
        private Long productId;
        private Integer quantity = 1;
    }

    /**
     * PATCH /api/cart/items/{itemId} 요청 - 수량 변경.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class UpdateQuantityRequest {
        private Integer quantity;
    }

    /**
     * POST /api/cart/sync 요청 - 비로그인 localStorage 카트 → 서버 머지.
     * 로그인 직후 호출됨. 각 item 을 addItem 으로 처리 (중복 시 합산).
     */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class SyncRequest {
        private List<SyncItem> items;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class SyncItem {
        private Long productId;
        private Integer quantity;
    }

    // ─── 헤더 배지용 ──────────────────────────────────────

    /**
     * Header Cart 배지용 가벼운 응답.
     * GET /api/cart/count - 총 quantity 합만 반환.
     */
    @Getter
    @Builder
    public static class CountView {
        private Long count;
    }
}
