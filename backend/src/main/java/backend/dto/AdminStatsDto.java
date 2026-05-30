package backend.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 관리자 대시보드 통계 DTO (Phase 7-G 라운드 3 → 5/30 현황 강화).
 *
 * GET /api/admin/stats 응답.
 *
 * 5/30 확장: 단일 호출로 대시보드 전체를 채우도록 확장.
 *   - 기존 4개 COUNT 카드 (호환 유지)
 *   - 상태별 분포 (회원/주문/상품)
 *   - 운영 알림성 카운트 (미답변 Q&A, 진행중 경매)
 *   - 최근 목록 (가입 회원 5 / 주문 5)
 *
 * 모든 집계는 readOnly 트랜잭션 한 번에 수행 (Service). 카운트 쿼리는 가벼워
 * N+1 우려 없음. 최근 목록만 Pageable(size=5) 로 조회 + DTO 변환.
 *
 * record 채택: 불변 + 보일러플레이트 제거. 중첩 record 로 그룹화.
 */
public record AdminStatsDto(
        // ─── 기존 4개 (호환 유지) ───────────────────────────────
        long activeProductCount,  // 판매중 상품 (ProductStatus.ACTIVE)
        long totalUserCount,      // 전체 회원 (USER + ADMIN)
        long reviewCount,         // 누적 리뷰 (구매 인증)
        long orderCount,          // 누적 주문

        // ─── B: 상태별 분포 ─────────────────────────────────────
        UserStatusBreakdown userStatus,
        OrderStatusBreakdown orderStatus,
        ProductStatusBreakdown productStatus,

        // ─── C: 운영 알림성 ─────────────────────────────────────
        long pendingQnaCount,     // 미답변 Q&A (answer_content IS NULL)
        long activeAuctionCount,  // 진행중 경매 (Auction.Status.ACTIVE)

        // ─── D: 최근 목록 ───────────────────────────────────────
        List<RecentUser> recentUsers,    // 최근 가입 5
        List<RecentOrder> recentOrders   // 최근 주문 5
) {
    /** 회원 상태 분포 (정상/정지/탈퇴). */
    public record UserStatusBreakdown(long active, long suspended, long withdrawn) {}

    /** 주문 상태 분포 (5단계). */
    public record OrderStatusBreakdown(
            long pending, long paid, long shipping, long delivered, long cancelled) {}

    /** 상품 상태 분포 (노출/숨김). */
    public record ProductStatusBreakdown(long active, long inactive) {}

    /** 최근 가입 회원 요약. */
    public record RecentUser(
            Long id, String email, String displayName,
            String provider, String status, LocalDateTime createdAt) {}

    /** 최근 주문 요약. */
    public record RecentOrder(
            Long id, String userName, int totalPrice,
            String status, LocalDateTime createdAt) {}
}
