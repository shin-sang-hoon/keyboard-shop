package backend.service;

import backend.dto.AdminStatsDto;
import backend.entity.Auction;
import backend.entity.Order;
import backend.entity.Product.ProductStatus;
import backend.entity.User;
import backend.repository.AuctionRepository;
import backend.repository.OrderRepository;
import backend.repository.ProductRepository;
import backend.repository.QnARepository;
import backend.repository.ReviewRepository;
import backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 관리자 대시보드 통계 서비스 (Phase 7-G 라운드 3 → 5/30 현황 강화).
 *
 * 단일 getStats() 호출로 대시보드 전체 데이터를 한 트랜잭션에 모은다.
 *
 * 설계 노트:
 *   - readOnly 트랜잭션: 모두 조회 — 쓰기 없음. 최근 목록의 LAZY 연관(user) 접근도
 *     트랜잭션 경계 안이라 안전 (LazyInitializationException 회피).
 *   - 카운트는 전부 파생 쿼리(countByStatus / countByAnswerContentIsNull / count).
 *     인덱스(idx_user_status 등) 활용, 가벼운 집계라 N+1 우려 없음.
 *   - 최근 목록: PageRequest(0, 5, createdAt DESC) 로 상위 5건만. DTO 변환 시
 *     User.displayName()(이름(닉네임)) / order.getUser().getName() 사용.
 *   - 주문 최근 목록의 user 는 LAZY → 여기서 getName() 호출로 초기화(트랜잭션 내).
 *     건수가 5건뿐이라 추가 쿼리 부담 미미 (대시보드 1회성 조회).
 */
@Service
@RequiredArgsConstructor
public class AdminStatsService {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;
    private final OrderRepository orderRepository;
    private final QnARepository qnaRepository;
    private final AuctionRepository auctionRepository;

    private static final int RECENT_SIZE = 5;

    @Transactional(readOnly = true)
    public AdminStatsDto getStats() {
        // ─── 기존 4개 카드 ──────────────────────────────────────
        long activeProductCount = productRepository.countByStatus(ProductStatus.ACTIVE);
        long totalUserCount = userRepository.count();
        long reviewCount = reviewRepository.count();
        long orderCount = orderRepository.count();

        // ─── B: 상태별 분포 ─────────────────────────────────────
        var userStatus = new AdminStatsDto.UserStatusBreakdown(
                userRepository.countByStatus(User.Status.ACTIVE),
                userRepository.countByStatus(User.Status.SUSPENDED),
                userRepository.countByStatus(User.Status.WITHDRAWN)
        );
        var orderStatus = new AdminStatsDto.OrderStatusBreakdown(
                orderRepository.countByStatus(Order.OrderStatus.PENDING),
                orderRepository.countByStatus(Order.OrderStatus.PAID),
                orderRepository.countByStatus(Order.OrderStatus.SHIPPING),
                orderRepository.countByStatus(Order.OrderStatus.DELIVERED),
                orderRepository.countByStatus(Order.OrderStatus.CANCELLED)
        );
        var productStatus = new AdminStatsDto.ProductStatusBreakdown(
                activeProductCount,
                productRepository.countByStatus(ProductStatus.INACTIVE)
        );

        // ─── C: 운영 알림성 ─────────────────────────────────────
        long pendingQnaCount = qnaRepository.countByAnswerContentIsNull();
        long activeAuctionCount = auctionRepository.countByStatus(Auction.Status.ACTIVE);

        // ─── D: 최근 목록 ───────────────────────────────────────
        Pageable recent = PageRequest.of(0, RECENT_SIZE, Sort.by(Sort.Direction.DESC, "createdAt"));

        List<AdminStatsDto.RecentUser> recentUsers = userRepository.findAll(recent)
                .map(u -> new AdminStatsDto.RecentUser(
                        u.getId(), u.getEmail(), u.displayName(),
                        u.getProvider() == null ? null : u.getProvider().name(),
                        u.getStatus() == null ? null : u.getStatus().name(),
                        u.getCreatedAt()))
                .getContent();

        List<AdminStatsDto.RecentOrder> recentOrders = orderRepository.findAllBy(recent)
                .map(o -> new AdminStatsDto.RecentOrder(
                        o.getId(),
                        o.getUser() == null ? "(탈퇴/없음)" : o.getUser().getName(),
                        o.getTotalPrice(),
                        o.getStatus() == null ? null : o.getStatus().name(),
                        o.getCreatedAt()))
                .getContent();

        return new AdminStatsDto(
                activeProductCount, totalUserCount, reviewCount, orderCount,
                userStatus, orderStatus, productStatus,
                pendingQnaCount, activeAuctionCount,
                recentUsers, recentOrders
        );
    }
}
