package backend.dto;

/**
 * 관리자 대시보드 통계 DTO (Phase 7-G 라운드 3).
 *
 * GET /api/admin/stats 응답 — 4개 COUNT 집계.
 *
 * record 채택: 불변 + 보일러플레이트 제거. 단순 조회 응답이라 Builder 불필요.
 */
public record AdminStatsDto(
        long activeProductCount,  // 판매중 상품 (ProductStatus.ACTIVE)
        long totalUserCount,      // 전체 회원 (USER + ADMIN)
        long reviewCount,         // 누적 리뷰 (구매 인증)
        long orderCount           // 누적 주문
) {
}
