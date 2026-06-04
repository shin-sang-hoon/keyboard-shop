package backend.service;

import backend.entity.Auction;
import backend.entity.Product;
import backend.exception.BusinessException;
import backend.repository.AuctionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 구매 가능 여부 가드 (단일 진실 원천, B-1 6/4).
 *
 * "이 상품을 장바구니에 담거나 주문할 수 있는가?" 라는 판정의 단일 책임 컴포넌트.
 * 장바구니 담기(CartService.addItem)와 즉시구매 주문(OrderService.createOrderDirect)이
 * 모두 이 한 곳을 호출하므로, 어느 경로로 들어와도 구매 가능 규칙이 코드 레벨에서
 * 강제로 일치한다 (가드 로직의 분산·표류 방지).
 *
 * 규칙:
 *   1) INACTIVE 상품 거부 — 판매 중단/숨김 상품은 담기·주문 불가.
 *   2) 핫딜(ACTIVE Auction) 진행 중 상품 거부 — 입찰로만 거래, 일반 구매 차단.
 *
 * 위반 시 400 Bad Request (BusinessException.badRequest). 메시지는 사용자 노출용 한국어.
 *
 * 주의: 장바구니 sync 는 "실패해도 throw 하지 않고 silent skip" 이라는 다른 정책을
 *   따르므로 이 가드를 쓰지 않는다 (CartService.sync 내부에 자체 skip 로직 유지).
 *   이 가드는 "예외를 던져 흐름을 중단"하는 담기·주문 경로 전용이다.
 */
@Component
@RequiredArgsConstructor
public class PurchaseGuard {

    private final AuctionRepository auctionRepository;

    /**
     * 상품이 구매 가능한지 검증. 불가하면 BusinessException(400) 을 던진다.
     *
     * @param product 검증 대상 상품 (이미 조회된 엔티티)
     */
    public void validatePurchasable(Product product) {
        // 가드 1: INACTIVE 상품 거부
        if (product.getStatus() != null && !"ACTIVE".equals(product.getStatus().name())) {
            throw BusinessException.badRequest("판매 중인 상품이 아닙니다.");
        }

        // 가드 2: 핫딜(ACTIVE Auction) 진행 중인 상품 거부
        auctionRepository.findByProductIdAndStatus(product.getId(), Auction.Status.ACTIVE)
                .ifPresent(a -> {
                    throw BusinessException.badRequest("현재 경매 진행 중인 상품입니다. 입찰로 참여해 주세요.");
                });
    }
}
