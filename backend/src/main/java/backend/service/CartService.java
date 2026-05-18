package backend.service;

import backend.dto.cart.CartDto;
import backend.entity.Auction;
import backend.entity.Cart;
import backend.entity.CartItem;
import backend.entity.Product;
import backend.entity.User;
import backend.exception.BusinessException;
import backend.repository.AuctionRepository;
import backend.repository.CartItemRepository;
import backend.repository.CartRepository;
import backend.repository.ProductRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 장바구니 도메인 서비스 (Phase 8 5-D, 5/18).
 *
 * 핵심 규칙:
 * - 인증 필수 — 모든 메서드는 email (UserDetails.getUsername()) 받아서 user 조회.
 * - 핫딜(ACTIVE Auction) 상품은 장바구니 불가 — 사용자는 "입찰하러 가기" 로 유도.
 * - INACTIVE 상품 불가 — 판매 중단된 상품 추가 거부.
 * - Cart 는 회원가입 시 자동 생성 (AuthService 에서) — getOrCreateCart 같은 lazy 패턴 불필요.
 *
 * 도메인 흐름:
 * - addItem: Cart 가져옴 → Product 검증 → 핫딜/INACTIVE 가드 → Cart.addItem (도메인 메서드)
 * - updateQuantity: 본인 카트의 item 검증 후 quantity 변경
 * - removeItem: 본인 카트의 item 검증 후 삭제
 * - clear: 카트 비우기 (주문 완료 시 호출 가능)
 * - sync: 비로그인 localStorage → 서버 머지 (로그인 직후 1회 호출)
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final AuctionRepository auctionRepository;

    // ─── 조회 ────────────────────────────────────────────

    /**
     * 사용자의 카트 전체 (items + product 포함).
     * GET /api/cart 응답용.
     */
    public CartDto.View getCart(String email) {
        User user = findUserByEmail(email);
        Cart cart = cartRepository.findByUserIdWithItems(user.getId())
                .orElseThrow(() -> BusinessException.notFound("Cart not found for user"));
        return CartDto.View.from(cart);
    }

    /**
     * Header 배지용 총 quantity 합.
     */
    public CartDto.CountView getCount(String email) {
        User user = findUserByEmail(email);
        long count = cartItemRepository.sumQuantityByUserId(user.getId());
        return CartDto.CountView.builder().count(count).build();
    }

    // ─── 변경 ────────────────────────────────────────────

    /**
     * 상품 담기. 같은 product 이미 있으면 quantity 합산 (Cart.addItem 도메인 로직).
     * 핫딜 ACTIVE 상품 거부.
     */
    @Transactional
    public CartDto.View addItem(String email, Long productId, int quantity) {
        if (quantity <= 0) {
            throw BusinessException.badRequest("Quantity must be positive");
        }

        User user = findUserByEmail(email);
        Cart cart = cartRepository.findByUserIdWithItems(user.getId())
                .orElseThrow(() -> BusinessException.notFound("Cart not found"));

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> BusinessException.notFound("Product not found: " + productId));

        // 가드 1: INACTIVE 상품 거부
        if (product.getStatus() != null && !"ACTIVE".equals(product.getStatus().name())) {
            throw BusinessException.badRequest("This product is not available");
        }

        // 가드 2: 핫딜(ACTIVE Auction) 진행 중인 상품 거부
        auctionRepository.findByProductIdAndStatus(productId, Auction.Status.ACTIVE)
                .ifPresent(a -> {
                    throw BusinessException.badRequest(
                            "This product is currently in auction. Please bid instead.");
                });

        // 도메인 메서드 호출 — Cart.addItem 이 중복 체크 + quantity 합산 자동 처리
        cart.addItem(product, quantity);
        log.info("Cart addItem: user={}, productId={}, quantity={}", email, productId, quantity);

        return CartDto.View.from(cart);
    }

    /**
     * 수량 변경. 0 이하면 거부 (삭제는 별도 endpoint).
     */
    @Transactional
    public CartDto.View updateQuantity(String email, Long itemId, int quantity) {
        if (quantity <= 0) {
            throw BusinessException.badRequest("Quantity must be positive (use remove endpoint to delete)");
        }

        User user = findUserByEmail(email);
        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> BusinessException.notFound("Cart item not found: " + itemId));

        // 보안: 본인 카트의 item 인지 검증
        if (!item.getCart().getUser().getId().equals(user.getId())) {
            throw BusinessException.forbidden("Not your cart item");
        }

        item.setQuantity(quantity);
        log.info("Cart updateQuantity: user={}, itemId={}, quantity={}", email, itemId, quantity);

        Cart cart = item.getCart();
        return CartDto.View.from(cart);
    }

    /**
     * 카트 아이템 삭제.
     */
    @Transactional
    public CartDto.View removeItem(String email, Long itemId) {
        User user = findUserByEmail(email);
        int deleted = cartItemRepository.deleteByIdAndUserId(itemId, user.getId());
        if (deleted == 0) {
            throw BusinessException.notFound("Cart item not found or not yours: " + itemId);
        }
        log.info("Cart removeItem: user={}, itemId={}", email, itemId);

        // 갱신된 카트 반환
        Cart cart = cartRepository.findByUserIdWithItems(user.getId())
                .orElseThrow(() -> BusinessException.notFound("Cart not found"));
        return CartDto.View.from(cart);
    }

    /**
     * 카트 비우기 (모든 item 삭제). 주문 완료 시 또는 사용자 직접 호출.
     */
    @Transactional
    public CartDto.View clear(String email) {
        User user = findUserByEmail(email);
        int deleted = cartItemRepository.deleteAllByUserId(user.getId());
        log.info("Cart clear: user={}, deletedItems={}", email, deleted);

        Cart cart = cartRepository.findByUserIdWithItems(user.getId())
                .orElseThrow(() -> BusinessException.notFound("Cart not found"));
        return CartDto.View.from(cart);
    }

    // ─── Sync (비로그인 localStorage → 서버 머지) ─────────────────

    /**
     * 비로그인 localStorage 의 카트를 서버 카트에 머지.
     * 로그인 직후 1회 호출됨.
     *
     * 머지 정책:
     * - 각 item 에 대해 addItem 호출 (Cart.addItem 의 중복 합산 로직 활용)
     * - 핫딜 / INACTIVE 상품은 silent skip (예외 throw 안 함 — 사용자 경험 우선)
     * - 모든 처리 후 최종 카트 반환
     *
     * @param email 로그인한 사용자
     * @param items localStorage 에서 가져온 카트 아이템 리스트
     * @return 머지된 최종 카트
     */
    @Transactional
    public CartDto.View sync(String email, List<CartDto.SyncItem> items) {
        User user = findUserByEmail(email);
        Cart cart = cartRepository.findByUserIdWithItems(user.getId())
                .orElseThrow(() -> BusinessException.notFound("Cart not found"));

        if (items == null || items.isEmpty()) {
            log.info("Cart sync: user={}, items=0 (no-op)", email);
            return CartDto.View.from(cart);
        }

        int merged = 0;
        int skipped = 0;
        for (CartDto.SyncItem si : items) {
            if (si.getProductId() == null || si.getQuantity() == null || si.getQuantity() <= 0) {
                skipped++;
                continue;
            }

            // Product 조회 + 가드 (silent skip 정책)
            Product product = productRepository.findById(si.getProductId()).orElse(null);
            if (product == null) {
                log.warn("Cart sync: skipping unknown productId={}", si.getProductId());
                skipped++;
                continue;
            }
            if (product.getStatus() != null && !"ACTIVE".equals(product.getStatus().name())) {
                log.warn("Cart sync: skipping INACTIVE productId={}", si.getProductId());
                skipped++;
                continue;
            }
            boolean isActiveAuction = auctionRepository
                    .findByProductIdAndStatus(si.getProductId(), Auction.Status.ACTIVE)
                    .isPresent();
            if (isActiveAuction) {
                log.warn("Cart sync: skipping ACTIVE auction productId={}", si.getProductId());
                skipped++;
                continue;
            }

            // 머지 (Cart.addItem 의 중복 합산 로직)
            cart.addItem(product, si.getQuantity());
            merged++;
        }

        log.info("Cart sync: user={}, merged={}, skipped={}", email, merged, skipped);
        return CartDto.View.from(cart);
    }

    // ─── helpers ──────────────────────────────────────────

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.notFound("User not found: " + email));
    }
}
