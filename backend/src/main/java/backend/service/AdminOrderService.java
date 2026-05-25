package backend.service;

import backend.dto.AdminOrderDto;
import backend.dto.PagedResponse;
import backend.entity.Order;
import backend.exception.BusinessException;
import backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 주문 관리 서비스 (Phase 7-G 라운드 6).
 *
 * 기능:
 *   - 주문 목록 조회 (페이징 + status 필터)
 *   - 주문 상태 변경 (PENDING / PAID / SHIPPING / DELIVERED / CANCELLED)
 *
 * 설계 노트:
 *   - status 필터: null/빈 문자열이면 전체(findAllBy), 아니면 findByStatus.
 *   - 정렬: 주문일(id) 내림차순 — 최근 주문 먼저.
 *   - ListItem.from 은 items 컬렉션을 LAZY 초기화하므로 반드시
 *     @Transactional(readOnly=true) 안에서 호출 (OSIV 꺼진 환경 대비).
 *   - 상태 변경은 5개 enum 자유 전환 허용. 실무라면 PAID→SHIPPING 같은
 *     순방향 전이만 허용하는 상태 머신이 맞지만, 관리자가 오입력을
 *     되돌릴 수 있어야 하므로 포트폴리오 범위에서는 자유 전환으로 둔다.
 */
@Service
@RequiredArgsConstructor
public class AdminOrderService {

    private final OrderRepository orderRepository;

    /** 페이지 크기 상한 (DOS 가드 — 다른 admin 서비스와 동일 정책). */
    private static final int MAX_PAGE_SIZE = 100;

    /**
     * 관리자 주문 목록 (페이징 + status 필터).
     *
     * @param status "PENDING"/"PAID"/"SHIPPING"/"DELIVERED"/"CANCELLED"/null·"" (전체)
     * @param page   0-indexed
     * @param size   1~100
     */
    @Transactional(readOnly = true)
    public PagedResponse<AdminOrderDto.ListItem> list(String status, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                safeSize,
                Sort.by(Sort.Direction.DESC, "id")
        );

        Order.OrderStatus statusEnum = parseStatusOrNull(status);

        Page<Order> result = (statusEnum == null)
                ? orderRepository.findAllBy(pageable)
                : orderRepository.findByStatus(statusEnum, pageable);

        // map 내부에서 items LAZY 초기화 — readOnly 트랜잭션 안이라 안전.
        return PagedResponse.from(result.map(AdminOrderDto.ListItem::from));
    }

    /**
     * 주문 상태 변경.
     *
     * @param orderId   대상 주문 id
     * @param newStatus 5개 enum 중 하나
     */
    @Transactional
    public AdminOrderDto.ListItem updateStatus(Long orderId, String newStatus) {
        Order.OrderStatus statusEnum = parseStatusRequired(newStatus);

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> BusinessException.notFound(
                        "주문을 찾을 수 없습니다. id=" + orderId));

        order.setStatus(statusEnum);
        // JPA dirty checking 으로 flush 시 UPDATE (명시적 save 불필요).

        return AdminOrderDto.ListItem.from(order);
    }

    // ─── 내부 파싱 헬퍼 ───────────────────────────────────────────

    /** 목록 필터용 — null/빈 문자열이면 null 반환 (전체 의미). */
    private Order.OrderStatus parseStatusOrNull(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return Order.OrderStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("알 수 없는 주문 상태입니다: " + raw);
        }
    }

    /** 상태 변경용 — 값 필수. */
    private Order.OrderStatus parseStatusRequired(String raw) {
        if (raw == null || raw.isBlank()) {
            throw BusinessException.badRequest("주문 상태 값이 필요합니다.");
        }
        try {
            return Order.OrderStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("알 수 없는 주문 상태입니다: " + raw);
        }
    }
}
