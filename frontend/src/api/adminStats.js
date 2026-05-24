// frontend/src/api/adminStats.js
//
// Phase 7-G 라운드 3 (2026-05-24) — 관리자 대시보드 통계 API.
// 백엔드: AdminStatsController — GET /api/admin/stats.
//
// 권한: SecurityConfig 의 /api/admin/** hasRole("ADMIN") 일괄 가드.
//   JWT 자동 첨부는 apiClient 인터셉터가 처리 (auditLog.js 와 동일 패턴).
//
// 컨벤션 (5/12 5-B fix): 함수는 res.data (백엔드 JSON body) 만 반환.

import apiClient from './client';

export const adminStatsApi = {
  /**
   * GET /api/admin/stats
   *
   * @returns AdminStatsDto
   *   {
   *     activeProductCount: number,  // 판매중 상품 (ProductStatus.ACTIVE)
   *     totalUserCount:     number,  // 전체 회원 (USER + ADMIN)
   *     reviewCount:        number,  // 누적 리뷰 (구매 인증)
   *     orderCount:         number   // 누적 주문
   *   }
   */
  getStats: async () => {
    const res = await apiClient.get('/admin/stats');
    return res.data;
  },
};

export default adminStatsApi;
